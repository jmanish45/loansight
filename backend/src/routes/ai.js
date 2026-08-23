const express = require('express');
const {
  queryLoanAssistant,
  getPolicies,
  searchPolicies,
} = require('../controllers/officerController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Routes protected for loan officers / admins.
// protect => must be authenticated; authorize => must hold an officer/admin role.
// Without the role gate, ANY authenticated applicant could query the AI loan
// assistant for ANY application id (BOLA/IDOR). Officers legitimately see all
// applications, so the assistant is restricted to them.
router.use(protect);
router.use(authorize('officer', 'admin'));

/**
 * @route   POST /api/ai/loan-assistant
 * @desc    Query Hybrid RAG + Applicant Data AI Loan Officer Assistant
 * @access  Private (Officer/Admin)
 */
router.post('/loan-assistant', queryLoanAssistant);

/**
 * @route   GET /api/ai/policies
 * @desc    Get all indexed bank policies from knowledge base
 * @access  Private
 */
router.get('/policies', getPolicies);

/**
 * @route   POST /api/ai/policies/search
 * @desc    Search policy knowledge base
 * @access  Private
 */
router.post('/policies/search', searchPolicies);

module.exports = router;
