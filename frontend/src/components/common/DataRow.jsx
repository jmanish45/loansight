export default function DataRow({
  label,
  value,
  mono = false,
  badge = null,
  hint = null,
  className = '',
}) {
  return (
    <div className={`flex items-baseline justify-between py-2 border-b border-slate-100 last:border-0 gap-4 text-xs ${className}`}>
      <div className="min-w-0">
        <span className="font-medium text-slate-500">{label}</span>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-2 text-right shrink-0">
        {badge}
        <span className={`font-semibold text-slate-900 ${mono ? 'font-mono tabular-nums' : ''}`}>
          {value !== undefined && value !== null ? value : '—'}
        </span>
      </div>
    </div>
  );
}
