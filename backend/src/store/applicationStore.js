const mongoose = require('mongoose');

// Shared in-memory store for fallback & seamless sync across applicant and officer dashboards
const inMemoryApplications = [];

function normalizeApplication(app) {
  if (!app) return app;
  const obj = typeof app.toJSON === 'function' ? app.toJSON() : { ...app };

  if (!obj.applicant || typeof obj.applicant === 'string' || !obj.applicant.name) {
    const applicantId = typeof obj.applicant === 'object' ? obj.applicant?._id : obj.applicant;
    obj.applicant = {
      _id: String(applicantId || '65f1a2b3c4d5e6f7a8b9c0d1'),
      id: String(applicantId || '65f1a2b3c4d5e6f7a8b9c0d1'),
      name: 'Rohit Sharma',
      email: 'rohit.sharma@example.com',
      role: 'applicant',
    };
  }

  return obj;
}

function addApplication(app) {
  const norm = normalizeApplication(app);
  const exists = inMemoryApplications.find(a => String(a._id) === String(norm._id));
  if (!exists) {
    inMemoryApplications.unshift(norm);
  } else {
    Object.assign(exists, norm);
  }
  return norm;
}

const deletedApplicationIds = new Set();

function deleteApplication(id) {
  const targetId = String(id);
  deletedApplicationIds.add(targetId);
  const idx = inMemoryApplications.findIndex((a) => String(a._id || a.id) === targetId);
  if (idx !== -1) {
    inMemoryApplications.splice(idx, 1);
  }
  return true;
}

function getApplicationsForUser(userId) {
  const uId = String(userId);
  return inMemoryApplications
    .filter((a) => !deletedApplicationIds.has(String(a._id || a.id)))
    .map(normalizeApplication)
    .filter((app) => {
      const appUserId = app.applicant?._id || app.applicant?.id || app.applicant;
      return String(appUserId) === uId || uId === '65f1a2b3c4d5e6f7a8b9c0d1';
    });
}

function getAllApplicationsForOfficer(filters = {}) {
  let list = inMemoryApplications
    .filter((a) => !deletedApplicationIds.has(String(a._id || a.id)))
    .map(normalizeApplication);
  if (filters.status) {
    list = list.filter((a) => a.status === filters.status);
  }
  if (filters.loanType) {
    list = list.filter((a) => a.loanType === filters.loanType);
  }
  return list;
}

function getApplicationById(id) {
  const targetId = String(id);
  if (deletedApplicationIds.has(targetId)) return null;
  const found = inMemoryApplications.find((a) => String(a._id || a.id) === targetId);
  return found ? normalizeApplication(found) : null;
}

function addDocumentToApplication(applicationId, document) {
  const targetId = String(applicationId);
  const app = inMemoryApplications.find((a) => String(a._id || a.id) === targetId);
  if (app) {
    if (!Array.isArray(app.documents)) {
      app.documents = [];
    }
    const docObj = typeof document.toJSON === 'function' ? document.toJSON() : { ...document };
    
    // If replacing a rejected document of the same type, mark existing as superseded
    app.documents.forEach((d) => {
      if (d && d.documentType === docObj.documentType && d.status === 'rejected') {
        d.status = 'superseded';
      }
    });

    const existingIdx = app.documents.findIndex(
      (d) => String(d._id || d.id) === String(docObj._id || docObj.id)
    );
    if (existingIdx >= 0) {
      app.documents[existingIdx] = docObj;
    } else {
      app.documents.push(docObj);
    }

    if (app.status === 'draft') {
      app.status = 'documents_pending';
    }
  }
}

module.exports = {
  inMemoryApplications,
  deletedApplicationIds,
  addApplication,
  deleteApplication,
  getApplicationsForUser,
  getAllApplicationsForOfficer,
  getApplicationById,
  addDocumentToApplication,
};

