const axios = require('axios');
const LoanApplication = require('../models/LoanApplication');
const ValidationResult = require('../models/ValidationResult');
const Document = require('../models/Document');
const config = require('../config');
const { logActivity } = require('../utils/activityLogger');

const AI_SERVICE_URL = config.aiServiceUrl || 'http://localhost:8000';

// Simple in-memory lock to prevent duplicate concurrent validation runs
const _validationLocks = new Set();

/**
 * Mark validation as STALE for an application.
 * Called when a document is replaced or reprocessed.
 */
const markStale = async (applicationId) => {
  try {
    await ValidationResult.findOneAndUpdate(
      { application: applicationId },
      { status: 'STALE' }
    );
    console.log(`[Validation] Marked as STALE for application ${applicationId}`);
  } catch (error) {
    console.error(`[Validation] Failed to mark stale:`, error.message);
  }
};

/**
 * Runs cross-document validation for a loan application.
 * Calls Python deterministic verification engine + Groq reasoning layer.
 * 
 * Uses an in-memory lock to prevent duplicate concurrent runs.
 * 
 * @param {string} applicationId 
 */
const runValidation = async (applicationId) => {
  const lockKey = applicationId.toString();

  if (_validationLocks.has(lockKey)) {
    console.log(`[Validation] Already running for ${applicationId} — skipping duplicate`);
    return;
  }

  _validationLocks.add(lockKey);

  try {
    const application = await LoanApplication.findById(applicationId)
      .populate('applicant', 'name email')
      .populate('documents');

    if (!application) {
      console.error(`[Validation] Application ${applicationId} not found.`);
      return;
    }

    // ── CACHE CHECK: Skip Groq if a valid (non-STALE) result already exists ──
    const existingResult = await ValidationResult.findOne({ application: applicationId });
    if (
      existingResult &&
      existingResult.status !== 'STALE' &&
      existingResult.status !== 'PENDING_DOCS'
    ) {
      // Verify no documents have been re-processed since the last validation
      const latestDocProcessedAt = Math.max(
        ...application.documents
          .filter((d) => d.aiProcessing?.processedAt)
          .map((d) => new Date(d.aiProcessing.processedAt).getTime()),
        0
      );
      const validatedAt = new Date(existingResult.validatedAt).getTime();

      if (latestDocProcessedAt <= validatedAt) {
        console.log(
          `[Validation] ⏭️  Skipping for application ${applicationId} — valid result already exists (status=${existingResult.status}, validated=${existingResult.validatedAt})`
        );
        return existingResult;
      }
      console.log(
        `[Validation] Re-running for application ${applicationId} — documents updated after last validation`
      );
    }

    const docs = (application.documents || []).filter(
      (d) => d.aiProcessing && d.aiProcessing.status === 'completed' && d.aiProcessing.extractedData
    );

    console.log(`[Validation] 🔍 Running verification for application ${applicationId} with ${docs.length} completed document(s)...`);

    const payload = {
      application_id: applicationId.toString(),
      applicant_declared: {
        name: application.applicant?.name || '',
        applicant_name: application.applicant?.name || '',
        declaredMonthlyIncome: application.declaredMonthlyIncome || 0,
        declared_monthly_income: application.declaredMonthlyIncome || 0,
        requestedAmount: application.requestedAmount || 0,
        tenureMonths: application.tenureMonths || 0,
        loanType: application.loanType || '',
        employmentType: application.employmentType || '',
      },
      documents: docs.map((d) => ({
        document_id: d._id.toString(),
        document_type: d.aiProcessing?.predictedType || d.documentType,
        original_name: d.originalName,
        extracted_data: d.aiProcessing?.extractedData || {},
        extraction_method: d.aiProcessing?.extractionMethod || d.ocr?.engine || 'native',
      })),
    };

    let validationData;

    try {
      const response = await axios.post(`${AI_SERVICE_URL}/api/verify-application`, payload, {
        timeout: 60000,
        headers: { 'X-Internal-Token': config.aiServiceToken },
      });
      validationData = response.data;
    } catch (aiErr) {
      console.error(`[Validation] AI Service verify-application call failed:`, aiErr.message);
      // Fallback structure
      validationData = {
        verificationStatus: 'REVIEW_REQUIRED',
        overallSeverity: 'HIGH',
        summary: `Verification service call failed: ${aiErr.message}. Manual review required.`,
        riskLevel: 'HIGH',
        verificationScore: 0,
        keyFindings: ['Verification service could not be contacted', 'Manual review required'],
        findings: [
          {
            title: 'Verification Service Offline',
            subtitle: 'Service connectivity issue',
            severity: 'HIGH',
            explanation: ['Cross-document verification service could not be contacted.', 'Please retry or perform manual review.'],
            documents: ['APPLICATION'],
            sourceA: null,
            sourceB: null,
          },
        ],
        recommendedAction: 'MANUAL_REVIEW',
        checks: [],
        validatedAt: new Date().toISOString(),
      };
    }

    // Save or Update ValidationResult in MongoDB
    const updated = await ValidationResult.findOneAndUpdate(
      { application: applicationId },
      {
        application: applicationId,
        status: validationData.verificationStatus || 'REVIEW_REQUIRED',
        overallSeverity: validationData.overallSeverity || 'LOW',
        summary: validationData.summary || '',
        riskLevel: validationData.riskLevel || 'LOW',
        verificationScore: validationData.verificationScore ?? 50,
        keyFindings: validationData.keyFindings || [],
        findings: validationData.findings || [],
        recommendedAction: validationData.recommendedAction || 'MANUAL_REVIEW',
        checks: validationData.checks || [],
        validatedAt: new Date(validationData.validatedAt || Date.now()),
      },
      { upsert: true, new: true }
    );

    console.log(
      `[Validation] ✅ Completed for application ${applicationId}. Status: ${updated.status}, Risk: ${updated.riskLevel}, Findings: ${updated.findings.length}`
    );

    await logActivity(applicationId, null, 'Cross-Document Verification Completed', {
      status: updated.status,
      riskLevel: updated.riskLevel,
      recommendedAction: updated.recommendedAction,
      flaggedCount: (updated.checks || []).filter((c) => c.status === 'FLAGGED').length,
    });

    return updated;
  } catch (error) {
    console.error(`[Validation] Engine failed for application ${applicationId}:`, error);
  } finally {
    _validationLocks.delete(lockKey);
  }
};

module.exports = {
  runValidation,
  markStale,
};
