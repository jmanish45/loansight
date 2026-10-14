import { Check } from 'lucide-react';
import BankLogo from '../common/BankLogo';
import Badge from '../common/Badge';
import { AVAILABLE_BANKS } from '../../constants/banks';

export default function BankPicker({ value, onChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="bank-quick-select" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Lending Partner Bank <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <span className="text-[11px] text-slate-500 font-mono">Select 1 of {AVAILABLE_BANKS.length} Partners</span>
      </div>

      {/* Accessible native select fallback */}
      <select
        id="bank-quick-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs font-medium bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-600"
      >
        {AVAILABLE_BANKS.map((bank) => (
          <option key={bank.id} value={bank.id}>
            {bank.name} — Rate: from {bank.minRate} ({bank.tagline})
          </option>
        ))}
      </select>

      {/* High-density Bank Selection Grid */}
      <div role="radiogroup" aria-label="Lending partner bank" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {AVAILABLE_BANKS.map((bank) => {
          const isSelected = value === bank.id;

          return (
            <button
              type="button"
              key={bank.id}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(bank.id)}
              className={`
                text-left w-full rounded-md border p-3.5 transition-all duration-150 cursor-pointer select-none
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600
                ${isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-subtle ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }
              `}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <BankLogo bank={bank} size="md" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate leading-tight">{bank.name}</p>
                    <p className="text-[10.5px] text-slate-500 truncate">{bank.tagline}</p>
                  </div>
                </div>
                {isSelected ? (
                  <span className="w-5 h-5 rounded-full bg-emerald-600 grid place-items-center shrink-0">
                    <Check className="w-3 h-3 text-white stroke-[3]" aria-hidden="true" />
                  </span>
                ) : (
                  <span className="w-5 h-5 rounded-full border border-slate-300 shrink-0" aria-hidden="true" />
                )}
              </div>

              <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
                <Badge variant={isSelected ? 'emerald' : 'default'} size="sm">
                  {bank.tag}
                </Badge>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                  from {bank.minRate}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
