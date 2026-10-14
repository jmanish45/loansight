import {
  User,
  Home,
  Briefcase,
  Building,
  GraduationCap,
  Car,
  FileText,
  Check,
} from 'lucide-react';
import Badge from '../common/Badge';
import { LOAN_TYPE_DETAILS } from '../../constants/banks';

const ICONS = { User, Home, Briefcase, Building, GraduationCap, Car };

export default function LoanTypePicker({ value, onChange, error }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label htmlFor="loan-type-quick-select" className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          Loan Product Category <span className="text-red-600" aria-hidden="true">*</span>
        </label>
        <span className="text-[11px] text-slate-500 font-mono">{LOAN_TYPE_DETAILS.length} Categories Available</span>
      </div>

      {/* Accessible Select Fallback */}
      <select
        id="loan-type-quick-select"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs font-medium bg-white border border-slate-300 rounded-md px-3 py-2 text-slate-900 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-600"
      >
        <option value="">Select a loan type category</option>
        {LOAN_TYPE_DETAILS.map((detail) => (
          <option key={detail.value} value={detail.value}>
            {detail.label} — Interest Rate: {detail.rateRange} (Tenure: {detail.tenure})
          </option>
        ))}
      </select>

      {/* Product Decision System Grid */}
      <div role="radiogroup" aria-label="Loan product type" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LOAN_TYPE_DETAILS.map((detail) => {
          const Icon = ICONS[detail.iconName] || FileText;
          const isSelected = value === detail.value;

          return (
            <button
              type="button"
              key={detail.value}
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(detail.value)}
              className={`
                text-left w-full rounded-md border p-3.5 transition-all duration-150 cursor-pointer select-none flex flex-col justify-between
                focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600
                ${isSelected
                  ? 'border-emerald-600 bg-emerald-50/50 shadow-subtle ring-1 ring-emerald-600'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }
              `}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className={`w-8 h-8 rounded border grid place-items-center shrink-0 ${isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                    <Icon className="w-4 h-4" aria-hidden="true" />
                  </span>
                  {isSelected ? (
                    <span className="w-5 h-5 rounded-full bg-emerald-600 grid place-items-center shrink-0">
                      <Check className="w-3 h-3 text-white stroke-[3]" aria-hidden="true" />
                    </span>
                  ) : (
                    <span className="w-5 h-5 rounded-full border border-slate-300 shrink-0" aria-hidden="true" />
                  )}
                </div>

                <p className="text-xs font-bold text-slate-900 mt-2.5 leading-tight">{detail.label}</p>
                <p className="text-[11px] text-slate-600 mt-1 leading-normal line-clamp-2">{detail.subtitle}</p>
              </div>

              <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px]">
                <span className="font-mono text-slate-500">{detail.tenure}</span>
                <span className="font-mono font-semibold text-emerald-700 tabular-nums">
                  {detail.rateRange}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
