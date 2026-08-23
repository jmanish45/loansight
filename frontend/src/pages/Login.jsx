import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Aperture,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  Building,
  Brain,
  FileCheck2,
  PieChart,
  Shield,
  Smartphone,
  UserCheck,
  Lock,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import LanguageSelector from '../components/common/LanguageSelector';
import { useForm } from '../hooks/useForm';
import { validators } from '../utils/validation';
import { ROUTES } from '../constants/routes';

const validationRules = {
  email: [
    (v) => validators.required(v, 'Email address'),
    validators.email,
  ],
  password: [
    (v) => validators.required(v, 'Password'),
  ],
};

export default function Login() {
  const { login } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();

  const [showPassword, setShowPassword] = useState(false);
  const [activePortal, setActivePortal] = useState('applicant'); // 'applicant' | 'officer'

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
      const authUser = await login(data.email, data.password);
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
    <div className="min-h-screen w-full flex flex-col lg:flex-row font-sans bg-white">
      
      {/* ─────────────────────────────────────────────────────────────
          LEFT SIDE: Dark Navy Hero & Feature Showcase (Exact Structure)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[54%] bg-gradient-to-br from-navy-950 via-[#0A192F] to-[#0D2137] text-white p-8 lg:p-14 flex flex-col justify-between relative overflow-hidden border-r border-slate-800">
        
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Top Header / Brand Logo */}
        <div className="relative z-10">
          <Link to={ROUTES.HOME} className="inline-flex items-center gap-3.5 group">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/20 group-hover:scale-105 transition-transform">
              <div className="w-full h-full bg-navy-950 rounded-[10px] flex items-center justify-center">
                <Aperture className="w-6 h-6 text-cyan-400" />
              </div>
            </div>
            <div>
              <span className="text-2xl font-black tracking-tight text-white flex items-center gap-1.5 leading-none">
                {t('brand_name')} <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">AI</span>
              </span>
              <span className="text-[11px] font-bold tracking-widest text-slate-400 uppercase mt-1 block">
                {t('for_people')}
              </span>
            </div>
          </Link>

          {/* Sub-tag */}
          <div className="mt-10">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-cyan-400 mb-3">
              {t('platform_badge')}
            </p>

            {/* Prominent Large Headline in Glass Box */}
            <div className="inline-block p-4 sm:p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
              <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-black uppercase tracking-tight text-white leading-tight">
                {t('headline')}
              </h1>
            </div>

            {/* Paragraph Description */}
            <p className="text-slate-300 text-sm sm:text-[15px] leading-relaxed mt-6 max-w-lg">
              {t('sub_headline')}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400/90 mt-3">
              {t('verify_evaluate_approve')}
            </p>
          </div>
        </div>

        {/* Middle: 3 Feature Cards in Vertical Stack */}
        <div className="relative z-10 my-8 space-y-3.5">
          {/* Card 1 */}
          <div className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm transition-all duration-200 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">{t('feature_rag_title')}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                {t('feature_rag_desc')}
              </p>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm transition-all duration-200 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">{t('feature_kyc_title')}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                {t('feature_kyc_desc')}
              </p>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-4 rounded-xl bg-slate-900/50 hover:bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm transition-all duration-200 flex items-start gap-4 shadow-sm">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white leading-tight">{t('feature_foir_title')}</h4>
              <p className="text-xs text-slate-400 mt-1 leading-snug">
                {t('feature_foir_desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Section: Micro-Trust Badges */}
        <div className="relative z-10 pt-4 border-t border-slate-800/60">
          {/* Footer Security Badges */}
          <div className="flex items-center gap-5 mt-4 pt-3 border-t border-slate-800/40 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {t('secure_ssl')}
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400" /> {t('zero_data_selling')}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> {t('instant_rag')}
            </span>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          RIGHT SIDE: Crisp White Sign-In Form with Language Selector
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full lg:w-[46%] bg-white p-8 lg:p-14 flex flex-col justify-between">
        
        {/* Top Header / Language Picker Dropdown */}
        <div className="flex justify-end items-center">
          <LanguageSelector variant="light" />
        </div>

        {/* Main Sign In Box */}
        <div className="max-w-md w-full mx-auto my-auto py-6">
          
          {/* Top Blue Device / Key Icon */}
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 mb-6 shadow-2xs">
            <Smartphone className="w-6 h-6" />
          </div>

          {/* Heading */}
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
            {t('signin_title')}
          </h2>
          <p className="text-sm text-slate-500 mt-1 mb-8">
            {activePortal === 'officer'
              ? t('signin_subtitle_officer')
              : t('signin_subtitle_applicant')}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            
            {/* Email / Username Input */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                {t('email_label')}
              </label>
              
              <div className="flex rounded-xl border border-slate-300 focus-within:border-indigo-600 focus-within:ring-3 focus-within:ring-indigo-500/10 transition-all overflow-hidden shadow-2xs">
                <div className="bg-slate-50 px-3.5 py-3 border-r border-slate-200 flex items-center gap-1 text-xs font-bold text-slate-600 shrink-0">
                  <span>IN</span>
                  <span className="text-slate-400 font-normal">@</span>
                </div>
                <input
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-3 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none bg-white"
                />
              </div>

              {touched.email && errors.email && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.email}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  {t('password_label')}
                </label>
              </div>
              
              <div className="relative rounded-xl border border-slate-300 focus-within:border-indigo-600 focus-within:ring-3 focus-within:ring-indigo-500/10 transition-all overflow-hidden shadow-2xs">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full px-3.5 py-3 pr-10 text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none bg-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {touched.password && errors.password && (
                <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.password}</p>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium animate-fade-in flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                {submitError}
              </div>
            )}

            {/* Continue Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className={`
                w-full py-3.5 px-6 rounded-xl text-sm font-bold text-white
                bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700
                shadow-md shadow-indigo-500/20 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200
                flex items-center justify-center gap-2 cursor-pointer
                ${isSubmitting ? 'opacity-80 cursor-not-allowed' : 'active:scale-[0.99]'}
              `}
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('continue_btn')}...
                </>
              ) : (
                <>
                  {t('continue_btn')} <ArrowRight className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          </form>

          {/* Terms Agreement Note */}
          <p className="text-center text-xs text-slate-400 mt-5">
            {t('terms_prefix')}{' '}
            <a href="#terms" className="text-indigo-600 hover:underline font-semibold">{t('terms_link')}</a>
            {' '}{t('and_text')}{' '}
            <a href="#privacy" className="text-indigo-600 hover:underline font-semibold">{t('privacy_link')}</a>
          </p>

          {/* Role Portal Switcher Button */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            {activePortal === 'applicant' ? (
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-3 font-medium">
                  {t('are_you_officer')}
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToOfficer}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-indigo-600 group-hover:scale-110 transition-transform" />
                  {t('access_officer_portal')}
                </button>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-xs text-slate-500 mb-3 font-medium">
                  {t('are_you_applicant')}
                </p>
                <button
                  type="button"
                  onClick={handleSwitchToApplicant}
                  className="w-full py-3 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-2xs group cursor-pointer"
                >
                  <UserCheck className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
                  {t('access_applicant_portal')}
                </button>
              </div>
            )}
          </div>

          {/* Quick Registration Link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {t('dont_have_account')}{' '}
              <Link
                to={ROUTES.REGISTER}
                className="font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors ml-1"
              >
                {t('apply_new_customer')}
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom Copyright */}
        <div className="text-center text-[11px] text-slate-400 py-2">
          {t('brand_name')} {t('all_rights_reserved')} © {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
