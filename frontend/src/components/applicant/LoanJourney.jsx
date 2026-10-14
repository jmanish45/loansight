import { Check, X } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { translateJourneyStep } from '../../constants/translations';

function Marker({ state }) {
  if (state === 'complete') {
    return (
      <span className="w-5 h-5 rounded-full bg-emerald-500 grid place-items-center">
        <Check className="w-3 h-3 text-white" aria-hidden="true" />
      </span>
    );
  }
  if (state === 'current') {
    return (
      <span className="w-5 h-5 rounded-full border-2 border-emerald-500 bg-white grid place-items-center">
        <span className="w-2 h-2 rounded-full bg-emerald-500" />
      </span>
    );
  }
  if (state === 'blocked') {
    return (
      <span className="w-5 h-5 rounded-full bg-red-50 border-2 border-red-500 grid place-items-center">
        <X className="w-3 h-3 text-red-600" aria-hidden="true" />
      </span>
    );
  }
  return <span className="w-5 h-5 rounded-full border-2 border-slate-300 bg-white" />;
}

export default function LoanJourney({
  steps = [],
  percent = 0,
  title = 'Your Loan Journey',
  subtitle = '',
}) {
  const { t } = useLanguage();
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

  const stateLabels = {
    complete: { text: t('completed_percent', 'Completed'), className: 'text-emerald-600' },
    current: { text: t('processing_status', 'In Progress'), className: 'text-emerald-600' },
    blocked: { text: t('action_required', 'Action Needed'), className: 'text-red-600' },
    pending: { text: t('status_documents_pending', 'Pending'), className: 'text-slate-400' },
  };

  const displayTitle = title === 'Your Loan Journey' ? t('your_loan_journey', 'Your Loan Journey') : title;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]">
      <h2 className="text-[15px] font-semibold text-slate-900">{displayTitle}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}

      {steps.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-8">{t('no_applications_yet', 'No application started yet.')}</p>
      ) : (
        <>
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-600">{t('overall_progress', 'Overall Progress')}</span>
              <span className="text-xs font-medium text-slate-900 tabular-nums">
                {clamped}% {t('completed_percent', 'Completed')}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={clamped}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Application progress"
              className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden"
            >
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${clamped}%` }}
              />
            </div>
          </div>

          <ol className="mt-5">
            {steps.map((step, index) => {
              const meta = stateLabels[step.state] || stateLabels.pending;
              const isLast = index === steps.length - 1;
              const stepLabel = translateJourneyStep(step.key, t) || step.label;
              return (
                <li key={step.key} className="relative flex gap-3">
                  <div className="relative flex flex-col items-center shrink-0 w-5">
                    <Marker state={step.state} />
                    {!isLast && (
                      <span
                        className={`w-px flex-1 mt-1 mb-1 ${
                          step.state === 'complete' ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className={`flex-1 min-w-0 flex items-start justify-between gap-3 ${isLast ? '' : 'pb-5'}`}>
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          step.state === 'pending' ? 'text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {stepLabel}
                      </p>
                      {step.hint && <p className="text-[11px] text-slate-400 mt-0.5">{step.hint}</p>}
                    </div>
                    <span className={`text-[11px] font-medium shrink-0 ${meta.className}`}>
                      {meta.text}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
