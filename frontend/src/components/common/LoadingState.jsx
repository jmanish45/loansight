import { Loader2 } from 'lucide-react';

export default function LoadingState({
  title = 'Loading application data...',
  description = 'Please wait while we retrieve the latest information.',
  className = '',
}) {
  return (
    <div className={`p-10 text-center border border-slate-200 rounded-lg bg-white shadow-subtle flex flex-col items-center justify-center ${className}`}>
      <Loader2 className="w-6 h-6 text-sky-600 animate-spin mb-3" aria-hidden="true" />
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
    </div>
  );
}
