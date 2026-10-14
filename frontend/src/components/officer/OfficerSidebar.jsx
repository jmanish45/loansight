import { useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import {
  Aperture,
  LayoutDashboard,
  Files,
  Inbox,
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';
import { useLanguage } from '../../context/LanguageContext';
import { ROUTES } from '../../constants/routes';
import { initialsOf } from '../../lib/officerData';

const BASE =
  'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors';
const IDLE = 'text-slate-300 hover:bg-white/5 hover:text-white';
const ACTIVE = 'bg-navy-800 text-white';

function NavContents({ counts, onNavigate }) {
  const location = useLocation();
  const [params] = useSearchParams();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { key: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, to: ROUTES.OFFICER },
    { key: 'all', label: t('all_applications', 'All Applications'), icon: Files, to: ROUTES.OFFICER_APPLICATIONS },
  ];

  const QUEUE_ITEMS = [
    {
      key: 'submitted',
      label: t('new_submissions', 'New Submissions'),
      icon: Inbox,
      status: 'submitted',
      countKey: 'submitted',
    },
    {
      key: 'under_review',
      label: t('under_review', 'Under Review'),
      icon: ClipboardCheck,
      status: 'under_review',
      countKey: 'underReview',
    },
    {
      key: 'documents_required',
      label: t('documents_required', 'Documents Required'),
      icon: AlertTriangle,
      status: 'documents_required',
      countKey: 'docsRequired',
      urgent: true,
    },
  ];

  const activeStatus = params.get('status') || '';
  const onList = location.pathname.startsWith(ROUTES.OFFICER_APPLICATIONS);
  const onDetails = /\/officer\/applications\/[^/]+$/.test(location.pathname);

  const activeKey = onDetails
    ? 'all'
    : onList
      ? activeStatus || 'all'
      : location.pathname === ROUTES.OFFICER
        ? 'dashboard'
        : null;

  return (
    <>
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 shrink-0">
        <BrandLogo to={null} variant="light" size="sm" showBadge={true} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
          {t('officer_badge', 'Officer')}
        </span>
      </div>

      <nav aria-label="Officer navigation" className="px-3 pt-5 overflow-y-auto">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mb-2">
          {t('menu', 'Menu')}
        </p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            return (
              <li key={item.key} className="relative">
                {isActive && (
                  <span
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                )}
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={`${BASE} ${isActive ? ACTIVE : IDLE}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-3 mt-6 mb-2">
          {t('work_queue', 'Work Queue')}
        </p>
        <ul className="space-y-1">
          {QUEUE_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeKey === item.key;
            const count = counts?.[item.countKey] ?? null;
            return (
              <li key={item.key} className="relative">
                {isActive && (
                  <span
                    className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-emerald-500"
                    aria-hidden="true"
                  />
                )}
                <Link
                  to={`${ROUTES.OFFICER_APPLICATIONS}?status=${item.status}`}
                  onClick={onNavigate}
                  className={`${BASE} ${isActive ? ACTIVE : IDLE}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {count !== null && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ${
                        item.urgent && count > 0
                          ? 'bg-red-500 text-white'
                          : 'bg-white/10 text-slate-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto p-3 space-y-2">
        <div className="bg-navy-800 border border-white/5 rounded-xl p-3">
          <p className="text-xs font-medium text-white mb-1">
            {initialsOf(user?.name) ? `${t('officer_badge', 'Officer')} ${user?.name}` : t('officer_workspace', 'Officer Workspace')}
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-px" aria-hidden="true" />
            {t('officer_audit_notice', 'Every decision you record is written to the application audit trail.')}
          </p>
        </div>

        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
        >
          <LogOut className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
          {t('sign_out', 'Sign Out')}
        </button>
      </div>
    </>
  );
}

export default function OfficerSidebar({ counts = null, open = false, onClose = () => {} }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <>
      <aside className="hidden lg:flex flex-col w-64 shrink-0 bg-navy-900 h-screen sticky top-0">
        <NavContents counts={counts} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={onClose}
            className="absolute inset-0 w-full h-full bg-navy-950/60 cursor-pointer"
          />
          <div className="relative flex flex-col w-72 h-full bg-navy-900">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="absolute top-4 right-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
            <NavContents counts={counts} onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
