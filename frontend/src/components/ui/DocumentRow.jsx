import Badge from '../common/Badge';

export function DocumentStatus({ status }) {
  const metaMap = {
    completed: { label: 'Extracted', variant: 'emerald', dot: true },
    processing: { label: 'Extracting...', variant: 'amber', dot: true },
    pending: { label: 'Pending', variant: 'neutral', dot: false },
    failed: { label: 'Failed', variant: 'error', dot: true },
    approved: { label: 'Approved', variant: 'emerald', dot: true },
    rejected: { label: 'Rejected', variant: 'error', dot: true },
    pending_review: { label: 'Under Review', variant: 'amber', dot: true },
  };

  const meta = metaMap[status] || { label: status || 'Unknown', variant: 'neutral', dot: false };

  return <Badge variant={meta.variant} dot={meta.dot}>{meta.label}</Badge>;
}

export function DocumentRow({
  name,
  typeLabel,
  status,
  processedAt,
  confidence,
  onView,
  onDownload,
  onReprocess,
  className = '',
}) {
  return (
    <div className={`p-3.5 rounded-lg border border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 grid place-items-center shrink-0">
          <span className="font-mono text-[10px] font-bold text-slate-600 uppercase">PDF</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-900 truncate">{name}</p>
          <p className="text-[11px] text-slate-500 mt-0.5">{typeLabel}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {confidence !== undefined && confidence !== null && (
          <span className="font-mono text-[11px] text-slate-600">
            {(confidence * 100).toFixed(0)}% OCR
          </span>
        )}
        <DocumentStatus status={status} />
        <div className="flex items-center gap-1 border-l border-slate-200 pl-2">
          {onView && (
            <button
              type="button"
              onClick={onView}
              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
            >
              View
            </button>
          )}
          {onDownload && (
            <button
              type="button"
              onClick={onDownload}
              className="px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
            >
              Download
            </button>
          )}
          {onReprocess && (
            <button
              type="button"
              onClick={onReprocess}
              className="px-2 py-1 text-[11px] font-medium text-sky-600 hover:bg-sky-50 rounded cursor-pointer"
            >
              Reprocess
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
