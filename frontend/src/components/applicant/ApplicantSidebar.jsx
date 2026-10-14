import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Aperture,
  LayoutDashboard,
  FilePlus2,
  Files,
  AlertTriangle,
  ShieldCheck,
  LogOut,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../common/BrandLogo';
import { useLanguage } from '../../context/LanguageContext';
import { ROUTES } from '../../constants/routes';

function NavContents({ actionRequiredCount, onNavigate }) {
  const location = useLocation();
  const { logout } = useAuth();
  const { t } = useLanguage();

  const NAV_ITEMS = [
    { key: 'dashboard', label: t('dashboard', 'Dashboard'), icon: LayoutDashboard, to: ROUTES.APPLICANT },
    { key: 'apply', label: t('start_application', 'Start Application'), icon: FilePlus2, to: ROUTES.APPLY },
    {
      key: 'applications',
      label: t('current_application', 'Current Application'),
      icon: Files,
      to: `${ROUTES.APPLICANT}#applications`,
    },
    {
      key: 'action',
      label: t('action_required', 'Action Required'),
      icon: AlertTriangle,
      to: ROUTES.ACTION_REQUIRED,
      badged: true,
    },
  ];

  const activeKey =
    location.pathname === ROUTES.APPLY
      ? 'apply'
      : location.pathname === ROUTES.ACTION_REQUIRED
        ? 'action'
        : location.pathname === ROUTES.APPLICANT
          ? 'dashboard'
          : null;

  const base =
    'relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors';
  const idle = 'text-slate-300 hover:bg-white/5 hover:text-white';
  const active = 'bg-navy-800 text-white';

  return (
    <>
      <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 shrink-0">
        <BrandLogo to={null} variant="light" size="sm" showBadge={true} />
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          {t('applicant_badge', 'Applicant')}
        </span>
      </div>

      <nav aria-label="Applicant navigation" className="px-3 pt-5">
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
                  className={`${base} ${isActive ? active : idle}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" aria-hidden="true" />
                  <span className="flex-1">{item.label}</span>
                  {item.badged && actionRequiredCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums">
                      {actionRequiredCount}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto p-3 space-y-2">
        <div className="bg-navy-800 border border-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">{t('verified_and_secure', 'Verified & Secure')}</p>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            {t('applicant_security_notice', 'Your documents are encrypted and reviewed only by authorised loan officers.')}
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

export default function ApplicantSidebar({ actionRequiredCount = 0, open = false, onClose = () => {} }) {
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
        <NavContents actionRequiredCount={actionRequiredCount} />
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
            <NavContents actionRequiredCount={actionRequiredCount} onNavigate={onClose} />
          </div>
        </div>
      )}
    </>
  );
}
