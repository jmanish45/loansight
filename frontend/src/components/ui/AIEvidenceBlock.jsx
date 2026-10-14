import Badge from '../common/Badge';

export default function AIEvidenceBlock({
  finding,
  className = '',
}) {
  if (!finding) return null;

  const {
    title,
    subtitle,
    severity = 'LOW',
    explanation = [],
    documents = [],
    sourceA,
    sourceB,
  } = finding;

  const severityBadges = {
    HIGH: { variant: 'error', label: 'High Severity' },
    MEDIUM: { variant: 'warning', label: 'Medium Flag' },
    LOW: { variant: 'success', label: 'Verified Match' },
  };

  const badgeConfig = severityBadges[severity] || severityBadges.LOW;

  return (
    <div className={`p-4 rounded-lg border bg-white shadow-subtle space-y-3 text-xs ${severity === 'HIGH' ? 'border-red-300' : severity === 'MEDIUM' ? 'border-amber-300' : 'border-slate-200'} ${className}`}>
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-2.5">
        <div>
          <h4 className="font-semibold text-slate-900 leading-tight">{title}</h4>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <Badge variant={badgeConfig.variant} dot>{badgeConfig.label}</Badge>
      </div>

      {(sourceA || sourceB) && (
        <div className="grid sm:grid-cols-2 gap-3 p-2.5 rounded bg-slate-50 border border-slate-200">
          {sourceA && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {sourceA.label || 'Document A Evidence'}
              </span>
              <p className="font-mono text-xs text-slate-900 bg-white p-1.5 rounded border border-slate-200 font-medium truncate">
                {sourceA.value || '—'}
              </p>
            </div>
          )}
          {sourceB && (
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {sourceB.label || 'Document B Evidence'}
              </span>
              <p className="font-mono text-xs text-slate-900 bg-white p-1.5 rounded border border-slate-200 font-medium truncate">
                {sourceB.value || '—'}
              </p>
            </div>
          )}
        </div>
      )}

      {Array.isArray(explanation) && explanation.length > 0 && (
        <ul className="list-disc list-inside text-slate-700 space-y-1 pl-1">
          {explanation.map((line, idx) => (
            <li key={idx} className="leading-relaxed">{line}</li>
          ))}
        </ul>
      )}

      {documents.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {documents.map((doc, idx) => (
            <span key={idx} className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px] font-mono text-slate-600">
              📄 {doc}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
