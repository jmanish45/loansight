const variantStyles = {
  default: 'bg-slate-100 text-slate-700 border-slate-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  navy: 'bg-slate-900 text-white border-slate-900',
};

const dotStyles = {
  default: 'bg-slate-500',
  neutral: 'bg-slate-500',
  success: 'bg-emerald-600',
  emerald: 'bg-emerald-600',
  warning: 'bg-amber-600',
  amber: 'bg-amber-600',
  error: 'bg-red-600',
  red: 'bg-red-600',
  info: 'bg-sky-600',
  sky: 'bg-sky-600',
  navy: 'bg-emerald-400',
};

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className = '',
}) {
  const sizeStyle = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-0.5 text-xs';

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-medium rounded-md border tracking-tight
        ${sizeStyle}
        ${variantStyles[variant] || variantStyles.default}
        ${className}
      `}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotStyles[variant] || dotStyles.default}`}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  );
}
