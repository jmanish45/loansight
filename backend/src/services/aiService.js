const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const FormData = require('form-data');
const Document = require('../models/Document');
const LoanApplication = require('../models/LoanApplication');
const config = require('../config');
const { logActivity } = require('../utils/activityLogger');
const validationService = require('./validationService');

/**
 * AI Document Processing Service — Optimized
 * 
 * Key optimizations:
 * - SHA-256 caching: skip Gemini if same file was already processed successfully
 * - Passes expected_type to AI service (combined classify+extract in 1 Gemini call)
 * - Deferred validation: only runs after ALL required docs are processed
 * - Retry with exponential backoff for 429/rate-limit errors
 */

const AI_SERVICE_URL = config.aiServiceUrl || 'http://localhost:8000';
const PROMPT_VERSION = 'v3'; // Bump to invalidate caches
const MAX_RETRIES = 3;

// Map frontend document types to AI expected types
const FRONTEND_TO_AI_TYPE = {
  pan: 'PAN',
  aadhaar: 'AADHAAR',
  salary_slip: 'SALARY_SLIP',
  payment_slip: 'PAYMENT_SLIP',
  bank_statement: 'BANK_STATEMENT',
  form16: 'FORM_16',
  property_document: 'OTHER',
  other: 'OTHER',
};

/**
 * Compute SHA-256 hash of a file on disk.
 */
const computeFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};

/**
 * Check if we have a cached result for the same file hash + prompt version.
 */
const findCachedResult = async (fileHash) => {
  if (!fileHash) return null;
  const cached = await Document.findOne({
    'aiProcessing.fileHash': fileHash,
    'aiProcessing.promptVersion': PROMPT_VERSION,
    'aiProcessing.status': 'completed',
    'aiProcessing.extractedData': { $ne: null },
  }).select('aiProcessing');

  return cached?.aiProcessing || null;
};

/**
 * Check if all documents for an application have completed processing.
 */
const allDocsOcrCompleted = async (applicationId) => {
  const app = await LoanApplication.findById(applicationId).populate('documents');
  if (!app || !app.documents || app.documents.length === 0) return false;

  const allTerminal = app.documents.every(
    (d) => d.aiProcessing && ['completed', 'failed'].includes(d.aiProcessing.status)
  );

  return allTerminal;
};

// --- Parallel processing queue ---
const processingQueue = [];
let activeOcrCount = 0;
const MAX_CONCURRENT_OCR = 4;

const drainQueue = () => {
  while (processingQueue.length > 0 && activeOcrCount < MAX_CONCURRENT_OCR) {
    const documentId = processingQueue.shift();
    activeOcrCount += 1;
    processDocumentInternal(documentId)
      .catch((err) => console.error(`[AI Queue] Error processing ${documentId}:`, err))
      .finally(() => {
        activeOcrCount -= 1;
        drainQueue();
      });
  }
};

const processQueue = () => drainQueue();

/**
 * Queue a document for processing (exported API).
 */
const queueDocument = async (documentId) => {
  processingQueue.push(documentId);
  processQueue(); // Start loop if not running
  return true;
};

// ------------------------------------

/**
 * Process a document through the AI pipeline (internal).
 *
 * @param {string} documentId - MongoDB document ID
 */
const processDocumentInternal = async (documentId) => {
  let document;

  try {
    // Fetch the document record
    document = await Document.findById(documentId);
    if (!document) {
      console.error(`[AI] Document not found: ${documentId}`);
      return;
    }

    // ── CACHE CHECK 1: This exact document is already fully processed ──
    if (
      document.aiProcessing &&
      document.aiProcessing.status === 'completed' &&
      document.aiProcessing.extractedData &&
      document.aiProcessing.promptVersion === PROMPT_VERSION
    ) {
      console.log(
        `[AI] ⏭️  Skipping ${document.originalName} (${documentId}) — already processed (promptVersion=${PROMPT_VERSION})`
      );
      // Still trigger validation in case this was the last pending doc
      await triggerDeferredValidation(document.application);
      return;
    }

    const filePath = document.path;
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found on disk: ${filePath}`);
    }

    const fileHash = await computeFileHash(filePath);

    // ── CACHE CHECK 2: Another document with same file hash was already processed ──
    const cached = await findCachedResult(fileHash);
    if (cached) {
      console.log(
        `[AI] ⏭️  Cache hit for ${document.originalName} (hash=${fileHash.substring(0, 12)}…) — reusing previous result`
      );
      document.ocr = document.ocr || {};
      document.ocr.status = 'completed';
      document.ocr.processedAt = new Date();

      document.aiProcessing = document.aiProcessing || {};
      document.aiProcessing.status = cached.status;
      document.aiProcessing.predictedType = cached.predictedType;
      document.aiProcessing.confidence = cached.confidence;
      document.aiProcessing.extractedData = cached.extractedData;
      document.aiProcessing.extractionMethod = cached.extractionMethod;
      document.aiProcessing.processedAt = new Date();
      document.aiProcessing.fileHash = fileHash;
      document.aiProcessing.promptVersion = PROMPT_VERSION;
      document.aiProcessing.documentTypeMatch = cached.documentTypeMatch;
      document.aiProcessing.geminiCallsMade = 0;
      document.aiProcessing.processingError = null;
      await document.save();

      await triggerDeferredValidation(document.application);
      return;
    }

    // Identity documents (PAN/Aadhaar): PyMuPDF local extraction, no LLM
    const isIdentityDoc = document.documentType === 'pan' || document.documentType === 'aadhaar';

    if (isIdentityDoc && document.ocr?.engine === 'manual_input') {
      console.log(`[AI] Document ${document.originalName} (${document.documentType}) uses manual input. Skipping PDF extraction.`);
    } else if (isIdentityDoc) {
      document.ocr = document.ocr || {};
      document.ocr.status = 'processing';
      document.aiProcessing = document.aiProcessing || {};
      document.aiProcessing.status = 'processing';
      document.aiProcessing.fileHash = fileHash;
      document.aiProcessing.promptVersion = PROMPT_VERSION;
      await document.save();

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), {
        filename: document.originalName,
        contentType: document.mimetype,
      });

      console.log(`[AI] Extracting identity doc via PyMuPDF: ${document.originalName} (${documentId})`);

      const response = await axios.post(
        `${AI_SERVICE_URL}/api/extract-text?document_type=${document.documentType}`,
        form,
        {
          headers: { ...form.getHeaders(), 'X-Internal-Token': config.aiServiceToken },
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024,
        }
      );

      const result = response.data;
      if (result.error) {
        throw new Error(result.error);
      }

      document.ocr.text = result.text || null;
      document.ocr.engine = result.ocr_engine || 'pymupdf';
      document.ocr.status = 'completed';
      document.ocr.processedAt = new Date();

      const extractedData = result.extracted_data || {};
      const hasExtractedFields = Object.keys(extractedData).length > 0;

      document.aiProcessing.status = 'completed';
      document.aiProcessing.predictedType = document.documentType === 'pan' ? 'PAN' : 'AADHAAR';
      document.aiProcessing.confidence = hasExtractedFields ? 1.0 : 0.5;
      document.aiProcessing.extractedData = extractedData;
      document.aiProcessing.extractionMethod = 'native';
      document.aiProcessing.processedAt = new Date();
      document.aiProcessing.documentTypeMatch = true;
      document.aiProcessing.geminiCallsMade = 0;
      await document.save();

      console.log(`[AI] ✅ Identity doc extracted locally: ${document.originalName} (fields: ${Object.keys(extractedData).join(', ') || 'none'})`);
    } else {
      // Financial / PDF Documents: Mistral Pipeline (Native -> OCR fallback -> Mistral Structured Output)
      document.ocr = document.ocr || {};
      document.ocr.status = 'processing';
      document.aiProcessing = document.aiProcessing || {};
      document.aiProcessing.status = 'processing';
      document.aiProcessing.fileHash = fileHash;
      document.aiProcessing.promptVersion = PROMPT_VERSION;
      await document.save();

      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), {
        filename: document.originalName,
        contentType: document.mimetype,
      });

      console.log(`[AI] 🚀 Processing document via Mistral pipeline: ${document.originalName} (${document.documentType})`);

      const response = await axios.post(
        `${AI_SERVICE_URL}/api/process-document-mistral?document_type=${document.documentType}`,
        form,
        {
          headers: { ...form.getHeaders(), 'X-Internal-Token': config.aiServiceToken },
          timeout: 120000,
          maxContentLength: 50 * 1024 * 1024,
        }
      );

      const result = response.data;

      if (result.processing_status === 'failed' || result.processing_error) {
        throw new Error(result.processing_error || 'Mistral extraction failed');
      }

      // Update OCR & AI Processing fields
      document.ocr.text = result.raw_text_preview || null;
      document.ocr.engine = result.extraction_method || 'pymupdf';
      document.ocr.status = 'completed';
      document.ocr.processedAt = new Date();

      document.aiProcessing.status = result.processing_status || 'completed';
      document.aiProcessing.predictedType = result.document_type || FRONTEND_TO_AI_TYPE[document.documentType] || 'OTHER';
      document.aiProcessing.confidence = result.confidence ?? 1.0;
      document.aiProcessing.extractedData = result.extracted_data || null;
      document.aiProcessing.extractionMethod = result.extraction_method || 'native';
      document.aiProcessing.processedAt = new Date();
      document.aiProcessing.processingError = null;
      document.aiProcessing.documentTypeMatch = result.document_type_match ?? true;
      document.aiProcessing.geminiCallsMade = 0;
      await document.save();

      console.log(`[AI] ✅ Mistral processed ${document.originalName} (method: ${result.extraction_method}, type: ${result.document_type})`);

      await logActivity(document.application, null, 'AI Document Processed', {
        documentType: result.document_type,
        extractionMethod: result.extraction_method,
        originalName: document.originalName,
      });
    }

    // Trigger deferred validation if all docs are processed
    await triggerDeferredValidation(document.application);

  } catch (error) {
    console.error(`[AI] ❌ Processing failed for ${documentId}:`, error.message);

    if (document) {
      document.ocr.status = 'failed';
      document.aiProcessing.status = 'failed';
      document.aiProcessing.processingError = error.message;
      await document.save();
    }
  }
};

/**
 * Perform a SINGLE consolidated LLM call for all OCR'd documents in an application.
 */
const processApplicationLLM = async (applicationId) => {
  const application = await LoanApplication.findById(applicationId).populate('documents');
  if (!application || !application.documents) return;

  // Filter out identity documents (PAN / Aadhaar) since AI processing is disabled for them
  const validDocs = application.documents.filter(d => 
    d.documentType !== 'pan' && 
    d.documentType !== 'aadhaar' && 
    d.ocr && 
    d.ocr.status === 'completed' && 
    d.ocr.text
  );
  
  if (validDocs.length === 0) {
    console.log(`[AI] No PDF documents require LLM processing for application ${applicationId}, triggering validation.`);
    await triggerDeferredValidation(applicationId);
    return;
  }

  // Mark all valid docs as 'processing' for AI
  for (const doc of validDocs) {
    doc.aiProcessing.status = 'processing';
    await doc.save();
  }

  const payload = {
    documents: validDocs.map(d => ({
      document_id: d._id.toString(),
      expected_type: FRONTEND_TO_AI_TYPE[d.documentType] || 'OTHER',
      text: d.ocr.text
    }))
  };

  console.log(`[AI] 🚀 Sending consolidated LLM request for ${validDocs.length} documents...`);

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/process-application`,
      payload,
      {
        timeout: 240000, // 4 minutes to allow for large context processing
        headers: { 'X-Internal-Token': config.aiServiceToken },
      }
    );

    const result = response.data;
    
    // Update each document with its respective AI result
    if (result.documents && result.documents.length > 0) {
      for (const docRes of result.documents) {
        const docId = docRes.file_hash; // We repurposed file_hash as document_id in the python backend
        const doc = validDocs.find(d => d._id.toString() === docId);
        
        if (doc) {
          doc.aiProcessing.status = docRes.processing_status || 'completed';
          doc.aiProcessing.predictedType = docRes.document_type || null;
          doc.aiProcessing.confidence = docRes.confidence || null;
          doc.aiProcessing.extractedData = docRes.extracted_data || null;
          doc.aiProcessing.processedAt = new Date();
          doc.aiProcessing.processingError = docRes.processing_error || null;
          doc.aiProcessing.documentTypeMatch = docRes.document_type_match ?? null;
          doc.aiProcessing.geminiCallsMade = result.gemini_calls_made || 1;
          
          await doc.save();
          console.log(`[AI] ✅ LLM processed document ${doc.originalName} -> ${docRes.document_type} (${(docRes.confidence * 100).toFixed(0)}%)`);
          
          await logActivity(applicationId, null, 'AI Document Processed', {
            documentType: docRes.document_type,
            confidence: docRes.confidence,
            originalName: doc.originalName,
            geminiCalls: result.gemini_calls_made,
          });
        }
      }
    }

    // Trigger deferred cross-document validation
    await triggerDeferredValidation(applicationId);

  } catch (error) {
    console.error(`[AI] ❌ Consolidated LLM request failed for ${applicationId}:`, error.message);
    
    // Mark all as failed
    for (const doc of validDocs) {
      doc.aiProcessing.status = 'failed';
      doc.aiProcessing.processingError = error.message;
      await doc.save();
    }
  }
};

/**
 * Trigger cross-document validation ONLY if all docs are processed.
 */
const triggerDeferredValidation = async (applicationId) => {
  try {
    // We can use the same logic, but we need to ensure AI processing is actually done for all docs
    const app = await LoanApplication.findById(applicationId).populate('documents');
    if (!app || !app.documents) return;
    
    // Check if ALL docs have AI completed or failed
    const allAITerminal = app.documents.every(
      (d) => d.aiProcessing && ['completed', 'failed'].includes(d.aiProcessing.status)
    );
    
    if (allAITerminal) {
      console.log(`[AI] All docs AI processed for application ${applicationId} — triggering validation`);
      await validationService.runValidation(applicationId);
    } else {
      console.log(`[AI] Not all docs AI processed yet for application ${applicationId} — skipping validation`);
    }
  } catch (err) {
    console.error(`[AI] Deferred validation check failed for ${applicationId}:`, err.message);
  }
};

/**
 * Re-process a document (officer-triggered).
 * Resets AI state and re-runs the pipeline.
 */
const reprocessDocument = async (documentId) => {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error('Document not found');
  }

  document.ocr.status = 'pending';
  document.ocr.text = null;
  document.ocr.engine = null;

  document.aiProcessing.status = 'pending';
  document.aiProcessing.predictedType = null;
  document.aiProcessing.confidence = null;
  document.aiProcessing.extractedData = null;
  document.aiProcessing.extractionMethod = null;
  document.aiProcessing.processedAt = null;
  document.aiProcessing.processingError = null;
  document.aiProcessing.fileHash = null; // Clear hash to bypass cache
  document.aiProcessing.retryCount = 0;
  document.aiProcessing.promptVersion = null;
  document.aiProcessing.documentTypeMatch = null;
  document.aiProcessing.geminiCallsMade = 0;
  await document.save();

  // Mark validation as stale for this application
  await validationService.markStale(document.application);

  // Trigger processing (async)
  queueDocument(documentId);

  return document;
};

module.exports = {
  processDocument: queueDocument, // Export the queuing function instead
  reprocessDocument,
};
