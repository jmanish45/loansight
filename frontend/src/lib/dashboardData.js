/**
 * Derivations over the real application / document / bank data.
 * Every function is total: no throws, safe on null, undefined and empty input.
 */
import { AVAILABLE_BANKS, LOAN_TYPE_DETAILS } from '../constants/banks';
import { getDocumentRequirements } from '../constants/mockData';
import { emiBreakdown, parseRate } from './loanMath';

const NEUTRAL_PILL = 'bg-slate-100 text-slate-600';

/** Applicant-facing presentation for every status in the backend enum. */
export const DASHBOARD_STATUS_META = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    pill: NEUTRAL_PILL,
    dot: 'bg-slate-300',
    blurb: 'Saved as a draft. Complete and submit it to start verification.',
  },
  submitted: {
    label: 'Submitted',
    tone: 'neutral',
    pill: 'bg-slate-100 text-slate-700',
    dot: 'bg-navy-700',
    blurb: 'Submitted. A loan officer will pick it up for review shortly.',
  },
  documents_pending: {
    label: 'Documents Pending',
    tone: 'attention',
    pill: 'bg-amber-50 text-amber-700',
    dot: 'bg-amber-500',
    blurb: 'Your documents have been received and are queued for verification.',
  },
  documents_required: {
    label: 'Documents Required',
    tone: 'negative',
    pill: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    blurb: 'Some documents need your attention — see Action Required below.',
  },
  under_review: {
    label: 'Under Review',
    tone: 'neutral',
    pill: 'bg-slate-100 text-slate-700',
    dot: 'bg-navy-700',
    blurb: 'Under review by the credit team. No action needed from you right now.',
  },
  approved: {
    label: 'Approved',
    tone: 'positive',
    pill: 'bg-emerald-50 text-emerald-700',
    dot: 'bg-emerald-500',
    blurb: 'Approved. Our team will contact you with the next steps.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'negative',
    pill: 'bg-red-50 text-red-700',
    dot: 'bg-red-500',
    blurb: 'Not approved at this time. You may start a fresh application.',
  },
  withdrawn: {
    label: 'Withdrawn',
    tone: 'neutral',
    pill: NEUTRAL_PILL,
    dot: 'bg-slate-300',
    blurb: 'This application has been withdrawn.',
  },
};

/** Known status metadata, or an honest humanised fallback for anything unknown. */
export function statusMeta(status) {
  if (status && DASHBOARD_STATUS_META[status]) return DASHBOARD_STATUS_META[status];
  const raw = String(status || 'unknown').replace(/_/g, ' ');
  const label = raw.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    label,
    tone: 'neutral',
    pill: NEUTRAL_PILL,
    dot: 'bg-slate-300',
    blurb: `Current status: ${raw}.`,
  };
}

/** Matching AVAILABLE_BANKS entry by id, then by name. null when unmatched. */
export function getBank(application) {
  if (!application) return null;
  const byId = AVAILABLE_BANKS.find((b) => b.id === application.bankId);
  if (byId) return byId;
  const name = String(application.bankName || '').trim().toLowerCase();
  if (!name) return null;
  return AVAILABLE_BANKS.find((b) => b.name.toLowerCase() === name) || null;
}

/** LOAN_TYPE_DETAILS entry, treating the legacy 'auto' key as 'vehicle'. */
export function getLoanTypeDetail(loanType) {
  if (!loanType) return null;
  const key = loanType === 'auto' ? 'vehicle' : loanType;
  return LOAN_TYPE_DETAILS.find((d) => d.value === key) || null;
}

/** Statuses where the applicant's file is live with the bank. */
export const ACTIVE_STATUSES = [
  'submitted',
  'documents_pending',
  'documents_required',
  'under_review',
];

/** True when the application is live with the bank. */
export function isActive(status) {
  return ACTIVE_STATUSES.includes(status);
}

/** Required-vs-uploaded document position for one application. */
export function docReadiness(application) {
  const empty = {
    required: 0,
    uploadedCount: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    missing: [],
    percent: 100,
  };
  if (!application) return { ...empty, percent: 0 };

  const requirements = getDocumentRequirements(application.loanType) || [];
  const documents = Array.isArray(application.documents) ? application.documents : [];

  const approved = documents.filter((d) => d?.status === 'approved').length;
  const rejected = documents.filter((d) => d?.status === 'rejected').length;
  const pending = documents.filter((d) => d?.status === 'pending_review').length;

  const usableDocs = documents.filter((d) => d && d.status !== 'rejected' && d.status !== 'superseded');
  const missing = requirements.filter((req) => {
    const rt = (req?.type || '').toLowerCase().replace(/[-_ ]/g, '');
    return !usableDocs.some((d) => {
      const dt = (d?.documentType || '').toLowerCase().replace(/[-_ ]/g, '');
      const pred = (d?.aiProcessing?.predictedType || '').toLowerCase().replace(/[-_ ]/g, '');
      return (
        dt === rt ||
        pred === rt ||
        (rt.includes('form16') && (dt.includes('form16') || pred.includes('form16') || dt.includes('itr')))
      );
    });
  });

  const required = requirements.length;
  const satisfied = required - missing.length;
  const percent = required === 0 ? 100 : Math.round((satisfied / required) * 100);

  return {
    required,
    uploadedCount: usableDocs.length,
    approved,
    rejected,
    pending,
    missing,
    percent,
  };
}

/** Aggregate readiness across active applications only. */
export function portfolioReadiness(applications) {
  const list = Array.isArray(applications) ? applications.filter((a) => a && isActive(a.status)) : [];
  if (list.length === 0) {
    return { required: 0, uploadedCount: 0, percent: 0, missingCount: 0 };
  }

  let required = 0;
  let uploadedCount = 0;
  let missingCount = 0;

  list.forEach((app) => {
    const r = docReadiness(app);
    required += r.required;
    uploadedCount += r.uploadedCount;
    missingCount += r.missing.length;
  });

  const satisfied = Math.max(0, required - missingCount);
  const percent = required === 0 ? 0 : Math.round((satisfied / required) * 100);

  return { required, uploadedCount, percent, missingCount };
}

/** Headline counts across the whole portfolio. */
export function portfolioSummary(applications) {
  const list = Array.isArray(applications) ? applications.filter(Boolean) : [];

  const active = list.filter((a) => isActive(a.status)).length;
  const approved = list.filter((a) => a.status === 'approved').length;
  const rejected = list.filter((a) => a.status === 'rejected').length;
  const drafts = list.filter((a) => a.status === 'draft').length;

  const totalRequested = list
    .filter((a) => a.status !== 'withdrawn')
    .reduce((sum, a) => sum + (Number(a.requestedAmount) || 0), 0);

  const actionRequired = list.reduce(
    (sum, a) =>
      sum + (Array.isArray(a.documents) ? a.documents.filter((d) => d?.status === 'rejected').length : 0),
    0
  );

  const latest = list.length
    ? [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0]
    : null;

  return { total: list.length, active, approved, rejected, drafts, totalRequested, actionRequired, latest };
}

/** Five-step journey derived from status plus real upload counts. */
export function journeySteps(application) {
  if (!application) return [];

  const status = application.status;
  const readiness = docReadiness(application);
  const submitted = ['submitted', 'documents_pending', 'documents_required', 'under_review', 'approved', 'rejected'].includes(status);
  const decided = status === 'approved' || status === 'rejected';

  const docsHint =
    readiness.required === 0
      ? 'No documents required'
      : `${Math.max(0, readiness.required - readiness.missing.length)} of ${readiness.required} uploaded`;

  let docsState;
  if (readiness.rejected > 0 || status === 'documents_required') docsState = 'blocked';
  else if (readiness.percent === 100 && readiness.required > 0) docsState = 'complete';
  else if (status === 'draft') docsState = 'current';
  else docsState = 'current';

  let reviewState;
  if (decided) reviewState = 'complete';
  else if (status === 'under_review') reviewState = 'current';
  else if (submitted) reviewState = 'pending';
  else reviewState = 'pending';

  return [
    {
      key: 'created',
      label: 'Application Created',
      hint: application.createdAt
        ? new Date(application.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })
        : '',
      state: 'complete',
    },
    {
      key: 'documents',
      label: 'Documents Uploaded',
      hint: docsHint,
      state: docsState,
    },
    {
      key: 'submitted',
      label: 'Submitted for Review',
      hint: submitted ? 'Received by the bank' : 'Submit once your documents are in',
      state: submitted ? 'complete' : 'pending',
    },
    {
      key: 'review',
      label: 'Under Officer Review',
      hint:
        readiness.approved > 0
          ? `${readiness.approved} document${readiness.approved === 1 ? '' : 's'} verified`
          : 'Verification by the credit team',
      state: reviewState,
    },
    {
      key: 'decision',
      label: 'Decision Issued',
      hint: decided ? statusMeta(status).label : 'Awaiting decision',
      state: decided ? 'complete' : 'pending',
    },
  ];
}

/** EMI estimate at the bank's published starting rate. null when no rate is knowable. */
export function emiEstimate(application) {
  if (!application) return null;

  const bank = getBank(application);
  const detail = getLoanTypeDetail(application.loanType);

  let ratePct = parseRate(bank?.minRate);
  let rateSource = bank ? `${bank.name} starting rate` : null;

  if (ratePct === null && detail) {
    ratePct = parseRate(detail.rateRange);
    rateSource = `${detail.label} published range`;
  }
  if (ratePct === null) return null;

  const breakdown = emiBreakdown(application.requestedAmount, ratePct, application.tenureMonths);
  if (!breakdown) return null;

  return { ...breakdown, ratePct, rateSource };
}

/**
 * Applicant-facing view of the AI verification result for one application.
 * Reads the backend `verification` summary attached in getUserApplications.
 * null when the application has not been verified yet.
 */
export function verificationSnapshot(application) {
  const v = application?.verification;
  if (!v || typeof v.score !== 'number' || !Number.isFinite(v.score)) return null;

  const score = Math.max(0, Math.min(100, Math.round(v.score)));
  const band = score >= 75 ? 'strong' : score >= 50 ? 'moderate' : 'weak';

  return {
    score,
    band,
    riskLevel: v.riskLevel || null,
    status: v.status || null,
    checksTotal: Number.isFinite(v.checksTotal) ? v.checksTotal : 0,
    checksPassed: Number.isFinite(v.checksPassed) ? v.checksPassed : 0,
    checksFlagged: Number.isFinite(v.checksFlagged) ? v.checksFlagged : 0,
    checksWarnings: Number.isFinite(v.checksWarnings) ? v.checksWarnings : 0,
  };
}
/** Partner banks sorted by advertised starting rate, lowest first. */
export function rateComparison() {
  return AVAILABLE_BANKS.map((b) => ({
    id: b.id,
    shortName: b.shortName,
    name: b.name,
    minRate: b.minRate,
    ratePct: parseRate(b.minRate),
  }))
    .filter((b) => b.ratePct !== null)
    .sort((a, b) => a.ratePct - b.ratePct);
}
