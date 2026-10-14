import BrandLogo from './BrandLogo';
import LanguageSelector from './LanguageSelector';
import Avatar from './Avatar';

export default function Header({
  user,
  onLogout,
  title,
  subtitle,
  actions,
  className = '',
}) {
  return (
    <header className={`h-16 px-4 md:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 sticky top-0 z-40 ${className}`}>
      <div className="flex items-center gap-4 min-w-0">
        <BrandLogo variant="dark" size="sm" />
        {(title || subtitle) && (
          <div className="hidden sm:block border-l border-slate-200 pl-4 min-w-0">
            {title && <h1 className="text-sm font-semibold text-slate-900 truncate leading-tight">{title}</h1>}
            {subtitle && <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 shrink-0">
        {actions}
        <LanguageSelector variant="light" />
        {user && (
          <div className="flex items-center gap-2.5 border-l border-slate-200 pl-3">
            <Avatar name={user.name || user.email} size="sm" variant="navy" />
            <div className="hidden md:block text-left text-xs">
              <p className="font-semibold text-slate-900 leading-tight truncate max-w-[120px]">
                {user.name || user.email}
              </p>
              <p className="text-[10px] text-slate-500 capitalize">{user.role || 'User'}</p>
            </div>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="text-xs text-slate-500 hover:text-slate-900 transition-colors ml-1 cursor-pointer"
              >
                Sign out
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
