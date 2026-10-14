const mongoose = require('mongoose');
const LoanApplication = require('../models/LoanApplication');
const Activity = require('../models/Activity');
const Document = require('../models/Document');
const ValidationResult = require('../models/ValidationResult');
const applicationStore = require('../store/applicationStore');

/**
 * Applicant-facing notification feed.
 *
 * Everything here is derived from records that already exist — status activity,
 * officer document reviews and the cross-document verification result — so the
 * feed can never claim something the audit trail does not support.
 *
 * Only applicant-safe material is exposed: internal officer notes, LLM
 * recommendations and officer identities are deliberately left out. Verification
 * detail comes from the deterministic checks, which state plain facts about the
 * applicant's own documents.
 */

/** Short, plain-language label for each deterministic check. */
const CHECK_LABELS = {
  IDENTITY_NAME_MATCH: 'Name mismatch',
  DOB_CONSISTENCY: 'Date of birth mismatch',
  PAN_CONSISTENCY: 'PAN number mismatch',
  AADHAAR_VERIFICATION: 'Aadhaar not verified',
  EMPLOYER_CONSISTENCY: 'Employer name mismatch',
  DECLARED_VS_SLIP_INCOME: 'Declared income variance',
  SLIP_VS_BANK_SALARY: 'Salary variance',
  SLIP_VS_FORM16_INCOME: 'Form 16 income variance',
  EXISTING_EMI_BURDEN: 'Existing EMI burden',
};

const DOCUMENT_LABELS = {
  payment_slip: 'Payment slip',
  salary_slip: 'Salary slip',
  bank_statement: 'Bank statement',
  form16: 'Form 16',
  pan: 'PAN card',
  aadhaar: 'Aadhaar card',
  property_document: 'Property document',
  other: 'Document',
};

/** Copy for each status an applicant should hear about. */
const DECISION_COPY = {
  approved: {
    tone: 'positive',
    title: 'Loan approved',
    message: 'Your application cleared verification. The bank will reach out with sanction details.',
    actionRequired: false,
  },
  rejected: {
    tone: 'negative',
    title: 'Application declined',
    message: 'The bank could not proceed with this application.',
    actionRequired: false,
  },
  documents_required: {
    tone: 'warning',
    title: 'Documents required',
    message: 'An officer needs corrected or additional documents before the review can continue.',
    actionRequired: true,
  },
  under_review: {
    tone: 'info',
    title: 'Under review',
    message: 'Your application is with a verification officer.',
    actionRequired: false,
  },
  withdrawn: {
    tone: 'neutral',
    title: 'Application withdrawn',
    message: 'This application is no longer being processed.',
    actionRequired: false,
  },
};

const documentLabel = (type) => DOCUMENT_LABELS[type] || 'Document';

/** Keeps one-line reasons readable in a notification row. */
const shorten = (text, max = 160) => {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
};

const getApplicantNotifications = async (userId) => {
  let applications = [];
  if (mongoose.connection.readyState === 1) {
    try {
      applications = await LoanApplication.find({ applicant: userId })
        .select('loanType requestedAmount bankName bankId status createdAt updatedAt')
        .sort({ createdAt: -1 })
        .lean();
    } catch (err) {
      console.warn('[Notification] DB query failed:', err.message);
    }
  }

  const memApps = applicationStore.getApplicationsForUser(userId);
  const existingIds = new Set(applications.map((a) => String(a._id)));

  for (const ma of memApps) {
    if (!existingIds.has(String(ma._id))) {
      applications.unshift(ma);
    }
  }

  if (applications.length === 0) {
    return { notifications: [], counts: { total: 0, unresolvedIssues: 0, actionRequired: 0 } };
  }

  const ids = applications.map((app) => app._id);
  const appById = new Map(applications.map((app) => [String(app._id), app]));

  let activities = [];
  let documents = [];
  let validations = [];

  if (mongoose.connection.readyState === 1) {
    try {
      const validDbIds = ids.filter((id) => mongoose.Types.ObjectId.isValid(id));
      [activities, documents, validations] = await Promise.all([
        Activity.find({
          application: { $in: validDbIds },
          action: { $in: ['Status Changed', 'Document Rejected'] },
        })
          .sort({ createdAt: -1 })
          .limit(80)
          .lean(),
        Document.find({ application: { $in: validDbIds } })
          .select('application documentType originalName status reviewComment updatedAt')
          .lean(),
        ValidationResult.find({ application: { $in: validDbIds } })
          .select('application status riskLevel checks validatedAt')
          .lean(),
      ]);
    } catch (e) {
      console.warn('[Notification] Sub-queries failed:', e.message);
    }
  }

  // ── Per-application issue lists, derived from the deterministic checks ──
  const issuesByApp = new Map();
  validations.forEach((validation) => {
    const flagged = (validation.checks || [])
      .filter((check) => check.status === 'FLAGGED' || check.status === 'WARNING')
      .map((check) => ({
        code: check.type,
        label: CHECK_LABELS[check.type] || 'Verification issue',
        detail: shorten(check.message),
        severity: check.severity || (check.status === 'FLAGGED' ? 'HIGH' : 'MEDIUM'),
      }));
    // Highest severity first so the applicant reads the blocking problem first.
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    flagged.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));
    issuesByApp.set(String(validation.application), {
      issues: flagged,
      validatedAt: validation.validatedAt,
      riskLevel: validation.riskLevel,
    });
  });

  // ── Documents the officer sent back, per application ──
  const rejectedDocsByApp = new Map();
  documents.forEach((doc) => {
    if (doc.status !== 'rejected') return;
    const key = String(doc.application);
    if (!rejectedDocsByApp.has(key)) rejectedDocsByApp.set(key, []);
    rejectedDocsByApp.get(key).push({
      code: `doc:${doc.documentType}`,
      label: `${documentLabel(doc.documentType)} rejected`,
      detail: shorten(doc.reviewComment || 'The officer asked for this document to be re-uploaded.'),
      severity: 'HIGH',
    });
  });

  const reasonsFor = (applicationId) => {
    const issues = issuesByApp.get(applicationId)?.issues || [];
    const docs = rejectedDocsByApp.get(applicationId) || [];
    return [...docs, ...issues].slice(0, 5);
  };

  const appPayload = (application) => ({
    id: String(application._id),
    loanType: application.loanType,
    requestedAmount: application.requestedAmount,
    bankName: application.bankName,
    bankId: application.bankId,
    status: application.status,
  });

  const notifications = [];

  activities.forEach((activity) => {
    const applicationId = String(activity.application);
    const application = appById.get(applicationId);
    if (!application) return;

    if (activity.action === 'Status Changed') {
      const to = activity.details?.to;
      const copy = DECISION_COPY[to];
      if (!copy) return; // draft / documents_pending are the applicant's own doing

      const reasons = to === 'rejected' || to === 'documents_required' ? reasonsFor(applicationId) : [];

      notifications.push({
        id: `status-${activity._id}`,
        kind: 'decision',
        tone: copy.tone,
        title: copy.title,
        message: copy.message,
        status: to,
        reasons,
        actionRequired: copy.actionRequired && application.status === to,
        application: appPayload(application),
        createdAt: activity.createdAt,
      });
      return;
    }

    if (activity.action === 'Document Rejected') {
      const label = documentLabel(activity.details?.documentType);
      notifications.push({
        id: `doc-${activity._id}`,
        kind: 'document',
        tone: 'warning',
        title: `${label} needs re-upload`,
        message: shorten(
          activity.details?.reviewComment || 'The officer asked for a clearer copy of this document.'
        ),
        status: application.status,
        reasons: [],
        actionRequired: true,
        application: appPayload(application),
        createdAt: activity.createdAt,
      });
    }
  });

  // One verification digest per application that still has open findings, so the
  // applicant sees "why" even before an officer changes the status.
  const OPEN_STATUSES = new Set(['submitted', 'documents_pending', 'documents_required', 'under_review']);
  issuesByApp.forEach((entry, applicationId) => {
    const application = appById.get(applicationId);
    if (!application || entry.issues.length === 0) return;
    if (!OPEN_STATUSES.has(application.status)) return;

    const highest = entry.issues[0]?.severity === 'HIGH';
    notifications.push({
      id: `verify-${applicationId}`,
      kind: 'issue',
      tone: highest ? 'warning' : 'info',
      title:
        entry.issues.length === 1
          ? `Check flagged: ${entry.issues[0].label}`
          : `${entry.issues.length} checks flagged on your documents`,
      message: highest
        ? 'These need to be resolved before the bank can proceed.'
        : 'Minor variances an officer may ask you to clarify.',
      status: application.status,
      reasons: entry.issues.slice(0, 5),
      actionRequired: highest,
      application: appPayload(application),
      createdAt: entry.validatedAt || application.updatedAt,
    });
  });

  notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const capped = notifications.slice(0, 30);

  return {
    notifications: capped,
    counts: {
      total: capped.length,
      actionRequired: capped.filter((n) => n.actionRequired).length,
      unresolvedIssues: [...issuesByApp.entries()].filter(
        ([id, entry]) => entry.issues.length > 0 && OPEN_STATUSES.has(appById.get(id)?.status)
      ).length,
    },
  };
};

module.exports = {
  getApplicantNotifications,
  CHECK_LABELS,
};
