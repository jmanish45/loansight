import { Link } from 'react-router-dom';
import { Menu, Bell, Clock } from 'lucide-react';
import LanguageSelector from '../common/LanguageSelector';
import { ROUTES } from '../../constants/routes';
import { initialsOf } from '../../lib/officerData';

import { useLanguage } from '../../context/LanguageContext';

/**
 * Officer topbar. Title and subtitle are derived from the route by OfficerLayout
 * so individual pages don't have to render their own page header.
 */
export default function OfficerTopbar({
  title = '',
  subtitle = '',
  userName = '',
  role = 'officer',
  alertCount = 0,
  onMenuClick = () => {},
}) {
  const { t } = useLanguage();

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

        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-slate-900 leading-tight truncate">{title}</p>
          <p className="text-xs text-slate-400 truncate">{subtitle}</p>
        </div>

        <div className="flex items-center gap-3 shrink-0 ml-auto">
          <LanguageSelector variant="light" />

          <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
            {t('live_queue', 'Live queue')}
          </span>

          <Link
            to={`${ROUTES.OFFICER_APPLICATIONS}?status=documents_required`}
            aria-label={
              alertCount > 0
                ? `${alertCount} application${alertCount === 1 ? '' : 's'} waiting on documents`
                : 'No applications waiting on documents'
            }
            className="relative text-slate-600 hover:text-slate-900 transition-colors"
          >
            <Bell className="w-[18px] h-[18px]" />
            {alertCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-semibold rounded-full grid place-items-center tabular-nums">
                {alertCount}
              </span>
            )}
          </Link>

          <span className="w-px h-8 bg-slate-200" aria-hidden="true" />

          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-full bg-navy-900 text-white text-xs font-semibold grid place-items-center shrink-0">
              {initialsOf(userName)}
            </span>
            <span className="hidden md:block min-w-0">
              <span className="block text-sm font-medium text-slate-900 truncate max-w-[140px]">
                {userName || t('bank_officer_title', 'Bank Underwriting Officer')}
              </span>
              <span className="block text-[11px] text-slate-400 capitalize">
                {t('bank_officer_title', 'Bank Underwriting Officer')}
              </span>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
