export function Table({ children, className = '' }) {
  return (
    <div className="w-full overflow-x-auto border border-slate-200 rounded-lg bg-white shadow-subtle">
      <table className={`w-full text-left border-collapse text-sm ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <thead className={`bg-slate-50 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </thead>
  );
}

export function TableRow({ children, onClick, className = '', hoverable = true }) {
  return (
    <tr
      onClick={onClick}
      className={`
        border-b border-slate-100 last:border-0 transition-colors duration-150
        ${hoverable ? 'hover:bg-slate-50/80 cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '', mono = false, align = 'left' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td className={`px-4 py-3 text-slate-900 ${alignClass} ${mono ? 'font-mono tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  );
}

export function TableHeadCell({ children, className = '', align = 'left' }) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-2.5 font-semibold text-slate-600 ${alignClass} ${className}`}>
      {children}
    </th>
  );
}
