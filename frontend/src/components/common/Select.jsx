import { useId } from 'react';
import { ChevronDown } from 'lucide-react';

export default function Select({
  label,
  name,
  value,
  onChange,
  onBlur,
  options = [],
  placeholder = 'Select an option',
  helperText,
  error,
  disabled = false,
  required = false,
  className = '',
  ...props
}) {
  const id = useId();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={id}
          className="text-xs font-semibold uppercase tracking-wider text-slate-600"
        >
          {label}
          {required && <span className="text-red-600 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={`
            w-full h-9.5 px-3 pr-9 rounded-md text-sm text-slate-900 bg-white border appearance-none
            transition-colors duration-150 ease-in-out cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100
            ${!value ? 'text-slate-400' : ''}
            ${error
              ? 'border-red-600 focus:ring-red-600 focus:border-red-600'
              : 'border-slate-300 hover:border-slate-400'
            }
          `}
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" aria-hidden="true" />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={`${id}-helper`} className="text-xs text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
}
