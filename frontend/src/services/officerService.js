import api from './api';

export const officerService = {
  getDashboardStats: () => api.get('/officer/dashboard'),
  
  getApplications: (params) => api.get('/officer/applications', { params }),
  
  getApplicationById: (id) => api.get(`/officer/applications/${id}`),

  updateApplicationStatus: (id, status, reason) => api.patch(`/officer/applications/${id}/status`, { status, reason }),

  deleteApplication: (id) => api.delete(`/officer/applications/${id}`),

  downloadDocument: (docId) => api.get(`/officer/documents/${docId}/download`, { responseType: 'blob' }),

  viewDocument: (docId) => api.get(`/officer/documents/${docId}/view`, { responseType: 'blob' }),

  reviewDocument: (docId, status, reviewComment) => api.patch(`/officer/documents/${docId}/review`, { status, reviewComment }),

  addNote: (id, content) => api.post(`/officer/applications/${id}/notes`, { content }),

  getNotes: (id) => api.get(`/officer/applications/${id}/notes`),

  getActivity: (id) => api.get(`/officer/applications/${id}/activity`),

  // AI Document Intelligence
  getDocumentAnalysis: (docId) => api.get(`/officer/documents/${docId}/analysis`),

  reprocessDocument: (docId) => api.post(`/officer/documents/${docId}/reprocess`),
  
  getApplicationValidation: (id) => api.get(`/officer/applications/${id}/validation`),
  triggerVerification: (id) => api.post(`/officer/applications/${id}/verify`),

  // Hybrid RAG AI Loan Officer Assistant
  askLoanAssistant: (applicationId, question, conversationHistory = []) =>
    api.post('/ai/loan-assistant', { applicationId, question, conversationHistory }),
  
  getBankPolicies: () => api.get('/ai/policies'),
  searchBankPolicies: (query, category, topK = 5) =>
    api.post('/ai/policies/search', { query, category, topK }),
};
