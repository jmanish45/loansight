import { useId } from 'react';

export default function Input({
  label,
  name,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  helperText,
  error,
  disabled = false,
  required = false,
  prefix,
  suffix,
  mono = false,
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
      
      <div className="relative flex items-center w-full">
        {prefix && (
          <span className="absolute left-3 text-sm font-medium text-slate-500 pointer-events-none select-none">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={`
            w-full h-9.5 px-3 rounded-md text-sm text-slate-900 bg-white border
            transition-colors duration-150 ease-in-out
            placeholder:text-slate-400
            focus:outline-none focus:ring-2 focus:ring-sky-600 focus:border-sky-600
            disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-100
            ${prefix ? 'pl-8' : ''}
            ${suffix ? 'pr-8' : ''}
            ${mono ? 'font-mono tabular-nums' : ''}
            ${error
              ? 'border-red-600 focus:ring-red-600 focus:border-red-600'
              : 'border-slate-300 hover:border-slate-400'
            }
          `}
          {...props}
        />
        {suffix && (
          <span className="absolute right-3 text-sm font-medium text-slate-500 pointer-events-none select-none">
            {suffix}
          </span>
        )}
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
