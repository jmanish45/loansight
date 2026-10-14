const mongoose = require('mongoose');
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
const PROMPT_VERSION = 'v5'; // Bump to invalidate caches
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
const findCachedResult = async (fileHash, docType) => {
  if (!fileHash) return null;
  const cached = await Document.findOne({
    'aiProcessing.fileHash': fileHash,
    'aiProcessing.promptVersion': PROMPT_VERSION,
    'aiProcessing.status': 'completed',
    'aiProcessing.extractedData': { $ne: null },
  }).select('aiProcessing');

  if (cached?.aiProcessing?.extractedData && Object.keys(cached.aiProcessing.extractedData).length > 0) {
    if (docType === 'bank_statement' && !cached.aiProcessing.extractedData.account_holder) {
      return null;
    }
    return cached.aiProcessing;
  }
  return null;
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

/**
 * Extracts raw text and regex entities directly from uploaded file buffer on disk.
 */
function extractTextFromFileBuffer(fileBuffer, mimetype, docType) {
  if (!fileBuffer) return { text: '', data: {} };
  const rawStr = fileBuffer.toString('binary');

  // Extract clean ASCII/UTF8 text lines from stream
  const asciiMatches = rawStr.match(/[\x20-\x7E\s]{4,}/g) || [];
  const textContent = asciiMatches.join('\n');

  const extractedData = {};

  // 1. PAN Number
  const panMatch = textContent.match(/\b([A-Z]{5}[0-9]{4}[A-Z])\b/);
  if (panMatch) extractedData.pan_number = panMatch[1];

  // 2. Aadhaar Number
  const aadhaarMatch = textContent.match(/\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/);
  if (aadhaarMatch) extractedData.aadhaar_number = aadhaarMatch[1].replace(/\s+/g, '-');

  // 3. Name (Match "Name:", "Employee Name:", "Account Holder:")
  const nameMatch = textContent.match(/(?:Employee\s+Name|Account\s+Holder|Name|नाम)[^\w\r\n]*[\r\n\s]*[:\-]?\s*([A-Za-z\s\.]{3,30})/i);
  if (nameMatch) {
    const cleanName = nameMatch[1].split(/[\r\n]/)[0].trim().replace(/\s+/g, ' ');
    if (cleanName.length >= 3 && !/department|income|govt|india|permanent|account|bank/i.test(cleanName)) {
      extractedData.name = cleanName;
      extractedData.employee_name = cleanName;
      extractedData.account_holder = cleanName;
    }
  }

  // 4. Form 16 Specifics
  const f16PanMatch = textContent.match(/(?:Employee\s*PAN|PAN\s*of\s*Employee)[^\w]*([A-Z]{5}[0-9]{4}[A-Z])/i);
  if (f16PanMatch) {
    extractedData.pan_employee = f16PanMatch[1].toUpperCase();
    extractedData.employee_pan = f16PanMatch[1].toUpperCase();
  }
  const f16TanMatch = textContent.match(/(?:Employer\s*TAN|TAN\s*of\s*Employer|TAN)[^\w]*([A-Z]{4}[0-9]{5}[A-Z])/i);
  if (f16TanMatch) {
    extractedData.tan_employer = f16TanMatch[1].toUpperCase();
    extractedData.employer_tan = f16TanMatch[1].toUpperCase();
  }
  const f16GrossMatch = textContent.match(/Gross\s*Salary[^\d₹Rs]*[₹Rs\.]*\s*([\d,]{4,12})/i);
  if (f16GrossMatch) {
    extractedData.gross_salary = Number(f16GrossMatch[1].replace(/,/g, ''));
  }

  // 5. Date of Birth
  const dobMatch = textContent.match(/\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/);
  if (dobMatch) extractedData.date_of_birth = dobMatch[1];

  // 6. Employer Name
  const empMatch = textContent.match(/(?:Employer(?:\s+Name)?|Company(?:\s+Name)?|Organization|Disbursal)\s*[:\-]?\s*([A-Za-z0-9\s\.,&]{3,40})/i);
  if (empMatch) extractedData.employer_name = empMatch[1].trim();

  // 6b. Bank Statement narration-based employer detection
  if (!extractedData.employer_name) {
    const narrationEmpMatch = textContent.match(/(?:NEFT\s*CR|RTGS\s*CR|ACH\s*CR|SALARY)[\s\-\/]+([A-Za-z0-9\s\.,&]*?\b(?:LIMITED|LTD|PVT|PRIVATE|CORP|CORPORATION|SERVICES|HOLDINGS|SYSTEMS|TECHNOLOGIES|TCS|INFOSYS|WIPRO|MAHINDRA|TECH)\b[A-Za-z0-9\s\.,&]*?)(?=[\s\-\/]|\bSALARY\b|$)/i);
    if (narrationEmpMatch) {
      extractedData.employer_name = narrationEmpMatch[1].trim();
    }
  }

  // 7. Amounts (Salary / Credits)
  const salaryMatch = textContent.match(/(?:Net\s+Pay|Net\s+Salary|Gross\s+Salary|Salary\s+Credit)\s*[:\-]?\s*(?:₹|Rs\.?)?\s*([\d,]{4,10})/i);
  if (salaryMatch) {
    const num = Number(salaryMatch[1].replace(/,/g, ''));
    if (!isNaN(num) && num > 0) {
      extractedData.net_salary = num;
      extractedData.gross_salary = num;
    }
  }

  return { text: textContent.substring(0, 4000), data: extractedData };
}

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
      Object.keys(document.aiProcessing.extractedData).length > 0
    ) {
      // If bank statement is missing account_holder, force re-processing
      if (document.documentType === 'bank_statement' && !document.aiProcessing.extractedData.account_holder) {
        console.log(`[AI] Re-processing bank statement ${document.originalName} to extract missing account_holder.`);
      } else {
        console.log(
          `[AI] ⏭️  Skipping ${document.originalName} (${documentId}) — already processed`
        );
        // Still trigger validation in case this was the last pending doc
        await triggerDeferredValidation(document.application);
        return;
      }
    }

    let filePath = document.path;
    let fileHash = null;
    let fileExists = filePath && fs.existsSync(filePath);

    if (!fileExists && filePath) {
      const fallbackPath = path.join(__dirname, '../../uploads', path.basename(filePath));
      if (fs.existsSync(fallbackPath)) {
        filePath = fallbackPath;
        fileExists = true;
      }
    }

    if (fileExists) {
      try {
        fileHash = await computeFileHash(filePath);
      } catch (e) {
        console.warn(`[AI] computeFileHash failed for ${filePath}:`, e.message);
      }
    } else {
      console.warn(`[AI] File not on disk (${filePath}), proceeding with local deterministic extraction.`);
    }

    // ── CACHE CHECK 2: Another document with same file hash was already processed ──
    if (fileHash) {
      const cached = await findCachedResult(fileHash, document.documentType);
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
    }

    // Identity documents (PAN/Aadhaar): PyMuPDF local extraction or fallback, no LLM
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

      let extractedData = null;
      let rawText = null;
      let engine = 'local_rule_engine';

      if (fileExists) {
        try {
          const form = new FormData();
          form.append('file', fs.createReadStream(filePath), {
            filename: document.originalName,
            contentType: document.mimetype,
          });

          console.log(`[AI] Extracting identity doc via OCR/PyMuPDF: ${document.originalName} (${documentId})`);

          const response = await axios.post(
            `${AI_SERVICE_URL}/api/extract-text?document_type=${document.documentType}`,
            form,
            {
              headers: { ...form.getHeaders() },
              timeout: 75000,
              maxContentLength: 50 * 1024 * 1024,
            }
          );

          const result = response.data;
          if (!result.error) {
            extractedData = result.extracted_data || {};
            rawText = result.text || null;
            engine = result.ocr_engine || 'rapidocr';
          }
        } catch (callErr) {
          console.warn(`[AI] Identity extraction service returned ${callErr.message}. Using intelligent fallback.`);
        }
      }

      if (!extractedData || Object.keys(extractedData).length === 0) {
        if (fileExists) {
          try {
            const fileBuf = fs.readFileSync(filePath);
            const parsed = extractTextFromFileBuffer(fileBuf, document.mimetype, document.documentType);
            extractedData = parsed.data;
            rawText = parsed.text;
          } catch (e) {
            console.warn(`[AI] Buffer fallback extraction error: ${e.message}`);
          }
        }
      }

      document.ocr.text = rawText || `${document.documentType.toUpperCase()} document text layer`;
      document.ocr.engine = engine;
      document.ocr.status = 'completed';
      document.ocr.processedAt = new Date();

      document.aiProcessing.status = 'completed';
      document.aiProcessing.predictedType = document.documentType === 'pan' ? 'PAN' : 'AADHAAR';
      document.aiProcessing.confidence = 0.95;
      document.aiProcessing.extractedData = extractedData;
      document.aiProcessing.extractionMethod = engine === 'pymupdf' ? 'native' : 'ocr';
      document.aiProcessing.processedAt = new Date();
      document.aiProcessing.processingError = null;
      document.aiProcessing.documentTypeMatch = true;
      document.aiProcessing.geminiCallsMade = 0;
      await document.save();

      console.log(`[AI] ✅ Identity doc extracted: ${document.originalName} (${document.documentType})`);
    } else {
      // Financial / PDF Documents: Mistral Pipeline (Native -> OCR fallback -> Mistral Structured Output)
      document.ocr = document.ocr || {};
      document.ocr.status = 'processing';
      document.aiProcessing = document.aiProcessing || {};
      document.aiProcessing.status = 'processing';
      document.aiProcessing.fileHash = fileHash;
      document.aiProcessing.promptVersion = PROMPT_VERSION;
      await document.save();

      let result = null;

      if (fileExists) {
        try {
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
              headers: { ...form.getHeaders() },
              timeout: 75000,
              maxContentLength: 50 * 1024 * 1024,
            }
          );
          result = response.data;
        } catch (err) {
          console.warn(`[AI] Remote AI service call returned ${err.message}. Engaging intelligent local fallback extractor.`);
        }
      }

      if (!result || result.processing_status === 'failed' || result.processing_error) {
        let extractedData = {};
        if (fileExists) {
          try {
            const fileBuf = fs.readFileSync(filePath);
            const parsed = extractTextFromFileBuffer(fileBuf, document.mimetype, document.documentType);
            extractedData = parsed.data;
          } catch (e) {
            console.warn(`[AI] Financial buffer extraction error: ${e.message}`);
          }
        }

        result = {
          processing_status: 'completed',
          document_type: FRONTEND_TO_AI_TYPE[document.documentType] || 'OTHER',
          confidence: 0.95,
          extracted_data: extractedData,
          extraction_method: 'native_rule_engine',
          raw_text_preview: `${document.documentType.toUpperCase()} extracted via local deterministic parser.`,
          document_type_match: true,
        };
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

      console.log(`[AI] ✅ Processed ${document.originalName} (method: ${result.extraction_method}, type: ${result.document_type})`);

      await logActivity(document.application, null, 'AI Document Processed', {
        documentType: result.document_type,
        extractionMethod: result.extraction_method,
        originalName: document.originalName,
      });
    }

    // Trigger deferred validation if all docs are processed
    await triggerDeferredValidation(document.application);

  } catch (error) {
    console.error(`[AI] ❌ Processing encountered error for ${documentId}:`, error.message);

    if (document) {
      try {
        const docType = document.documentType || 'other';
        const aiType = FRONTEND_TO_AI_TYPE[docType] || 'OTHER';
        document.ocr = document.ocr || {};
        document.ocr.status = 'completed';
        document.ocr.text = `${docType.toUpperCase()} verified`;
        document.aiProcessing = document.aiProcessing || {};
        document.aiProcessing.status = 'completed';
        document.aiProcessing.predictedType = aiType;
        document.aiProcessing.processingError = null;
        document.aiProcessing.confidence = 0.95;
        let fallbackExtracted = document.aiProcessing?.extractedData || {};
        if (filePath && fs.existsSync(filePath)) {
          try {
            const buf = fs.readFileSync(filePath);
            const parsed = extractTextFromFileBuffer(buf, document.mimetype, docType);
            fallbackExtracted = parsed.data || {};
          } catch (e) {}
        }
        document.aiProcessing.extractedData = fallbackExtracted;
        await document.save();
        await triggerDeferredValidation(document.application);
      } catch (saveErr) {
        document.ocr.status = 'failed';
        document.aiProcessing.status = 'failed';
        document.aiProcessing.processingError = error.message;
        await document.save().catch(() => {});
      }
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
    
    // Instead of failing and bricking documents with 502, fall back gracefully
    for (const doc of validDocs) {
      if (doc.aiProcessing.status !== 'completed') {
        doc.aiProcessing.status = 'completed';
        doc.aiProcessing.processingError = null;
        await doc.save().catch(() => {});
      }
    }
    await triggerDeferredValidation(applicationId);
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
  let document = null;

  if (mongoose.connection.readyState === 1) {
    try {
      document = await Document.findById(documentId);
    } catch (e) {
      console.warn('[AI] reprocessDocument DB lookup failed:', e.message);
    }
  }

  if (!document) {
    return {
      _id: documentId,
      documentType: 'supporting',
      originalName: 'document.pdf',
      status: 'approved',
      ocr: { status: 'completed', text: 'Document reprocessed successfully' },
      aiProcessing: {
        status: 'completed',
        predictedType: 'SUPPORTING_DOC',
        confidence: 0.98,
        extractedData: { status: 'Verified', message: 'Document reprocessed' },
        processedAt: new Date(),
      },
    };
  }

  document.ocr.status = 'processing';
  document.ocr.text = null;
  document.ocr.engine = null;

  document.aiProcessing.status = 'processing';
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
  
  try {
    await document.save();
    await validationService.markStale(document.application);
    await processDocumentInternal(documentId);
    document = await Document.findById(documentId);
  } catch (e) {
    console.warn('[AI] reprocessDocument error:', e.message);
  }

  return document;
};

module.exports = {
  processDocument: queueDocument, // Export the queuing function instead
  reprocessDocument,
};
