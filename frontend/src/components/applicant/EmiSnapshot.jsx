import { formatINR, formatINRCompact, formatMonths } from '../../lib/loanMath';
import { useLanguage } from '../../context/LanguageContext';
import { translateLoanType } from '../../constants/translations';

const R = 68;
const C = 84;
const CIRC = 2 * Math.PI * R;

export default function EmiSnapshot({ application = null, estimate = null }) {
  const { t } = useLanguage();
  const title = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-[15px] font-semibold text-slate-900">{t('emi_snapshot', 'EMI Snapshot')}</h2>
        {application && (
          <p className="text-xs text-slate-400 mt-0.5 truncate">
            {translateLoanType(application.loanType, t)}
            {application.bankName ? ` · ${application.bankName}` : ''}
          </p>
        )}
      </div>
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 shrink-0">
        {t('indicative_badge', 'INDICATIVE')}
      </span>
    </div>
  );

  const shell = 'bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

  if (!application || !estimate) {
    return (
      <section className={shell}>
        {title}
        <p className="text-sm text-slate-400 text-center py-10">
          {application
            ? t('rate_unavailable', 'No published rate available for this partner yet.')
            : t('emi_estimate_empty', 'An EMI estimate appears once you have an active application.')}
        </p>
      </section>
    );
  }

  const principalLen = (Math.max(0, Math.min(100, estimate.principalPct)) / 100) * CIRC;
  const interestLen = Math.max(0, CIRC - principalLen);

  return (
    <section className={shell}>
      {title}

      <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-center mt-5">
        <div className="relative w-[168px] h-[168px] mx-auto sm:mx-0">
          <svg
            viewBox="0 0 168 168"
            className="w-[168px] h-[168px]"
            role="img"
            aria-label={`Principal ${estimate.principalPct} percent, interest ${estimate.interestPct} percent of total payable`}
          >
            <g transform={`rotate(-90 ${C} ${C})`}>
              <circle cx={C} cy={C} r={R} fill="none" stroke="#F1F5F9" strokeWidth="16" />
              <circle
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke="#10B981"
                strokeWidth="16"
                strokeDasharray={`${principalLen} ${CIRC - principalLen}`}
              />
              <circle
                cx={C}
                cy={C}
                r={R}
                fill="none"
                stroke="#0A192F"
                strokeWidth="16"
                strokeDasharray={`${interestLen} ${CIRC - interestLen}`}
                strokeDashoffset={-principalLen}
              />
            </g>
          </svg>
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <div className="text-center">
              <p className="text-xl font-semibold tabular-nums text-slate-900">
                {formatINRCompact(estimate.emi)}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 mt-0.5">{t('monthly_emi', 'Monthly EMI')}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              {t('principal_label', 'Principal')}
            </span>
            <span className="text-sm font-medium text-slate-900 tabular-nums">
              {formatINRCompact(estimate.principal)}
              <span className="text-[11px] text-slate-400 ml-1.5">{estimate.principalPct}%</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-slate-600">
              <span className="w-2 h-2 rounded-full bg-navy-900 shrink-0" />
              {t('total_interest', 'Total Interest')}
            </span>
            <span className="text-sm font-medium text-slate-900 tabular-nums">
              {formatINRCompact(estimate.totalInterest)}
              <span className="text-[11px] text-slate-400 ml-1.5">{estimate.interestPct}%</span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-600">{t('total_payable', 'Total Payable')}</span>
            <span className="text-sm font-semibold text-slate-900 tabular-nums">
              {formatINR(estimate.totalPayable)}
            </span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-slate-400 mt-4 pt-3 border-t border-slate-200 leading-relaxed">
        Indicative only. Calculated at {estimate.ratePct}% p.a. ({estimate.rateSource}) over{' '}
        {formatMonths(application.tenureMonths)}. Your final rate is set by the bank.
      </p>
    </section>
  );
}
