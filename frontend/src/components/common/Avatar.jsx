export default function Avatar({
  name = '',
  size = 'md', // 'sm', 'md', 'lg'
  variant = 'emerald', // 'emerald', 'sky', 'slate', 'navy'
  className = '',
}) {
  const initials = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || '—';

  const sizes = {
    sm: 'w-7 h-7 text-[11px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm font-bold',
  };

  const variants = {
    emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    sky: 'bg-sky-100 text-sky-800 border-sky-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    navy: 'bg-slate-900 text-white border-slate-900',
  };

  return (
    <span
      className={`
        inline-flex items-center justify-center font-semibold rounded-md border shrink-0 select-none
        ${sizes[size] || sizes.md}
        ${variants[variant] || variants.emerald}
        ${className}
      `}
      title={name}
    >
      {initials}
    </span>
  );
}
