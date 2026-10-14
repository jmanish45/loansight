import { BookOpen } from 'lucide-react';
import Badge from '../common/Badge';

export default function PolicyReference({
  policyNumber,
  category,
  title,
  text,
  similarityScore,
  className = '',
}) {
  return (
    <div className={`p-3.5 rounded-lg border border-slate-200 bg-white shadow-subtle space-y-2 text-xs ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-sky-600 shrink-0" aria-hidden="true" />
          <span className="font-semibold text-slate-900 truncate">
            {policyNumber ? `Clause ${policyNumber}: ` : ''}{title || category || 'Bank Policy Citation'}
          </span>
        </div>
        {similarityScore && (
          <Badge variant="sky" size="sm">
            {(similarityScore * 100).toFixed(0)}% Match
          </Badge>
        )}
      </div>

      {text && (
        <p className="text-slate-600 bg-slate-50 p-2.5 rounded border border-slate-200 text-[11px] leading-relaxed font-mono">
          "{text}"
        </p>
      )}

      {category && (
        <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
          Category: {category}
        </div>
      )}
    </div>
  );
}
