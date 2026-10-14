import { useState } from 'react';
import { Info, TrendingUp, ChevronUp, ChevronDown, Building2 } from 'lucide-react';
import BankLogo from '../common/BankLogo';
import {
  parseRate,
  emiBreakdown,
  affordabilityRatio,
  affordabilityBand,
  formatINR,
  formatMonths,
} from '../../lib/loanMath';

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

const BAND_COPY = {
  healthy: { label: 'Comfortable burden', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  moderate: { label: 'Moderate burden', className: 'text-amber-700 bg-amber-50 border-amber-200' },
  stretched: { label: 'High repayment burden', className: 'text-red-700 bg-red-50 border-red-200' },
};

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={`text-xs font-medium text-slate-900 text-right min-w-0 ${mono ? 'tabular-nums font-mono' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Dynamic summary rail showing chosen bank, loan parameters, and canonical EMI calculations.
 * Supports sticky positioning on desktop and a collapsible summary bar on mobile.
 */
export default function ApplicationSummaryRail({
  bank = null,
  loanTypeDetail = null,
  requestedAmount = '',
  tenureMonths = '',
  declaredMonthlyIncome = '',
  documentsUploaded = 0,
  documentsRequired = 0,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const amount = Number(requestedAmount);
  const tenure = Number(tenureMonths);
  const income = Number(declaredMonthlyIncome);

  const bankRate = parseRate(bank?.minRate);
  const fallbackRate = parseRate(loanTypeDetail?.rateRange);
  const ratePct = bankRate ?? fallbackRate;
  const rateSource = bankRate !== null && bank ? `${bank.name} starting rate` : 'published range';

  const breakdown =
    ratePct !== null && Number.isFinite(amount) && amount > 0 && Number.isFinite(tenure) && tenure > 0
      ? emiBreakdown(amount, ratePct, tenure)
      : null;

  const ratio = breakdown && Number.isFinite(income) && income > 0 ? affordabilityRatio(breakdown.emi, income) : null;
  const band = affordabilityBand(ratio);
  const bandCopy = band ? BAND_COPY[band] : null;

  const SummaryContent = () => (
    <div className="space-y-4">
      {/* Overview Block */}
      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Application Summary</h2>
            <p className="text-[11px] text-slate-400">Underwriting parameters</p>
          </div>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {documentsRequired > 0 ? `${documentsUploaded}/${documentsRequired} Docs` : 'Draft'}
          </span>
        </div>

        {bank && (
          <div className="flex items-center gap-3 mt-3.5 p-2.5 rounded-lg bg-slate-50 border border-slate-200">
            <BankLogo bank={bank} size="md" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{bank.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{bank.tagline}</p>
            </div>
          </div>
        )}

        <div className="mt-3 divide-y divide-slate-100">
          <Row label="Loan Type" value={loanTypeDetail?.label || 'Not selected'} />
          <Row
            label="Requested Amount"
            value={Number.isFinite(amount) && amount > 0 ? formatINR(amount) : '—'}
            mono
          />
          <Row
            label="Tenure"
            value={Number.isFinite(tenure) && tenure > 0 ? formatMonths(tenure) : '—'}
            mono
          />
          <Row
            label="Declared Income"
            value={Number.isFinite(income) && income > 0 ? `${formatINR(income)}/mo` : '—'}
            mono
          />
        </div>
      </section>

      {/* EMI Calculation Block */}
      <section className={`${CARD} p-5`}>
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Indicative EMI</h2>
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
            Computed
          </span>
        </div>

        {!breakdown ? (
          <p className="text-xs text-slate-400 mt-3 leading-relaxed">
            {ratePct === null
              ? 'Select a loan type to view rate breakdown.'
              : 'Enter loan amount and tenure to calculate your monthly EMI.'}
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                  {formatINR(breakdown.emi)}
                </span>
                <span className="text-xs text-slate-400 font-medium">/ month</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Rate: {ratePct}% p.a. ({rateSource})
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Row label="Principal Amount" value={formatINR(amount)} mono />
              <Row label="Total Interest" value={formatINR(breakdown.totalInterest)} mono />
              <Row label="Total Payable" value={formatINR(breakdown.totalPayable)} mono />
            </div>

            {ratio !== null && bandCopy && (
              <div className={`p-3 rounded-lg border text-xs ${bandCopy.className}`}>
                <div className="flex items-center gap-1.5 font-semibold">
                  <TrendingUp className="w-3.5 h-3.5 shrink-0" />
                  <span>{ratio}% of declared monthly income</span>
                </div>
                <p className="mt-1 text-[11px] opacity-90 leading-normal">
                  {bandCopy.label} based on declared net income of {formatINR(income)}/mo.
                </p>
              </div>
            )}

            <div className="flex items-start gap-1.5 pt-1 text-[10px] text-slate-400 leading-normal">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>Final interest rate & EMI will be confirmed by bank underwriting after document verification.</span>
            </div>
          </div>
        )}
      </section>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Rail */}
      <div className="hidden xl:block">
        <SummaryContent />
      </div>

      {/* Mobile Collapsible Drawer Bar */}
      <div className="xl:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-lg">
        <button
          type="button"
          onClick={() => setMobileExpanded(!mobileExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 bg-slate-900 text-white cursor-pointer"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <div className="text-left min-w-0">
              <p className="text-xs font-semibold truncate">
                {bank?.name || 'Loan Application'} · {loanTypeDetail?.label || 'Summary'}
              </p>
              <p className="text-[11px] font-mono text-emerald-400 truncate">
                {breakdown ? `${formatINR(breakdown.emi)}/mo` : 'Tap for EMI breakdown'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span>{mobileExpanded ? 'Hide' : 'View Summary'}</span>
            {mobileExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </div>
        </button>

        {mobileExpanded && (
          <div className="p-4 max-h-[70vh] overflow-y-auto bg-slate-50 border-t border-slate-200">
            <SummaryContent />
          </div>
        )}
      </div>
    </>
  );
}

