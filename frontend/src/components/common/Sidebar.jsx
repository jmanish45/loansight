import { Link, useLocation } from 'react-router-dom';

export default function Sidebar({
  links = [],
  header,
  footer,
  className = '',
}) {
  const location = useLocation();

  return (
    <aside className={`w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 ${className}`}>
      <div className="p-4 space-y-6 overflow-y-auto">
        {header}
        <nav className="space-y-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            const Icon = link.icon;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`
                  flex items-center gap-3 px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150
                  ${isActive
                    ? 'bg-slate-800 text-white font-semibold shadow-subtle'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }
                `}
              >
                {Icon && <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} aria-hidden="true" />}
                <span className="truncate">{link.label}</span>
                {link.badge !== undefined && (
                  <span className="ml-auto px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {footer && <div className="p-4 border-t border-slate-800">{footer}</div>}
    </aside>
  );
}
