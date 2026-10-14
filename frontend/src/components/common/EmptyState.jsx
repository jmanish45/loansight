import { FolderOpen } from 'lucide-react';

export default function EmptyState({
  title = 'No data available',
  description = 'There are no items matching your criteria.',
  icon: Icon = FolderOpen,
  action,
  className = '',
}) {
  return (
    <div className={`p-8 text-center border border-dashed border-slate-200 rounded-lg bg-slate-50/50 flex flex-col items-center justify-center ${className}`}>
      <span className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 grid place-items-center mb-3">
        <Icon className="w-5 h-5 text-slate-400" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
