import { useState, useMemo } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Search, Trash2, ArrowRight, X, SlidersHorizontal, Clock } from 'lucide-react';
import { officerService } from '../../services/officerService';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { useLanguage } from '../../context/LanguageContext';
import BankLogo from '../../components/common/BankLogo';
import StatusBadge from '../../components/common/StatusBadge';
import { ROUTES } from '../../constants/routes';
import { LOAN_TYPE_DETAILS } from '../../constants/banks';
import {
  statusMeta,
  initialsOf,
  bankFor,
  loanTypeLabel,
  daysWaiting,
  waitingLabel,
  formatDate,
} from '../../lib/officerData';
import { translateStatus, translateLoanType } from '../../constants/translations';
import { formatINR, formatINRCompact } from '../../lib/loanMath';

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

/** Statuses the officer list can contain — drafts never reach this endpoint. */
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'documents_required', label: 'Documents Required' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export default function ApplicationsList() {
  const { applications, loading, removeApplication } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const confirm = useConfirm();
  const { t } = useLanguage();

  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deletingId, setDeletingId] = useState(null);

  // The status filter lives in the URL so sidebar queue links stay in sync.
  const statusFilter = params.get('status') || '';

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(params);
    if (value) next.set('status', value);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  const counts = useMemo(() => {
    const map = new Map();
    applications.forEach((app) => map.set(app.status, (map.get(app.status) || 0) + 1));
    return map;
  }, [applications]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return applications.filter((app) => {
      const matchesSearch =
        term === '' ||
        app.applicant?.name?.toLowerCase().includes(term) ||
        app.applicant?.email?.toLowerCase().includes(term) ||
        String(app._id).toLowerCase().includes(term);
      const matchesStatus = statusFilter ? app.status === statusFilter : true;
      const matchesType = typeFilter ? app.loanType === typeFilter : true;
      return matchesSearch && matchesStatus && matchesType;
    });
  }, [applications, searchTerm, statusFilter, typeFilter]);

  const filteredValue = useMemo(
    () => filtered.reduce((sum, app) => sum + (Number(app.requestedAmount) || 0), 0),
    [filtered]
  );

  const hasFilters = Boolean(searchTerm || statusFilter || typeFilter);

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('');
    setStatusFilter('');
  };

  const handleDelete = async (app) => {
    const ok = await confirm({
      title: 'Delete this application?',
      message:
        'The application and every document uploaded against it will be permanently removed. This cannot be undone.',
      detail: `${app.applicant?.name || 'Unknown applicant'} · ${app._id}`,
      confirmLabel: 'Delete permanently',
      tone: 'danger',
    });
    if (!ok) return;

    setDeletingId(app._id);
    try {
      await officerService.deleteApplication(app._id);
      removeApplication(app._id);
      toast.success('Application deleted.');
    } catch (error) {
      toast.error(error.message, { title: 'Delete failed' });
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-24 rounded-xl bg-slate-200" />
        <div className="h-96 rounded-xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <section className={`${CARD} p-4 lg:p-5`}>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('search_officer_placeholder', 'Search applications by name, ID or email...')}
              aria-label="Search applications"
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 focus:bg-white transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <label htmlFor="type-filter" className="sr-only">
              Filter by loan type
            </label>
            <div className="relative">
              <SlidersHorizontal
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                aria-hidden="true"
              />
              <select
                id="type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="pl-9 pr-8 py-2.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-500 transition-colors cursor-pointer"
              >
                <option value="">{t('all_chip', 'All')} {t('loan_type_label', 'Loan Types')}</option>
                {LOAN_TYPE_DETAILS.map((type) => (
                  <option key={type.value} value={type.value}>
                    {translateLoanType(type.value, t)}
                  </option>
                ))}
              </select>
            </div>

            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-2.5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                {t('cancel_btn', 'Clear')}
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          {STATUS_CHIPS.map((chip) => {
            const isActive = statusFilter === chip.value;
            const count = chip.value ? counts.get(chip.value) || 0 : applications.length;
            if (chip.value && count === 0 && !isActive) return null;
            const chipLabel = chip.value ? translateStatus(chip.value, t) : t('all_chip', 'All');
            return (
              <button
                key={chip.value || 'all'}
                type="button"
                onClick={() => setStatusFilter(chip.value)}
                aria-pressed={isActive}
                className={`inline-flex items-center gap-1.5 text-[13px] font-medium rounded-full px-3 py-1.5 border transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-navy-900 border-navy-900 text-white'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {chipLabel}
                <span
                  className={`text-[11px] tabular-nums ${isActive ? 'text-slate-300' : 'text-slate-400'}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Result summary */}
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <p className="text-[13px] text-slate-600">
          Showing <span className="font-semibold text-slate-900">{filtered.length}</span> of{' '}
          {applications.length} application{applications.length === 1 ? '' : 's'}
        </p>
        <p className="text-[13px] text-slate-600 tabular-nums">
          Requested value{' '}
          <span className="font-semibold text-slate-900">{formatINRCompact(filteredValue)}</span>
        </p>
      </div>

      {/* Table */}
      <section className={`${CARD} min-w-0`}>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <span className="w-12 h-12 rounded-full bg-slate-100 grid place-items-center mx-auto">
              <Search className="w-5 h-5 text-slate-400" aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold text-slate-900 mt-4">No matching applications</h3>
            <p className="text-sm text-slate-600 mt-1.5">
              {applications.length === 0
                ? 'Submitted loan requests will appear here.'
                : 'Try a different search term or clear the filters.'}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex items-center gap-1.5 bg-slate-900 hover:bg-navy-800 text-white text-[13px] font-medium rounded-lg px-3.5 py-2 mt-5 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Stacked Card View (< md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map((app) => {
                const meta = statusMeta(app.status);
                const bank = bankFor(app);
                const days = daysWaiting(app.createdAt);

                return (
                  <div key={app._id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs grid place-items-center shrink-0">
                          {initialsOf(app.applicant?.name)}
                        </span>
                        <div className="min-w-0">
                          <Link
                            to={ROUTES.officerApplication(app._id)}
                            className="font-bold text-slate-900 truncate hover:text-emerald-700 block text-sm"
                          >
                            {app.applicant?.name || 'Unknown applicant'}
                          </Link>
                          <p className="text-[11px] text-slate-400 font-mono truncate">
                            ID: #{app._id.slice(-8)}
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={app.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 px-3 bg-slate-50 rounded-lg border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">{t('bank_loantype_col', 'Product & Bank')}</span>
                        <span className="font-semibold text-slate-900 block truncate">
                          {translateLoanType(app.loanType, t)} · {bank?.name || app.bankName || 'Bank'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-mono block uppercase">{t('amount_col', 'Requested')}</span>
                        <span className="font-bold font-mono text-slate-900 block">
                          {formatINR(app.requestedAmount)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {days === 0 ? 'Today' : `${waitingLabel(days)} ago`}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(app)}
                          disabled={deletingId === app._id}
                          title="Delete application"
                          className="text-slate-400 hover:text-red-600 p-1.5 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <Link
                          to={ROUTES.officerApplication(app._id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors"
                        >
                          {t('view_details_btn', 'Review Application')}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {t('name_applicant_col', 'Applicant')}
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {t('bank_loantype_col', 'Product')}
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                      {t('amount_col', 'Amount')}
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right whitespace-nowrap">
                      {t('tenure_col', 'Tenure')}
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap">
                      {t('timeline_created', 'Received')}
                    </th>
                    <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {t('status_col', 'Status')}
                    </th>
                    <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-right">
                      {t('action_col', 'Actions')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((app) => {
                    const bank = bankFor(app);
                    const days = daysWaiting(app.createdAt);
                    return (
                      <tr key={app._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-9 h-9 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold grid place-items-center shrink-0">
                              {initialsOf(app.applicant?.name)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={ROUTES.officerApplication(app._id)}
                                className="block font-medium text-slate-900 truncate hover:text-emerald-700 transition-colors"
                              >
                                {app.applicant?.name || 'Unknown applicant'}
                              </Link>
                              <p className="text-[11px] text-slate-400 truncate">
                                {app.applicant?.email || (
                                  <span className="font-mono">{app._id.slice(-8)}</span>
                                )}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <BankLogo bank={bank} name={app.bankName} size="md" />
                            <div className="min-w-0">
                              <p className="text-[13px] text-slate-900 truncate">
                                {translateLoanType(app.loanType, t)}
                              </p>
                              <p className="text-[11px] text-slate-400 truncate">
                                {bank?.name || app.bankName || 'Bank not recorded'}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-medium text-slate-900 tabular-nums whitespace-nowrap">
                          {formatINR(app.requestedAmount)}
                        </td>

                        <td className="px-3 py-3 text-right text-slate-600 tabular-nums whitespace-nowrap">
                          {app.tenureMonths ? `${app.tenureMonths} ${t('months_suffix', 'months')}` : '—'}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="text-slate-900">{formatDate(app.createdAt)}</p>
                          <p className="flex items-center gap-1 text-[11px] text-slate-400">
                            <Clock className="w-3 h-3" aria-hidden="true" />
                            {days === 0 ? 'Today' : `${waitingLabel(days)} ago`}
                          </p>
                        </td>

                        <td className="px-3 py-3">
                          <StatusBadge status={app.status} />
                        </td>

                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={ROUTES.officerApplication(app._id)}
                              className="inline-flex items-center gap-1 text-[13px] font-medium text-emerald-600 hover:text-emerald-700 transition-colors whitespace-nowrap"
                            >
                              {t('view_details_btn', 'Review')}
                              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                            </Link>
                            <button
                              type="button"
                              onClick={() => handleDelete(app)}
                              disabled={deletingId === app._id}
                              title="Delete application"
                              aria-label={`Delete application ${app._id.slice(-8)}`}
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md p-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
