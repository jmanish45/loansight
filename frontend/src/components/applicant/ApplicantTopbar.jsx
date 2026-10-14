import { Menu, Search } from 'lucide-react';
import NotificationBell from './NotificationBell';
import LanguageSelector from '../common/LanguageSelector';
import { useLanguage } from '../../context/LanguageContext';

function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

export default function ApplicantTopbar({
  userName = '',
  subtitle = '',
  searchTerm = '',
  onSearchChange = () => {},
  showSearch = true,
  onMenuClick = () => {},
}) {
  const { t } = useLanguage();
  const firstName = String(userName || '').trim().split(/\s+/)[0] || 'there';

  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200">
      <div className="flex items-center gap-4 h-full px-4 lg:px-8">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label="Open navigation"
          className="lg:hidden text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
        >
          <Menu className="w-[18px] h-[18px]" />
        </button>

        <div className="hidden sm:block min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 leading-tight truncate">
            {t('welcome_back', 'Welcome back')}, {firstName}
          </p>
          <p className="text-xs text-slate-400 truncate">
            {subtitle || t('loan_activity_glance', "Here's your loan activity at a glance.")}
          </p>
        </div>

        {showSearch && (
          <div className="relative flex-1 max-w-md ml-auto group">
            <Search
              className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-emerald-600 transition-colors"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t('search_applicant_placeholder', 'Search applications, policies... (Press Ctrl+K)')}
              aria-label="Search your applications"
              className="w-full pl-9 pr-14 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 focus:bg-white transition-colors"
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 absolute right-2.5 top-1/2 -translate-y-1/2 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-slate-400 bg-white border border-slate-200 rounded shadow-2xs pointer-events-none">
              <span className="text-[11px]">⌘</span>K
            </kbd>
          </div>
        )}

        <div className={`flex items-center gap-3 shrink-0 ${showSearch ? '' : 'ml-auto'}`}>
          <LanguageSelector variant="light" />
          <NotificationBell />

          <span className="w-px h-8 bg-slate-200" aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-semibold grid place-items-center shrink-0">
              {initialsOf(userName)}
            </span>
            <span className="text-sm font-medium text-slate-900 hidden md:block truncate max-w-[140px]">
              {userName || 'Applicant'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
