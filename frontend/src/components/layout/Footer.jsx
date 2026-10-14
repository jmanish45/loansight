import { Link } from 'react-router-dom';
import Container from './Container';
import BrandLogo from '../common/BrandLogo';
import { ROUTES } from '../../constants/routes';
import { useLanguage } from '../../context/LanguageContext';

export default function Footer() {
  const { t } = useLanguage();

  const footerLinks = {
    [t('platform', 'Platform')]: [
      { label: t('how_it_works', 'How It Works'), href: '#how-it-works' },
      { label: t('security', 'Security'), href: '#security' },
      { label: 'Documentation', href: '#' },
    ],
    Company: [
      { label: 'About', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
    Legal: [
      { label: t('privacy_link', 'Privacy Policy'), href: '#' },
      { label: t('terms_link', 'Terms of Service'), href: '#' },
      { label: 'Cookie Policy', href: '#' },
    ],
  };

  return (
    <footer className="border-t border-slate-800 bg-slate-950 text-slate-400">
      <Container>
        <div className="py-12 md:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {/* Brand Column */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <BrandLogo to={ROUTES.HOME} variant="light" size="sm" />
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                {t('footer_tagline', 'Cross-document verification & policy-grounded loan underwriting intelligence.')}
              </p>
            </div>

            {/* Link Columns */}
            {Object.entries(footerLinks).map(([heading, links]) => (
              <div key={heading}>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-200 mb-3">{heading}</h4>
                <ul className="flex flex-col gap-2">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-xs text-slate-400 hover:text-white transition-colors duration-150"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="mt-12 pt-6 border-t border-slate-800/80 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-500">
            <p>© {new Date().getFullYear()} LoanSight AI. All rights reserved.</p>
            <p>{t('built_for_lending', 'Built for intelligent loan underwriting.')}</p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
