import Badge from '../common/Badge';

export default function RiskIndicator({
  riskLevel = 'LOW', // 'LOW', 'MEDIUM', 'HIGH'
  score,
  recommendation = 'APPROVE',
  className = '',
}) {
  const riskMap = {
    LOW: { label: 'Low Risk', variant: 'emerald', bg: 'bg-emerald-50 border-emerald-200' },
    MEDIUM: { label: 'Medium Risk', variant: 'amber', bg: 'bg-amber-50 border-amber-200' },
    HIGH: { label: 'High Risk', variant: 'red', bg: 'bg-red-50 border-red-200' },
  };

  const current = riskMap[String(riskLevel).toUpperCase()] || riskMap.LOW;

  return (
    <div className={`p-3.5 rounded-lg border flex items-center justify-between gap-3 text-xs ${current.bg} ${className}`}>
      <div className="flex items-center gap-2.5">
        <Badge variant={current.variant} dot>{current.label}</Badge>
        {recommendation && (
          <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-700">
            Action: {recommendation}
          </span>
        )}
      </div>

      {score !== undefined && score !== null && (
        <div className="flex items-baseline gap-1 text-right">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Score:</span>
          <span className="font-mono font-bold text-sm text-slate-900 tabular-nums">{score}/100</span>
        </div>
      )}
    </div>
  );
}
