import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, ShieldCheck, Check } from 'lucide-react';
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
  name: [
    (v) => validators.required(v, 'Full name'),
    validators.minLength(2, 'Name'),
    validators.maxLength(100, 'Name'),
  ],
  email: [(v) => validators.required(v, 'Email address'), validators.email],
  password: [(v) => validators.required(v, 'Password'), validators.minLength(8, 'Password')],
  confirmPassword: [(v) => validators.required(v, 'Password confirmation')],
};

export default function Register() {
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    submitError,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useForm({
    initialValues: { name: '', email: '', password: '', confirmPassword: '' },
    validationRules,
    onSubmit: async (data) => {
      if (data.password !== data.confirmPassword) {
        throw new Error('Passwords do not match');
      }
      await register(data.name, data.email, data.password);
      navigate(ROUTES.APPLICANT, { replace: true });
    },
  });

  const confirmPasswordError = touched.confirmPassword
    ? errors.confirmPassword ||
      (values.confirmPassword && values.password !== values.confirmPassword
        ? 'Passwords do not match'
        : null)
    : null;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between font-sans">
      {/* Top Bar */}
      <header className="w-full max-w-7xl mx-auto px-6 py-4 flex items-center justify-between border-b border-slate-200 bg-white">
        <BrandLogo variant="dark" size="md" />
        <div className="flex items-center gap-3">
          <LanguageSelector variant="light" />
          <Link to={ROUTES.LOGIN}>
            <Button variant="outline" size="sm">
              Already registered? <span className="font-semibold text-emerald-700 ml-1">Sign In</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8 flex items-center justify-center">
        <div className="w-full grid lg:grid-cols-12 gap-10 items-center">
          {/* Left Info Panel */}
          <div className="lg:col-span-6 space-y-6 hidden md:block">
            <Badge variant="emerald" dot>FAST-TRACK PAPERLESS ONBOARDING</Badge>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">
              Create your applicant account to start a loan application.
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed max-w-md">
              Select lending partners (HDFC, ICICI, SBI, Axis), upload income proof securely, and track live underwriting status.
            </p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                <span>Compare offers across 6 major Indian banks</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                <span>Automated field extraction from PAN, Aadhaar & Salary Slips</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-slate-700 font-medium">
                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">✓</span>
                <span>Direct loan officer feedback & status tracking</span>
              </div>
            </div>
          </div>

          {/* Right Register Card */}
          <div className="lg:col-span-6 w-full max-w-md mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-panel space-y-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">Create Applicant Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter your personal details to begin</p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <Input
                  label="Full Name"
                  name="name"
                  type="text"
                  value={values.name}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="e.g. Rohit Sharma"
                  error={touched.name ? errors.name : null}
                  required
                />

                <Input
                  label="Email Address"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="you@example.com"
                  error={touched.email ? errors.email : null}
                  required
                />

                <div className="relative">
                  <Input
                    label="Password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={values.password}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    placeholder="Minimum 8 characters"
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

                <Input
                  label="Confirm Password"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={values.confirmPassword}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Repeat your password"
                  error={confirmPasswordError}
                  required
                />

                {submitError && <Alert variant="error">{submitError}</Alert>}

                <Button
                  type="submit"
                  variant="emerald"
                  size="lg"
                  loading={isSubmitting}
                  className="w-full"
                >
                  Create Account & Continue <ArrowRight className="w-4 h-4" />
                </Button>
              </form>

              <div className="pt-4 border-t border-slate-100 text-center space-y-2">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <Link to={ROUTES.LOGIN} className="font-semibold text-emerald-700 hover:underline">
                    Sign in to your account
                  </Link>
                </p>
                <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>AES-256 Storage Encryption • RBI Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        LoanSight AI Underwriting Platform © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
