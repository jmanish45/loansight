import { AVAILABLE_BANKS, LOAN_TYPE_DETAILS } from '../constants/banks';

/**
 * Shared officer-side lookups and derivations. Everything here is computed from
 * the real application payload — no placeholder metrics.
 */

/** Chip styling, legend colour and label for every application status. */
export const STATUS_META = {
  draft: { label: 'Draft', chip: 'bg-slate-100 text-slate-600', color: '#94A3B8' },
  submitted: { label: 'Submitted', chip: 'bg-navy-900/10 text-navy-800', color: '#163A5F' },
  documents_pending: {
    label: 'Documents Pending',
    chip: 'bg-slate-100 text-slate-600',
    color: '#CBD5E1',
  },
  documents_required: {
    label: 'Documents Required',
    chip: 'bg-red-50 text-red-600',
    color: '#EF4444',
  },
  under_review: { label: 'Under Review', chip: 'bg-amber-50 text-amber-600', color: '#F59E0B' },
  approved: { label: 'Approved', chip: 'bg-emerald-50 text-emerald-700', color: '#10B981' },
  rejected: { label: 'Rejected', chip: 'bg-red-50 text-red-700', color: '#B91C1C' },
  withdrawn: { label: 'Withdrawn', chip: 'bg-slate-100 text-slate-500', color: '#94A3B8' },
};

/** Never mislabels an unmapped status — humanises it instead. */
export function statusMeta(status) {
  if (STATUS_META[status]) return STATUS_META[status];
  const label = String(status || 'unknown')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return { label, chip: 'bg-slate-100 text-slate-500', color: '#94A3B8' };
}

/** Statuses that still need an officer to act. */
export const OPEN_STATUSES = ['submitted', 'documents_required', 'under_review'];

export function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '—';
  return parts
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

export function bankFor(application) {
  if (!application) return null;
  const byId = AVAILABLE_BANKS.find((b) => b.id === application.bankId);
  if (byId) return byId;
  const byName = AVAILABLE_BANKS.find((b) => b.name === application.bankName);
  return byName || null;
}

export function loanTypeFor(loanType) {
  if (!loanType) return null;
  return (
    LOAN_TYPE_DETAILS.find((t) => t.value === loanType) ||
    // 'auto' is the legacy key for vehicle loans.
    (loanType === 'auto' ? LOAN_TYPE_DETAILS.find((t) => t.value === 'vehicle') : null)
  );
}

export function loanTypeLabel(loanType) {
  const detail = loanTypeFor(loanType);
  if (detail) return detail.label;
  if (!loanType) return 'Loan';
  return String(loanType).replace(/^\w/, (c) => c.toUpperCase()) + ' Loan';
}

export function formatDate(value, lang) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const activeLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('loanlens_language') : null) || 'en';
  const locale = activeLang === 'mr' ? 'mr-IN' : activeLang === 'hi' ? 'hi-IN' : 'en-IN';
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** '3 days ago' style age, used to surface applications that have been waiting. */
export function daysWaiting(value, now = Date.now()) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now - date.getTime()) / 86400000);
  return days < 0 ? 0 : days;
}

export function waitingLabel(days) {
  if (days === null) return '';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

/** Count of documents in each review state for one application. */
export function docCounts(application) {
  const docs = Array.isArray(application?.documents) ? application.documents : [];
  // The list endpoint returns ObjectIds; the detail endpoint returns objects.
  const objects = docs.filter((d) => d && typeof d === 'object' && 'status' in d);
  return {
    total: docs.length,
    approved: objects.filter((d) => d.status === 'approved').length,
    rejected: objects.filter((d) => d.status === 'rejected').length,
    pending: objects.filter((d) => d.status === 'pending_review').length,
    detailed: objects.length > 0,
  };
}

/** Status mix across a list, ordered for the donut and legend. */
export function statusMix(applications) {
  const list = Array.isArray(applications) ? applications.filter(Boolean) : [];
  const counts = new Map();
  list.forEach((app) => {
    counts.set(app.status, (counts.get(app.status) || 0) + 1);
  });

  const order = [
    'submitted',
    'under_review',
    'documents_required',
    'documents_pending',
    'approved',
    'rejected',
    'withdrawn',
    'draft',
  ];

  return order
    .filter((status) => counts.get(status))
    .map((status) => ({
      status,
      count: counts.get(status),
      ...statusMeta(status),
    }));
}

/** Volume and value per loan type, largest first. */
export function loanTypeMix(applications) {
  const list = Array.isArray(applications) ? applications.filter(Boolean) : [];
  const rows = new Map();

  list.forEach((app) => {
    const key = app.loanType || 'other';
    const row = rows.get(key) || { key, label: loanTypeLabel(key), count: 0, amount: 0 };
    row.count += 1;
    row.amount += Number(app.requestedAmount) || 0;
    rows.set(key, row);
  });

  return [...rows.values()].sort((a, b) => b.count - a.count);
}

/** Headline numbers for the officer queue. */
export function queueSummary(applications) {
  const list = Array.isArray(applications) ? applications.filter(Boolean) : [];

  const open = list.filter((a) => OPEN_STATUSES.includes(a.status));
  const decided = list.filter((a) => a.status === 'approved' || a.status === 'rejected');
  const approved = list.filter((a) => a.status === 'approved');

  const openValue = open.reduce((sum, a) => sum + (Number(a.requestedAmount) || 0), 0);
  const totalValue = list
    .filter((a) => a.status !== 'withdrawn')
    .reduce((sum, a) => sum + (Number(a.requestedAmount) || 0), 0);

  const ages = open.map((a) => daysWaiting(a.createdAt)).filter((d) => d !== null);
  const oldestOpenDays = ages.length ? Math.max(...ages) : null;

  return {
    total: list.length,
    open: open.length,
    decided: decided.length,
    approved: approved.length,
    approvalRate: decided.length ? Math.round((approved.length / decided.length) * 100) : null,
    openValue,
    totalValue,
    oldestOpenDays,
    docsRequired: list.filter((a) => a.status === 'documents_required').length,
    submitted: list.filter((a) => a.status === 'submitted').length,
    underReview: list.filter((a) => a.status === 'under_review').length,
  };
}
