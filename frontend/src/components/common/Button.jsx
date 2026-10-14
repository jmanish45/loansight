import { Loader2 } from 'lucide-react';

const variants = {
  primary:
    'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 border border-slate-900 shadow-subtle',
  secondary:
    'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 shadow-subtle',
  outline:
    'bg-transparent text-slate-700 border border-slate-300 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger:
    'bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-red-600 shadow-subtle',
  emerald:
    'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800 border border-emerald-600 shadow-subtle',
  sky:
    'bg-sky-600 text-white hover:bg-sky-700 active:bg-sky-800 border border-sky-600 shadow-subtle',
  navy:
    'bg-slate-950 text-white hover:bg-slate-900 active:bg-black border border-slate-800 shadow-subtle',
  link:
    'bg-transparent text-sky-600 hover:underline p-0 h-auto font-normal hover:text-sky-700',
};

const sizes = {
  sm: 'h-8 px-3 text-xs min-h-[32px]',
  md: 'h-9.5 px-4 text-sm min-h-[38px]',
  lg: 'h-11 px-5 text-sm font-semibold min-h-[44px]',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  type = 'button',
  className = '',
  ariaLabel,
  ...props
}) {
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading}
      aria-label={ariaLabel}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-md font-medium text-center tracking-tight
        transition-colors duration-150 ease-in-out
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600
        disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
        cursor-pointer select-none
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        ${className}
      `}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />}
      {children}
    </button>
  );
}
