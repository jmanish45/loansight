const axios = require('axios');
const LoanApplication = require('../models/LoanApplication');
const Document = require('../models/Document');
const ValidationResult = require('../models/ValidationResult');
const Note = require('../models/Note');
const ApiError = require('../utils/ApiError');
const config = require('../config');

const AI_SERVICE_URL = config.aiServiceUrl || 'http://localhost:8000';

/**
 * Gather complete MongoDB applicant snapshot for an application.
 */
const buildApplicantSnapshot = async (applicationId) => {
  if (!applicationId.match(/^[0-9a-fA-F]{24}$/)) {
    throw ApiError.badRequest('Invalid application ID format');
  }

  const application = await LoanApplication.findById(applicationId)
    .populate('applicant', 'name email role createdAt')
    .populate('documents');

  if (!application) {
    throw ApiError.notFound('Loan application not found');
  }

  // Fetch validation result
  const validationResult = await ValidationResult.findOne({ application: applicationId });

  // Fetch recent officer notes
  const notes = await Note.find({ application: applicationId })
    .populate('author', 'name role')
    .sort({ createdAt: -1 })
    .limit(5);

  const snapshot = {
    _id: application._id,
    applicationId: application._id,
    applicant: application.applicant ? {
      name: application.applicant.name,
      email: application.applicant.email,
      role: application.applicant.role,
    } : null,
    applicantName: application.applicant?.name || 'Applicant',
    applicantEmail: application.applicant?.email || '',
    bankId: application.bankId || 'hdfc',
    bankName: application.bankName || 'HDFC Bank',
    loanType: application.loanType,
    requestedAmount: application.requestedAmount,
    tenureMonths: application.tenureMonths,
    employmentType: application.employmentType,
    declaredMonthlyIncome: application.declaredMonthlyIncome,
    status: application.status,
    createdAt: application.createdAt,
    documents: (application.documents || []).map((doc) => ({
      _id: doc._id,
      documentType: doc.documentType,
      originalName: doc.originalName,
      status: doc.status,
      reviewComment: doc.reviewComment,
      aiProcessing: {
        status: doc.aiProcessing?.status || 'pending',
        predictedType: doc.aiProcessing?.predictedType,
        confidence: doc.aiProcessing?.confidence,
        extractedData: doc.aiProcessing?.extractedData || null,
        extractionMethod: doc.aiProcessing?.extractionMethod,
      },
    })),
    validationResult: validationResult ? {
      status: validationResult.status,
      overallSeverity: validationResult.overallSeverity,
      riskLevel: validationResult.riskLevel,
      verificationScore: validationResult.verificationScore,
      summary: validationResult.summary,
      keyFindings: validationResult.keyFindings || [],
      findings: validationResult.findings || [],
      recommendedAction: validationResult.recommendedAction,
      checks: validationResult.checks || [],
    } : null,
    notes: notes.map((n) => ({
      content: n.content,
      authorName: n.author?.name || 'Officer',
      createdAt: n.createdAt,
    })),
  };

  return snapshot;
};

/**
 * Ask Hybrid RAG AI Loan Officer Assistant.
 */
const askLoanAssistant = async (applicationId, question, conversationHistory = []) => {
  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw ApiError.badRequest('Question is required');
  }

  const applicantSnapshot = await buildApplicantSnapshot(applicationId);

  try {
    const payload = {
      application_id: applicationId,
      applicant_data: applicantSnapshot,
      question: question.trim(),
      conversation_history: (conversationHistory || []).map((m) => ({
        role: m.role || 'user',
        content: m.content || '',
      })),
    };

    const response = await axios.post(`${AI_SERVICE_URL}/api/loan-assistant`, payload, {
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Token': config.aiServiceToken,
      },
    });

    return response.data;
  } catch (error) {
    console.error('[AI Assistant Service Error]:', error.response?.data || error.message);
    if (error.response?.data?.detail) {
      throw ApiError.internal(`AI Service: ${error.response.data.detail}`);
    }
    throw ApiError.internal('Failed to get response from AI Loan Officer Assistant');
  }
};

/**
 * Retrieve bank policies from RAG knowledge base.
 */
const getBankPolicies = async () => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/api/policies`, {
      timeout: 10000,
      headers: { 'X-Internal-Token': config.aiServiceToken },
    });
    return response.data;
  } catch (error) {
    console.error('[Get Policies Error]:', error.message);
    throw ApiError.internal('Failed to retrieve bank policies');
  }
};

/**
 * Search bank policies.
 */
const searchBankPolicies = async (query, category, topK = 5) => {
  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}/api/policies/search`,
      { query, category, top_k: topK },
      {
        timeout: 10000,
        headers: { 'X-Internal-Token': config.aiServiceToken },
      }
    );
    return response.data;
  } catch (error) {
    console.error('[Search Policies Error]:', error.message);
    throw ApiError.internal('Failed to search bank policies');
  }
};

module.exports = {
  buildApplicantSnapshot,
  askLoanAssistant,
  getBankPolicies,
  searchBankPolicies,
};
