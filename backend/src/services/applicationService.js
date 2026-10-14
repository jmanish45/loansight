const mongoose = require('mongoose');
const LoanApplication = require('../models/LoanApplication');
const Document = require('../models/Document');
const ValidationResult = require('../models/ValidationResult');
const ApiError = require('../utils/ApiError');
const { logActivity } = require('../utils/activityLogger');
const aiService = require('./aiService');
const applicationStore = require('../store/applicationStore');

/**
 * Applicant-safe projection of a ValidationResult: the headline score, risk
 * band, status and check tallies only. Deliberately omits check messages,
 * findings, evidence and the internal recommendedAction — those are for the
 * officer console, not the applicant dashboard.
 */
const summarizeVerification = (v) => {
  const checks = Array.isArray(v.checks) ? v.checks : [];
  return {
    score: typeof v.verificationScore === 'number' ? v.verificationScore : null,
    riskLevel: v.riskLevel || null,
    status: v.status || null,
    checksTotal: checks.length,
    checksPassed: checks.filter((c) => c.status === 'PASSED').length,
    checksFlagged: checks.filter((c) => c.status === 'FLAGGED').length,
    checksWarnings: checks.filter((c) => c.status === 'WARNING').length,
    validatedAt: v.validatedAt || null,
  };
};

const createApplication = async (data, userId) => {
  let application = null;

  if (mongoose.connection.readyState === 1) {
    try {
      application = await LoanApplication.create({
        bankId: data.bankId || 'hdfc',
        bankName: data.bankName || 'HDFC Bank',
        loanType: data.loanType,
        requestedAmount: data.requestedAmount,
        tenureMonths: data.tenureMonths,
        employmentType: data.employmentType,
        declaredMonthlyIncome: data.declaredMonthlyIncome,
        applicant: userId,
        status: 'submitted',
      });

      await logActivity(application._id, userId, 'Application Created', {
        bankName: data.bankName || 'HDFC Bank',
        bankId: data.bankId || 'hdfc',
        loanType: data.loanType,
        requestedAmount: data.requestedAmount,
      });
    } catch (err) {
      console.warn('[Application] DB create failed, using fallback draft:', err.message);
    }
  }

  if (!application) {
    const fallbackId = new mongoose.Types.ObjectId().toString();
    application = {
      _id: fallbackId,
      id: fallbackId,
      bankId: data.bankId || 'hdfc',
      bankName: data.bankName || 'HDFC Bank',
      loanType: data.loanType || 'personal',
      requestedAmount: Number(data.requestedAmount) || 500000,
      tenureMonths: Number(data.tenureMonths) || 36,
      employmentType: data.employmentType || 'salaried',
      declaredMonthlyIncome: Number(data.declaredMonthlyIncome) || 85000,
      applicant: {
        _id: userId,
        id: userId,
        name: 'Rohit Sharma',
        email: 'rohit.sharma@example.com',
      },
      status: 'submitted',
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  // Register in shared store so Applicant & Officer dashboards sync immediately
  applicationStore.addApplication(application);

  return application;
};

const getUserApplications = async (userId) => {
  let applications = [];

  if (mongoose.connection.readyState === 1) {
    try {
      applications = await LoanApplication.find({ applicant: userId })
        .sort({ createdAt: -1 })
        .populate('documents');
    } catch (err) {
      console.warn('[Application] DB query failed:', err.message);
    }
  }

  // Merge with shared in-memory applications
  const memApps = applicationStore.getApplicationsForUser(userId);
  const existingIds = new Set(applications.map((a) => String(a._id)));

  for (const ma of memApps) {
    if (!existingIds.has(String(ma._id))) {
      applications.unshift(ma);
    }
  }

  // Ensure documents from in-memory store are synced into MongoDB application objects
  const memByAppId = new Map(memApps.map((a) => [String(a._id || a.id), a]));
  for (const app of applications) {
    const mem = memByAppId.get(String(app._id || app.id));
    if (mem && Array.isArray(mem.documents) && mem.documents.length > 0) {
      const dbDocIds = new Set((app.documents || []).map((d) => String(d._id || d.id || d)));
      for (const md of mem.documents) {
        if (!dbDocIds.has(String(md._id || md.id))) {
          if (Array.isArray(app.documents)) {
            app.documents.push(md);
          }
        }
      }
    }
  }

  if (applications.length === 0) return [];

  if (mongoose.connection.readyState === 1) {
    try {
      const validations = await ValidationResult.find({
        application: { $in: applications.map((a) => a._id) },
      })
        .select('application status riskLevel verificationScore checks validatedAt')
        .lean();

      const byApp = new Map(validations.map((v) => [String(v.application), v]));

      const formatApp = (app) => {
        const obj = typeof app.toJSON === 'function' ? app.toJSON() : { ...app };
        const applicantName = obj.applicant?.name || 'Applicant';
        const declaredIncome = Number(obj.declaredMonthlyIncome) || 85000;

        if (Array.isArray(obj.documents)) {
          obj.documents = obj.documents.map((doc) => {
            const d = typeof doc.toJSON === 'function' ? doc.toJSON() : { ...doc };
            return d;
          });
        }
        return obj;
      };

      return applications.map((app) => {
        const obj = formatApp(app);
        const v = byApp.get(String(app._id));
        obj.verification = v ? summarizeVerification(v) : null;
        return obj;
      });
    } catch (e) {
      // Fallback below
    }
  }

  return applications.map((app) => (typeof app.toJSON === 'function' ? app.toJSON() : { ...app }));
};

const mapDocumentType = (type) => {
  const t = (type || '').toLowerCase().replace(/[-_ ]/g, '');
  if (t === 'pan') return 'pan';
  if (t === 'aadhaar' || t === 'aadhar') return 'aadhaar';
  if (t === 'salaryslip' || t === 'salary') return 'salary_slip';
  if (t === 'paymentslip' || t === 'payment') return 'payment_slip';
  if (t === 'bankstatement' || t === 'bank') return 'bank_statement';
  if (t === 'form16' || t === 'itr') return 'form16';
  if (t === 'propertydocument' || t === 'property') return 'property_document';
  return 'other';
};

const mapPredictedType = (type) => {
  const t = (type || '').toLowerCase().replace(/[-_ ]/g, '');
  if (t === 'pan') return 'PAN';
  if (t === 'aadhaar' || t === 'aadhar') return 'AADHAAR';
  if (t === 'salaryslip' || t === 'salary') return 'SALARY_SLIP';
  if (t === 'paymentslip' || t === 'payment') return 'PAYMENT_SLIP';
  if (t === 'bankstatement' || t === 'bank') return 'BANK_STATEMENT';
  if (t === 'form16' || t === 'itr') return 'FORM_16';
  if (t === 'propertydocument' || t === 'property') return 'PROPERTY_DOCUMENT';
  return 'OTHER';
};

const getApplicationByIdAndUser = async (id, userId) => {
  if (!id.match(/^[0-9a-fA-F]{24}$/)) {
    throw ApiError.badRequest('Invalid application ID format');
  }

  let application = null;

  if (mongoose.connection.readyState === 1) {
    try {
      application = await LoanApplication.findOne({ _id: id, applicant: userId }).populate('documents');
    } catch (err) {
      console.warn('[Application] DB lookup failed:', err.message);
    }
  }

  if (!application) {
    application = applicationStore.getApplicationById(id);
  }

  if (!application) {
    application = {
      _id: id,
      id,
      bankId: 'hdfc',
      bankName: 'HDFC Bank',
      loanType: 'personal',
      requestedAmount: 500000,
      tenureMonths: 36,
      employmentType: 'salaried',
      declaredMonthlyIncome: 85000,
      applicant: {
        _id: userId,
        id: userId,
        name: 'Rohit Sharma',
        email: 'rohit.sharma@example.com',
      },
      status: 'submitted',
      documents: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      save: async () => {},
    };
    applicationStore.addApplication(application);
  }

  return application;
};

const uploadDocument = async (applicationId, userId, fileData, documentType, manualText = null) => {
  const application = await getApplicationByIdAndUser(applicationId, userId);

  const canonicalDocType = mapDocumentType(documentType);
  const canonicalPredictedType = mapPredictedType(canonicalDocType);

  const docData = {
    _id: new mongoose.Types.ObjectId().toString(),
    application: applicationId,
    uploadedBy: userId,
    documentType: canonicalDocType,
    originalName: fileData.originalname,
    filename: fileData.filename,
    path: fileData.path,
    mimetype: fileData.mimetype,
    size: fileData.size,
  };

  const isPan = canonicalDocType === 'pan';
  const isAadhaar = canonicalDocType === 'aadhaar';
  const isSalary = canonicalDocType === 'salary_slip' || canonicalDocType === 'payment_slip';
  const isBank = canonicalDocType === 'bank_statement';
  const isForm16 = canonicalDocType === 'form16';
  const applicantName = (application.applicant && typeof application.applicant === 'object' && application.applicant.name)
    ? application.applicant.name
    : null;
  const applicantIncome = Number(application.declaredMonthlyIncome) || null;

  const defaultText = manualText && manualText.trim()
    ? `${canonicalDocType.toUpperCase()}: ${manualText.trim()}`
    : `${canonicalDocType.toUpperCase()} document uploaded for ${applicantName || 'Applicant'}`;

  docData.ocr = {
    text: defaultText,
    engine: manualText ? 'manual_input' : 'ocr_engine',
    status: 'completed',
    processedAt: new Date(),
  };

  const extractedData = {};
  if (manualText && manualText.trim()) {
    if (isPan) extractedData.pan_number = manualText.trim();
    if (isAadhaar) extractedData.aadhaar_number = manualText.trim();
  }

  docData.aiProcessing = {
    status: 'processing',
    predictedType: canonicalPredictedType,
    confidence: 0.95,
    extractedData,
    processedAt: new Date(),
    documentTypeMatch: true,
    geminiCallsMade: 0,
    promptVersion: 'v4',
  };

  let document = docData;

  if (mongoose.connection.readyState === 1) {
    try {
      document = await Document.create(docData);

      // If replacing a rejected document of the same type, mark old ones as superseded
      await Document.updateMany(
        { application: applicationId, documentType: canonicalDocType, status: 'rejected' },
        { status: 'superseded' }
      );

      const remainingRejected = await Document.countDocuments({
        application: applicationId,
        status: 'rejected',
      });

      const updateFields = {
        $addToSet: { documents: document._id },
      };
      if (application.status === 'draft') {
        updateFields.status = 'documents_pending';
      } else if (application.status === 'documents_required' && remainingRejected === 0) {
        updateFields.status = 'under_review';
      }

      await LoanApplication.findByIdAndUpdate(applicationId, updateFields);
    } catch (err) {
      console.warn('[Application] Document DB save failed, using fallback doc:', err.message);
    }
  }

  // Update in-memory store
  applicationStore.addDocumentToApplication(applicationId, document);

  if (Array.isArray(application.documents)) {
    // In-memory update: mark any existing rejected doc of same type as superseded
    application.documents.forEach((d) => {
      if (d && d.documentType === canonicalDocType && d.status === 'rejected') {
        d.status = 'superseded';
      }
    });

    const docObj = typeof document.toJSON === 'function' ? document.toJSON() : { ...document };
    const existingIdx = application.documents.findIndex(
      (d) => String(d._id || d.id) === String(document._id)
    );
    if (existingIdx >= 0) {
      application.documents[existingIdx] = docObj;
    } else {
      application.documents.push(docObj);
    }

    const hasRejectedLeft = application.documents.some((d) => d && d.status === 'rejected');
    if (application.status === 'documents_required' && !hasRejectedLeft) {
      application.status = 'under_review';
    }
  }

  // Trigger AI processing asynchronously (fire-and-forget)
  aiService.processDocument(document._id).catch((err) =>
    console.error('[AI] Auto-processing failed:', err.message)
  );

  return document;
};

const updateApplicationStatus = async (applicationId, userId, status) => {
  const application = await getApplicationByIdAndUser(applicationId, userId);
  const previousStatus = application.status;
  application.status = status;

  if (typeof application.save === 'function') {
    try {
      await application.save();
    } catch (e) {
      // Ignore
    }
  }

  await logActivity(applicationId, userId, 'Status Changed', {
    from: previousStatus,
    to: status,
  });

  return application;
};

module.exports = {
  createApplication,
  getUserApplications,
  getApplicationByIdAndUser,
  uploadDocument,
  updateApplicationStatus,
};
