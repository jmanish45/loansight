import { Clock } from 'lucide-react';
import { formatDate } from '../../lib/officerData';

export default function Timeline({ events = [], className = '' }) {
  if (!events || events.length === 0) {
    return <p className="text-xs text-slate-500 italic py-2">No activity events logged yet.</p>;
  }

  return (
    <div className={`relative pl-4 space-y-4 border-l-2 border-slate-200 ${className}`}>
      {events.map((item, idx) => (
        <div key={item._id || idx} className="relative group">
          <div className="absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-400 group-hover:border-sky-600 transition-colors" />
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-slate-900">{item.action || item.title}</span>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {formatDate(item.createdAt || item.timestamp)}
            </span>
          </div>
          {item.description && (
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{item.description}</p>
          )}
          {item.performedBy && (
            <p className="text-[11px] text-slate-400 mt-0.5">By {item.performedBy.name || item.performedBy}</p>
          )}
        </div>
      ))}
    </div>
  );
}
