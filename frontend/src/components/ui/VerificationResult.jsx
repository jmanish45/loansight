import { CheckCircle2, AlertTriangle, Shield } from 'lucide-react';
import Badge from '../common/Badge';

export default function VerificationResult({
  validation,
  className = '',
}) {
  if (!validation) return null;

  const {
    status = 'PENDING_DOCS',
    verificationScore = 0,
    riskLevel = 'LOW',
    checks = [],
    keyFindings = [],
  } = validation;

  const passedChecks = checks.filter((c) => c.status === 'PASSED').length;
  const flaggedChecks = checks.filter((c) => c.status === 'FLAGGED').length;

  return (
    <div className={`p-4 rounded-lg border border-slate-200 bg-white shadow-subtle space-y-4 text-xs ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-600 shrink-0" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Verification Result</h3>
            <p className="text-[11px] text-slate-500">Cross-Document Validation Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={status === 'PASSED' ? 'emerald' : status === 'FLAGGED' ? 'warning' : 'neutral'} dot>
            {status}
          </Badge>
          <span className="font-mono font-bold text-sm text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 tabular-nums">
            {verificationScore}/100
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200">
          <div className="flex items-center justify-center gap-1 text-emerald-700 font-semibold mb-0.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums text-sm">{passedChecks}</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-emerald-800 tracking-wider">Passed Checks</span>
        </div>
        <div className="p-2.5 rounded bg-amber-50 border border-amber-200">
          <div className="flex items-center justify-center gap-1 text-amber-700 font-semibold mb-0.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="font-mono tabular-nums text-sm">{flaggedChecks}</span>
          </div>
          <span className="text-[10px] uppercase font-semibold text-amber-800 tracking-wider">Flagged Checks</span>
        </div>
      </div>

      {keyFindings.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Key Underwriting Findings</span>
          <ul className="space-y-1 pl-1">
            {keyFindings.map((finding, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <span className="text-slate-400 font-mono text-[10px]">•</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
