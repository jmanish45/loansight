import { useId } from 'react';

export default function Textarea({
  label,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  error,
  rows = 3,
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
      <textarea
        id={id}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
        className={`
          w-full px-3 py-2 rounded-md text-sm text-slate-900 bg-white border
          transition-colors duration-150 ease-in-out resize-y
          placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600
          disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100
          ${error
            ? 'border-red-600 focus:ring-red-600 focus:border-red-600'
            : 'border-slate-300 hover:border-slate-400'
          }
        `}
        {...props}
      />
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
