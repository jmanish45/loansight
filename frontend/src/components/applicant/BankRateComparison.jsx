import { bankBrand } from '../common/BankLogo';
import { useLanguage } from '../../context/LanguageContext';

export default function BankRateComparison({ rates = [], highlightBankId = null, loanTypeLabel = '' }) {
  const { t } = useLanguage();
  const shell = 'bg-white border border-slate-200 rounded-xl p-5 shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

  if (!Array.isArray(rates) || rates.length === 0) {
    return (
      <section className={shell}>
        <h2 className="text-[15px] font-semibold text-slate-900">{t('partner_bank_rates', 'Partner Bank Rates')}</h2>
        <p className="text-sm text-slate-400 text-center py-10">{t('rate_unavailable', 'Rate information unavailable.')}</p>
      </section>
    );
  }

  const min = Math.min(...rates.map((r) => r.ratePct));
  const max = Math.max(...rates.map((r) => r.ratePct));
  const span = max - min;

  const widthFor = (rate) => {
    if (span === 0) return 100;
    return 35 + ((rate - min) / span) * 65;
  };

  return (
    <section className={shell}>
      <h2 className="text-[15px] font-semibold text-slate-900">{t('partner_bank_rates', 'Partner Bank Rates')}</h2>
      <p className="text-xs text-slate-400 mt-0.5">
        {t('partner_rates_sub', 'Advertised starting rates, lowest first')}{loanTypeLabel ? ` · ${loanTypeLabel}` : ''}
      </p>

      <div className="space-y-3 mt-5">
        {rates.map((bank, index) => {
          const isLowest = index === 0;
          const isYours = bank.id === highlightBankId;
          const barColor = isLowest ? 'bg-emerald-500' : isYours ? 'bg-navy-900' : 'bg-slate-300';

          return (
            <div key={bank.id} className="grid grid-cols-[72px_1fr_56px] items-center gap-3">
              <div className="min-w-0 flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: bankBrand(bank.id, bank.name).from }}
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-slate-600 truncate">{bank.shortName}</p>
                  {isYours && <p className="text-[10px] text-navy-700">{t('your_bank', 'Your bank')}</p>}
                </div>
              </div>

              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor} transition-all duration-500`}
                  style={{ width: `${widthFor(bank.ratePct)}%` }}
                />
              </div>

              <p className="text-xs font-medium tabular-nums text-slate-900 text-right">
                {bank.minRate}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-5 pt-3 border-t border-slate-200 leading-relaxed">
        Starting rates published by each partner. Your offered rate depends on profile and verification.
      </p>
    </section>
  );
}
