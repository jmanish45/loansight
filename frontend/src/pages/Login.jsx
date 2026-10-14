import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Lock,
  FileCheck,
  Building2,
  UserCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  Briefcase,
  Shield,
  BadgeCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/common/LanguageSelector';
import BrandLogo from '../components/common/BrandLogo';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Badge from '../components/common/Badge';
import Alert from '../components/common/Alert';
import { useForm } from '../hooks/useForm';
import { validators } from '../utils/validation';
import { ROUTES } from '../constants/routes';

const validationRules = {
  email: [(v) => validators.required(v, 'Email address'), validators.email],
  password: [(v) => validators.required(v, 'Password')],
};

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [activePortal, setActivePortal] = useState('applicant');

  const {
    values,
    setValues,
    errors,
    touched,
    isSubmitting,
    submitError,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useForm({
    initialValues: {
      email: '',
      password: '',
    },
    validationRules,
    onSubmit: async (data) => {
      const cleanEmail = (data.email || '').trim();
      const cleanPassword = (data.password || '').trim();
      const authUser = await login(cleanEmail, cleanPassword);
      if (activePortal === 'applicant' && authUser.role === 'officer') {
        throw new Error('Invalid credentials. Bank officers must sign in via the Officer Workspace.');
      }
      if (activePortal === 'officer' && authUser.role === 'applicant') {
        throw new Error('Invalid credentials. Applicants must sign in via the Applicant Portal.');
      }
      const destination = authUser.role === 'officer' ? '/officer' : ROUTES.APPLICANT;
      navigate(location.state?.from?.pathname || destination, { replace: true });
    },
  });

  const handleSwitchToOfficer = () => {
    setActivePortal('officer');
    setValues({ email: '', password: '' });
  };

  const handleSwitchToApplicant = () => {
    setActivePortal('applicant');
    setValues({ email: '', password: '' });
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans bg-slate-50 selection:bg-emerald-500 selection:text-white">
      {/* Left Info Panel */}
      <div className="w-full lg:w-[48%] xl:w-[45%] bg-slate-950 text-white p-8 lg:p-12 flex flex-col justify-between border-r border-slate-800/80 relative overflow-hidden">
        {/* Ambient Radial Glow & Grid pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_20%_-10%,rgba(16,185,129,0.18),rgba(255,255,255,0))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_80%_90%,rgba(56,189,248,0.1),rgba(255,255,255,0))]" />
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="space-y-8 relative z-10">
          <div className="flex items-center justify-between">
            <BrandLogo variant="light" size="md" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Engine v2.4 Online
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            <Badge variant="navy" dot>
              {t('secure_underwriting_portal', 'SECURE UNDERWRITING PORTAL')}
            </Badge>
            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-bold tracking-tight text-white leading-tight">
              {t('headline', 'Grounded Credit Intelligence & Verification')}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-md">
              {t('sub_headline', 'Sign in to manage loan applications, evaluate automated cross-document diffs, and access real-time policy RAG verification.')}
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="space-y-3 pt-2">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md flex items-start gap-3.5 hover:border-slate-700/80 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <FileCheck className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                  {t('feature_kyc_title', 'Cross-Document Verification')}
                  <Sparkles className="w-3 h-3 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {t('feature_kyc_desc', 'Automated OCR diff engine flags salary slip vs bank credit discrepancies instant.')}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md flex items-start gap-3.5 hover:border-slate-700/80 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <ShieldCheck className="w-4 h-4 text-sky-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white group-hover:text-sky-400 transition-colors flex items-center gap-1.5">
                  {t('feature_rag_title', 'Vector RAG Policy Grounding')}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {t('feature_rag_desc', 'AI copilot strictly grounded in 14 indexed bank credit clauses with zero hallucination.')}
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800/90 backdrop-blur-md flex items-start gap-3.5 hover:border-slate-700/80 transition-colors group">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Zap className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-white group-hover:text-indigo-400 transition-colors">
                  {t('feature_foir_title', 'Real-Time FOIR Risk Limit Engine')}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  {t('feature_foir_desc', 'Dynamic stress testing on net disposable income and obligations before approval.')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-8 mt-8 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 font-mono relative z-10">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" /> {t('secure_ssl', 'AES-256 Encrypted')}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Shield className="w-3 h-3 text-slate-400" /> SOC2 Type II
          </span>
          <span>LoanSight AI © {new Date().getFullYear()}</span>
        </div>
      </div>

      {/* Right Form Panel */}
      <div className="w-full lg:w-[52%] xl:w-[55%] bg-white p-8 lg:p-12 flex flex-col justify-between">
        <div className="flex items-center justify-between pb-4">
          <div className="flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide uppercase ${
                activePortal === 'officer'
                  ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
              }`}
            >
              {activePortal === 'officer' ? t('officer_workspace', 'Bank Officer Workspace') : t('applicant_portal', 'Applicant Portal')}
            </span>
          </div>
          <LanguageSelector variant="light" />
        </div>

        <div className="max-w-md w-full mx-auto py-6 space-y-6">
          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              {activePortal === 'officer' ? (
                <>
                  <Building2 className="w-6 h-6 text-indigo-600" />
                  {t('signin_title_officer', 'Officer Underwriting Sign In')}
                </>
              ) : (
                <>
                  <UserCheck className="w-6 h-6 text-emerald-600" />
                  {t('signin_title_applicant', 'Applicant Sign In')}
                </>
              )}
            </h2>
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              {activePortal === 'officer'
                ? t('signin_subtitle_officer', 'Enter your bank credentials to access the credit committee workstation.')
                : t('signin_subtitle_applicant', 'Enter your credentials to manage loan applications and document verification.')}
            </p>
          </div>



          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label={t('email_label', 'Email Address / Username')}
              name="email"
              type="email"
              value={values.email}
              onChange={handleChange}
              onBlur={handleBlur}
              placeholder="you@example.com"
              error={touched.email ? errors.email : null}
              required
            />

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] text-slate-400 font-mono">{t('default_pwd_hint', 'Default: Password123!')}</span>
              </div>
              <div className="relative">
                <Input
                  label={t('password_label', 'Password')}
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••••••"
                  error={touched.password ? errors.password : null}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {submitError && <Alert variant="error">{submitError}</Alert>}

            <Button
              type="submit"
              variant="navy"
              size="lg"
              loading={isSubmitting}
              className="w-full shadow-md hover:shadow-lg transition-all"
            >
              <span>{t('sign_in', 'Sign In')}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {/* Switch Portal Action Card */}
          <div className="pt-4 border-t border-slate-200/80 space-y-4">
            {activePortal === 'applicant' ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">{t('are_you_officer', 'Are you a Bank Underwriting Officer?')}</p>
                <button
                  type="button"
                  onClick={handleSwitchToOfficer}
                  className="w-full text-left p-3.5 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/60 to-slate-50 hover:from-indigo-100/70 hover:to-indigo-50/50 hover:border-indigo-300 transition-all duration-200 flex items-center justify-between group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-950 group-hover:text-indigo-700 transition-colors flex items-center gap-1.5">
                        {t('access_officer_workspace', 'Access Bank Officer Workspace')}
                        <BadgeCheck className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('underwriter_desc', 'Underwriter decisioning desk & AI RAG assistant')}
                      </div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white border border-indigo-200 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all ml-2">
                    <ArrowRight className="w-3.5 h-3.5 text-indigo-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500">{t('are_you_applicant', 'Looking for the Loan Applicant portal?')}</p>
                <button
                  type="button"
                  onClick={handleSwitchToApplicant}
                  className="w-full text-left p-3.5 rounded-xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/60 to-slate-50 hover:from-emerald-100/70 hover:to-emerald-50/50 hover:border-emerald-300 transition-all duration-200 flex items-center justify-between group cursor-pointer shadow-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-950 group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                        {t('access_applicant_portal', 'Access Loan Applicant Portal')}
                        <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {t('track_status_desc', 'Track application status & document analysis')}
                      </div>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-white border border-emerald-200 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-all ml-2">
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-600 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                </button>
              </div>
            )}

            <div className="text-center pt-2">
              <p className="text-xs text-slate-500">
                {t('dont_have_account', "Don't have an account?")}{' '}
                <Link to={ROUTES.REGISTER} className="font-semibold text-emerald-700 hover:text-emerald-800 hover:underline">
                  {t('apply_new_customer', 'Create a LoanSight Account')}
                </Link>
              </p>
            </div>
          </div>
        </div>

        <div className="text-center text-[11px] text-slate-400 flex items-center justify-center gap-2 border-t border-slate-100 pt-4">
          <Shield className="w-3.5 h-3.5 text-emerald-600" />
          {t('protected_by_tls', 'Protected by Bank-Grade TLS 1.3 Encryption & Hardware Security Module')}
        </div>
      </div>
    </div>
  );
}
