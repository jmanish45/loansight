const officerService = require('../services/officerService');
const validationService = require('../services/validationService');
const ValidationResult = require('../models/ValidationResult');
const aiService = require('../services/aiService');
const aiAssistantService = require('../services/aiAssistantService');
const Document = require('../models/Document');
const path = require('path');
const fs = require('fs');

const getApplications = async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.loanType) filters.loanType = req.query.loanType;

    const applications = await officerService.getAllApplications(filters);
    res.json({ success: true, data: applications });
  } catch (error) {
    next(error);
  }
};

const getApplication = async (req, res, next) => {
  try {
    const application = await officerService.getApplicationById(req.params.id);
    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status, reason } = req.body;
    const application = await officerService.updateApplicationStatus(req.params.id, status, req.user._id, reason);
    res.json({ success: true, data: application });
  } catch (error) {
    next(error);
  }
};

const downloadDocument = async (req, res, next) => {
  try {
    const document = await officerService.getDocumentForDownload(req.params.docId);

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.download(document.path, document.originalName);
  } catch (error) {
    next(error);
  }
};

const viewDocument = async (req, res, next) => {
  try {
    const document = await officerService.getDocumentForDownload(req.params.docId);

    if (!fs.existsSync(document.path)) {
      return res.status(404).json({ success: false, message: 'File not found on server' });
    }

    res.setHeader('Content-Type', document.mimetype);
    res.setHeader('Content-Disposition', `inline; filename="${document.originalName}"`);
    res.sendFile(path.resolve(document.path));
  } catch (error) {
    next(error);
  }
};

const reviewDocument = async (req, res, next) => {
  try {
    const { status, reviewComment } = req.body;
    const document = await officerService.updateDocumentReview(
      req.params.docId,
      status,
      reviewComment,
      req.user._id
    );
    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const dashboardData = await officerService.getDashboardStats();
    res.json({ success: true, data: dashboardData });
  } catch (error) {
    next(error);
  }
};

const addNote = async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }
    const note = await officerService.addNote(req.params.id, req.user._id, content.trim());
    res.status(201).json({ success: true, data: note });
  } catch (error) {
    next(error);
  }
};

const getNotes = async (req, res, next) => {
  try {
    const notes = await officerService.getNotes(req.params.id);
    res.json({ success: true, data: notes });
  } catch (error) {
    next(error);
  }
};

const getActivity = async (req, res, next) => {
  try {
    const activity = await officerService.getActivity(req.params.id);
    res.json({ success: true, data: activity });
  } catch (error) {
    next(error);
  }
};

const getDocumentAnalysis = async (req, res, next) => {
  try {
    const document = await Document.findById(req.params.docId);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    res.json({
      success: true,
      data: {
        documentId: document._id,
        originalName: document.originalName,
        documentType: document.documentType,
        aiProcessing: document.aiProcessing || { status: 'pending' },
      },
    });
  } catch (error) {
    next(error);
  }
};

const triggerReprocess = async (req, res, next) => {
  try {
    const document = await aiService.reprocessDocument(req.params.docId);
    res.json({
      success: true,
      data: {
        documentId: document._id,
        aiProcessing: document.aiProcessing,
      },
      message: 'Reprocessing triggered',
    });
  } catch (error) {
    next(error);
  }
};

const deleteApplication = async (req, res, next) => {
  try {
    await officerService.deleteApplication(req.params.id, req.user._id);
    res.json({ success: true, message: 'Application archived successfully' });
  } catch (error) {
    next(error);
  }
};

const getApplicationValidation = async (req, res, next) => {
  try {
    const validation = await ValidationResult.findOne({ application: req.params.id });
    if (!validation) {
      return res.json({ status: 'PENDING_DOCS', checks: [], findings: [] });
    }
    res.json(validation);
  } catch (error) {
    next(error);
  }
};

const triggerVerification = async (req, res, next) => {
  try {
    const validation = await validationService.runValidation(req.params.id);
    res.json(validation);
  } catch (error) {
    next(error);
  }
};

const queryLoanAssistant = async (req, res, next) => {
  try {
    const applicationId = req.params.id || req.body.applicationId;
    const { question, conversationHistory } = req.body;

    if (!applicationId) {
      return res.status(400).json({ success: false, message: 'applicationId is required' });
    }
    if (!question) {
      return res.status(400).json({ success: false, message: 'question is required' });
    }

    const assistantResult = await aiAssistantService.askLoanAssistant(
      applicationId,
      question,
      conversationHistory || []
    );

    res.json({
      success: true,
      data: assistantResult,
    });
  } catch (error) {
    next(error);
  }
};

const getPolicies = async (req, res, next) => {
  try {
    const result = await aiAssistantService.getBankPolicies();
    res.json({ success: true, data: result.policies || [] });
  } catch (error) {
    next(error);
  }
};

const searchPolicies = async (req, res, next) => {
  try {
    const { query, category, topK } = req.body;
    const result = await aiAssistantService.searchBankPolicies(query, category, topK || 5);
    res.json({ success: true, data: result.results || [] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getApplications,
  getApplication,
  updateStatus,
  downloadDocument,
  reviewDocument,
  getDashboardStats,
  addNote,
  getNotes,
  getActivity,
  getDocumentAnalysis,
  triggerReprocess,
  getApplicationValidation,
  triggerVerification,
  deleteApplication,
  viewDocument,
  queryLoanAssistant,
  getPolicies,
  searchPolicies,
};
