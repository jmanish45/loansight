export default function ProgressIndicator({
  value = 0,
  max = 100,
  label,
  showPercentage = true,
  variant = 'emerald', // 'emerald', 'sky', 'amber', 'red'
  className = '',
}) {
  const percentage = Math.min(100, Math.max(0, Math.round((value / max) * 100)));

  const fillColors = {
    emerald: 'bg-emerald-600',
    sky: 'bg-sky-600',
    amber: 'bg-amber-600',
    red: 'bg-red-600',
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {(label || showPercentage) && (
        <div className="flex justify-between items-center text-xs font-medium text-slate-700">
          {label && <span>{label}</span>}
          {showPercentage && <span className="font-mono tabular-nums text-slate-900">{percentage}%</span>}
        </div>
      )}
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
        <div
          className={`h-full rounded-full transition-all duration-300 ease-out ${fillColors[variant] || fillColors.emerald}`}
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
