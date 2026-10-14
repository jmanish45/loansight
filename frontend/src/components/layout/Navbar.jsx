import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Container from './Container';
import Button from '../common/Button';
import BrandLogo from '../common/BrandLogo';
import LanguageSelector from '../common/LanguageSelector';
import { ROUTES } from '../../constants/routes';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const isLanding = location.pathname === '/';

  const navLinks = [
    { label: t('platform', 'Platform'), href: '#platform' },
    { label: t('how_it_works', 'How It Works'), href: '#how-it-works' },
    { label: t('security', 'Security'), href: '#security' },
  ];

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setIsMobileOpen(false);
  }, [location]);

  return (
    <nav
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-200
        ${isScrolled ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-subtle' : 'bg-transparent'}
      `}
      role="navigation"
      aria-label="Main navigation"
    >
      <Container>
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <BrandLogo to={ROUTES.HOME} variant="dark" size="md" />

          {/* Desktop Links */}
          {isLanding && (
            <div className="hidden md:flex items-center gap-6">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
            </div>
          )}

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center gap-3">
            <LanguageSelector variant="light" />
            {user ? (
              <>
                <Link to={user.role === 'officer' ? '/officer' : ROUTES.APPLICANT}>
                  <Button variant="ghost" size="sm">{t('dashboard', 'Dashboard')}</Button>
                </Link>
                <Button variant="secondary" size="sm" onClick={logout}>{t('sign_out', 'Sign Out')}</Button>
              </>
            ) : (
              <>
                <Link to={ROUTES.LOGIN}>
                  <Button variant="ghost" size="sm">{t('sign_in', 'Sign In')}</Button>
                </Link>
                <Link to={ROUTES.APPLY}>
                  <Button variant="navy" size="sm">{t('start_application', 'Start Application')}</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Toggle */}
          <button
            type="button"
            className="md:hidden p-2 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
            onClick={() => setIsMobileOpen(!isMobileOpen)}
            aria-expanded={isMobileOpen}
            aria-label="Toggle navigation menu"
          >
            {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile Menu */}
      {isMobileOpen && (
        <div className="md:hidden bg-white border-b border-slate-200 shadow-panel">
          <Container>
            <div className="py-4 flex flex-col gap-2">
              {isLanding && navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="py-2 text-xs font-semibold uppercase tracking-wider text-slate-600 hover:text-slate-900 transition-colors"
                  onClick={() => setIsMobileOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 pt-3 mt-2 border-t border-slate-200">
                {user ? (
                  <>
                    <Link to={ROUTES.APPLICANT} onClick={() => setIsMobileOpen(false)}>
                      <Button variant="navy" size="sm" className="w-full">{t('dashboard', 'Dashboard')}</Button>
                    </Link>
                    <Button variant="secondary" size="sm" className="w-full" onClick={() => { logout(); setIsMobileOpen(false); }}>{t('sign_out', 'Sign Out')}</Button>
                  </>
                ) : (
                  <>
                    <Link to={ROUTES.LOGIN} onClick={() => setIsMobileOpen(false)}>
                      <Button variant="secondary" size="sm" className="w-full">{t('sign_in', 'Sign In')}</Button>
                    </Link>
                    <Link to={ROUTES.APPLY} onClick={() => setIsMobileOpen(false)}>
                      <Button variant="navy" size="sm" className="w-full">{t('start_application', 'Start Application')}</Button>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </Container>
        </div>
      )}
    </nav>
  );
}
