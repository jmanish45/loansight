import { CheckCircle2 } from 'lucide-react';

export default function SuccessState({
  title = 'Operation completed successfully',
  description = 'Your action was processed and verified.',
  action,
  className = '',
}) {
  return (
    <div className={`p-8 text-center border border-emerald-200 rounded-lg bg-emerald-50/50 flex flex-col items-center justify-center ${className}`}>
      <span className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 grid place-items-center mb-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-emerald-900">{title}</h3>
      <p className="text-xs text-emerald-700 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
