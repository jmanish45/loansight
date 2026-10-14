import { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  Files,
  Inbox,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Clock,
  TrendingUp,
  Layers,
  Inspect,
  ShieldAlert,
  HelpCircle,
  FileQuestion,
  Search,
} from 'lucide-react';
import StatusDonut from '../../components/officer/StatusDonut';
import BankLogo from '../../components/common/BankLogo';
import {
  statusMeta,
  statusMix,
  loanTypeMix,
  loanTypeLabel,
  initialsOf,
  bankFor,
  daysWaiting,
  waitingLabel,
  formatDate,
  OPEN_STATUSES,
} from '../../lib/officerData';
import { formatINR, formatINRCompact } from '../../lib/loanMath';
import { ROUTES } from '../../constants/routes';

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

function ActionStatCard({ icon: Icon, label, value, subtext, tone = 'neutral', to = null }) {
  const toneStyles = {
    neutral: 'bg-slate-50 border-slate-200 text-slate-700',
    amber: 'bg-amber-50/80 border-amber-200 text-amber-800',
    red: 'bg-red-50/80 border-red-200 text-red-800',
    emerald: 'bg-emerald-50/80 border-emerald-200 text-emerald-800',
    navy: 'bg-navy-900 text-white border-navy-800',
  };

  const Content = (
    <div className={`p-4 rounded-xl border flex flex-col justify-between h-full transition-colors ${toneStyles[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono font-bold uppercase tracking-wider opacity-80">{label}</span>
        <Icon className="w-4 h-4 shrink-0 opacity-70" />
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold font-mono tracking-tight leading-none">{value}</p>
        {subtext && <p className="text-[11px] mt-1.5 opacity-80 leading-normal">{subtext}</p>}
      </div>
    </div>
  );

  if (to) {
    return <Link to={to} className="block hover:opacity-95 transition-opacity">{Content}</Link>;
  }
  return Content;
}

export default function Dashboard() {
  const { applications, loading, summary } = useOutletContext();

  const mix = useMemo(() => statusMix(applications), [applications]);
  const byType = useMemo(() => loanTypeMix(applications), [applications]);

  // Priority queue 1: Needs immediate officer attention (submitted or docs_required)
  const actionQueue = useMemo(
    () =>
      applications
        .filter((app) => ['submitted', 'documents_required', 'under_review'].includes(app.status))
        .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
    [applications]
  );

  // Priority queue 2: Oldest waiting applications
  const oldestWaiting = useMemo(
    () =>
      applications
        .filter((app) => OPEN_STATUSES.includes(app.status))
        .map((app) => ({ app, days: daysWaiting(app.createdAt) ?? 0 }))
        .sort((a, b) => b.days - a.days)
        .slice(0, 5),
    [applications]
  );

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-44 rounded-xl bg-slate-200" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 rounded-xl bg-slate-200" />
          <div className="h-28 rounded-xl bg-slate-200" />
          <div className="h-28 rounded-xl bg-slate-200" />
          <div className="h-28 rounded-xl bg-slate-200" />
        </div>
        <div className="h-80 rounded-xl bg-slate-200" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Operations Command Header */}
      <section className="bg-navy-900 text-white rounded-xl p-5 lg:p-6 border border-navy-800 shadow-sm relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Underwriting Desk Operational
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {applications.length} Total Applications
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-bold text-white tracking-tight mt-1.5">
              {summary.open === 0 ? 'Review Queue Clear' : `${summary.open} Applications Awaiting Decision`}
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {summary.submitted > 0 ? `${summary.submitted} pending triage · ` : ''}
              {summary.docsRequired > 0 ? `${summary.docsRequired} waiting on applicant documents · ` : ''}
              Prioritized by wait time and verification status.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              to={`${ROUTES.OFFICER_APPLICATIONS}?status=submitted`}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
            >
              <Inspect className="w-4 h-4" />
              Triage New Queue ({summary.submitted})
            </Link>
            <Link
              to={ROUTES.OFFICER_APPLICATIONS}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg px-3.5 py-2.5 border border-slate-700 transition-colors"
            >
              All Applications
            </Link>
          </div>
        </div>

        {/* Tactical Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-white/10 text-xs">
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider block">Open Risk Exposure</span>
            <span className="text-lg font-bold font-mono text-white mt-0.5 block">{summary.open === 0 ? '—' : formatINRCompact(summary.openValue)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider block">Total Pipeline Value</span>
            <span className="text-lg font-bold font-mono text-white mt-0.5 block">{summary.total === 0 ? '—' : formatINRCompact(summary.totalValue)}</span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider block">Oldest Waiting</span>
            <span className={`text-lg font-bold font-mono mt-0.5 block ${summary.oldestOpenDays >= 7 ? 'text-amber-400' : 'text-slate-200'}`}>
              {summary.oldestOpenDays === null ? '—' : waitingLabel(summary.oldestOpenDays)}
            </span>
          </div>
          <div>
            <span className="text-slate-400 text-[10px] uppercase font-mono tracking-wider block">Approval Rate</span>
            <span className="text-lg font-bold font-mono text-emerald-400 mt-0.5 block">{summary.approvalRate !== null ? `${summary.approvalRate}%` : '—'}</span>
          </div>
        </div>
      </section>

      {/* Actionable KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <ActionStatCard
          icon={Inbox}
          label="1. Triage Queue"
          value={summary.submitted}
          subtext="New submissions waiting for officer review"
          tone={summary.submitted > 0 ? 'amber' : 'neutral'}
          to={`${ROUTES.OFFICER_APPLICATIONS}?status=submitted`}
        />
        <ActionStatCard
          icon={AlertTriangle}
          label="2. Document Gaps"
          value={summary.docsRequired}
          subtext="Applicant action needed for verification"
          tone={summary.docsRequired > 0 ? 'red' : 'neutral'}
          to={`${ROUTES.OFFICER_APPLICATIONS}?status=documents_required`}
        />
        <ActionStatCard
          icon={Files}
          label="3. Under Review"
          value={summary.underReview}
          subtext="In active manual underwriting evaluation"
          tone="neutral"
          to={`${ROUTES.OFFICER_APPLICATIONS}?status=under_review`}
        />
        <ActionStatCard
          icon={CheckCircle2}
          label="4. Decided Loans"
          value={summary.decided}
          subtext={`${summary.approved} Approved · ${summary.rejected} Declined`}
          tone="emerald"
          to={`${ROUTES.OFFICER_APPLICATIONS}?status=approved`}
        />
      </div>

      {/* Priority Work Queue & Right Rail */}
      <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
        {/* Priority Attention Table */}
        <section className={CARD}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Priority Attention Queue</h2>
              <p className="text-xs text-slate-500">Applications sorted by required action and wait time</p>
            </div>
            <Link
              to={ROUTES.OFFICER_APPLICATIONS}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              View Full Queue ({applications.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {actionQueue.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-900">No applications require immediate action.</p>
              <p className="text-xs text-slate-400 mt-1">All submitted loans have been processed or decided.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-mono uppercase">
                    <th className="px-5 py-3 font-semibold">Applicant</th>
                    <th className="px-3 py-3 font-semibold">Product</th>
                    <th className="px-3 py-3 font-semibold text-right">Amount</th>
                    <th className="px-3 py-3 font-semibold">Waiting</th>
                    <th className="px-3 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {actionQueue.slice(0, 8).map((app) => {
                    const meta = statusMeta(app.status);
                    const days = daysWaiting(app.createdAt);
                    const bank = bankFor(app);

                    return (
                      <tr key={app._id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs grid place-items-center shrink-0">
                              {initialsOf(app.applicant?.name)}
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={ROUTES.officerApplication(app._id)}
                                className="font-semibold text-slate-900 truncate hover:text-emerald-700 block"
                              >
                                {app.applicant?.name || 'Applicant'}
                              </Link>
                              <span className="text-[11px] text-slate-400 font-mono block">
                                ID: #{app._id.slice(-6)}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <BankLogo bank={bank} name={app.bankName} size="sm" />
                            <div>
                              <p className="font-medium text-slate-900 truncate">{loanTypeLabel(app.loanType)}</p>
                              <p className="text-[10px] text-slate-400">{app.bankName || 'HDFC Bank'}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-3 py-3 text-right font-mono font-semibold text-slate-900">
                          {formatINR(app.requestedAmount)}
                        </td>

                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${days >= 5 ? 'text-amber-700' : 'text-slate-600'}`}>
                            <Clock className="w-3 h-3 text-slate-400" />
                            {waitingLabel(days)}
                          </span>
                        </td>

                        <td className="px-3 py-3">
                          <span className={`inline-flex items-center text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${meta.chip}`}>
                            {meta.label}
                          </span>
                        </td>

                        <td className="px-5 py-3 text-right">
                          <Link
                            to={ROUTES.officerApplication(app._id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <span>Review</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right Rail: Oldest Waiting & Status Breakdown */}
        <div className="space-y-5">
          {/* Oldest Waiting Panel */}
          <section className={`${CARD} p-5`}>
            <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
              <Clock className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Oldest Waiting Cases</h3>
            </div>

            {oldestWaiting.length === 0 ? (
              <p className="text-xs text-slate-400 mt-3">No pending open cases.</p>
            ) : (
              <ul className="divide-y divide-slate-100 mt-2">
                {oldestWaiting.map(({ app, days }) => (
                  <li key={app._id} className="py-2.5 first:pt-1 last:pb-0">
                    <Link
                      to={ROUTES.officerApplication(app._id)}
                      className="flex items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                          {app.applicant?.name || 'Applicant'}
                        </p>
                        <p className="text-[11px] text-slate-400 font-mono truncate">
                          {loanTypeLabel(app.loanType)} · {formatINRCompact(app.requestedAmount)}
                        </p>
                      </div>
                      <span className={`text-xs font-mono font-bold shrink-0 ${days >= 5 ? 'text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200' : 'text-slate-600'}`}>
                        {waitingLabel(days)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Portfolio Status Mix Donut */}
          <section className={`${CARD} p-5`}>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Portfolio Distribution</h3>
              <p className="text-[11px] text-slate-400">Status breakdown across active queue</p>
            </div>
            <div className="mt-4">
              <StatusDonut segments={mix} total={summary.total} label="in queue" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

