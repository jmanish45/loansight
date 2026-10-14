export default function Metric({
  label,
  value,
  unit,
  change,
  trend = 'neutral', // 'positive', 'negative', 'neutral'
  subtitle,
  icon: Icon,
  mono = true,
  className = '',
}) {
  const trendColors = {
    positive: 'text-emerald-600',
    negative: 'text-red-600',
    neutral: 'text-slate-500',
  };

  return (
    <div className={`p-4 rounded-lg bg-white border border-slate-200 shadow-subtle flex flex-col justify-between ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
          {label}
        </span>
        {Icon && <Icon className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`text-2xl font-bold tracking-tight text-slate-900 ${mono ? 'font-mono tabular-nums' : ''}`}>
          {value}
        </span>
        {unit && <span className="text-xs font-medium text-slate-500">{unit}</span>}
      </div>
      {(change || subtitle) && (
        <div className="mt-2 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
          {change && (
            <span className={`font-semibold ${trendColors[trend] || trendColors.neutral}`}>
              {change}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
