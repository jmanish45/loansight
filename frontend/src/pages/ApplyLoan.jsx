import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Landmark,
  Wallet,
  ShieldCheck,
  Send,
} from 'lucide-react';
import ApplicantShell from '../layouts/ApplicantShell';
import StepProgress from '../components/applicant/StepProgress';
import BankPicker from '../components/applicant/BankPicker';
import LoanTypePicker from '../components/applicant/LoanTypePicker';
import DocumentUploader from '../components/applicant/DocumentUploader';
import ApplicationSummaryRail from '../components/applicant/ApplicationSummaryRail';
import { TextField, SelectField } from '../components/applicant/FormField';
import BankLogo from '../components/common/BankLogo';
import { useForm } from '../hooks/useForm';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useLanguage } from '../context/LanguageContext';
import { validators } from '../utils/validation';
import { applicationService } from '../services/applicationService';
import { EMPLOYMENT_TYPES, getDocumentRequirements } from '../constants/mockData';
import { AVAILABLE_BANKS, LOAN_TYPE_DETAILS } from '../constants/banks';
import { ROUTES } from '../constants/routes';
import { formatINR, formatMonths } from '../lib/loanMath';

const APPLICATION_STEPS = [
  { step: 1, label: 'Loan details' },
  { step: 2, label: 'Documents' },
  { step: 3, label: 'Analysis' },
  { step: 4, label: 'Review' },
];

const TENURE_PRESETS = [12, 24, 36, 60, 120, 180, 240, 360];

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

const validationRules = {
  bankId: [(v) => validators.required(v, 'Bank')],
  loanType: [validators.select('loan type')],
  requestedAmount: [
    (v) => validators.required(v, 'Loan amount'),
    validators.numericRange(10000, 100000000, 'Loan amount'),
  ],
  tenureMonths: [
    (v) => validators.required(v, 'Tenure'),
    validators.numericRange(6, 360, 'Tenure'),
  ],
  employmentType: [validators.select('employment type')],
  declaredMonthlyIncome: [
    (v) => validators.required(v, 'Monthly income'),
    validators.numericRange(1000, 100000000, 'Monthly income'),
  ],
};

/** 'Up to 30 Years' -> 360 months. Falls back to the validation ceiling. */
function maxTenureMonths(tenureLabel) {
  const match = String(tenureLabel || '').match(/\d+/);
  if (!match) return 360;
  return Math.min(360, Number(match[0]) * 12);
}

function SectionCard({ icon: Icon, step, title, description, children }) {
  return (
    <section className={`${CARD} p-5 lg:p-6`}>
      <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-200">
        <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center shrink-0">
          <Icon className="w-4 h-4 text-slate-600" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
            Step {step}
          </p>
          <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ApplyLoan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(1);
  const [applicationId, setApplicationId] = useState(null);

  const dynamicSteps = [
    { step: 1, label: t('step1_label') },
    { step: 2, label: t('step2_label') },
    { step: 3, label: t('step3_label') },
    { step: 4, label: t('step4_label') },
  ];

  // Step 2 state
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [file, setFile] = useState(null);
  const [manualText, setManualText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [uploadSuccessState, setUploadSuccessState] = useState(false);

  // Step 4 state
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const form = useForm({
    initialValues: {
      bankId: 'hdfc',
      bankName: 'HDFC Bank',
      loanType: 'personal',
      requestedAmount: '',
      tenureMonths: '',
      employmentType: '',
      declaredMonthlyIncome: '',
    },
    validationRules,
    onSubmit: async (data) => {
      const selectedBankObj =
        AVAILABLE_BANKS.find((b) => b.id === data.bankId) || AVAILABLE_BANKS[0];
      const payload = {
        bankId: selectedBankObj.id,
        bankName: selectedBankObj.name,
        loanType: data.loanType,
        requestedAmount: Number(data.requestedAmount),
        tenureMonths: Number(data.tenureMonths),
        employmentType: data.employmentType,
        declaredMonthlyIncome: Number(data.declaredMonthlyIncome),
      };
      const response = await applicationService.create(payload);
      setApplicationId(response.data._id);
      setCurrentStep(2);
    },
  });

  const selectedBank =
    AVAILABLE_BANKS.find((b) => b.id === form.values.bankId) || AVAILABLE_BANKS[0];
  const loanTypeDetail = LOAN_TYPE_DETAILS.find((lt) => lt.value === form.values.loanType) || null;

  const requiredDocs = getDocumentRequirements(form.values.loanType);
  const allDocsUploaded = currentDocIndex >= requiredDocs.length;
  const currentDocType = !allDocsUploaded ? requiredDocs[currentDocIndex] : null;

  const tenureCeiling = maxTenureMonths(loanTypeDetail?.tenure);
  const tenureOptions = TENURE_PRESETS.filter((months) => months <= tenureCeiling);

  const handleBankSelect = (bankId) => {
    const bank = AVAILABLE_BANKS.find((b) => b.id === bankId) || AVAILABLE_BANKS[0];
    form.setFieldValue('bankId', bank.id);
    form.setFieldValue('bankName', bank.name);
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file || !currentDocType) return;

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', currentDocType.type);
      if ((currentDocType.type === 'pan' || currentDocType.type === 'aadhaar') && manualText.trim()) {
        formData.append('manualText', manualText.trim());
      }

      const response = await applicationService.uploadDocument(applicationId, formData);
      setUploadedDocs((prev) => [...prev, response.data]);
      setUploadSuccessState(true);

      setTimeout(() => {
        setUploadSuccessState(false);
        setFile(null);
        setManualText('');
        setCurrentDocIndex((prev) => prev + 1);
      }, 1200);
    } catch (error) {
      console.error('Upload failed', error);
      toast.error(error.message, { title: `Could not upload ${currentDocType.label}` });
    } finally {
      setUploading(false);
    }
  };

  const handleVerification = () => {
    setCurrentStep(3);
    setTimeout(() => setCurrentStep(4), 1600);
  };

  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      await applicationService.submit(applicationId);
      setSuccess(true);
    } catch (error) {
      console.error('Submit failed', error);
      toast.error(error.message, { title: 'Submission failed' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartAnother = () => {
    setSuccess(false);
    setCurrentStep(1);
    setApplicationId(null);
    setCurrentDocIndex(0);
    setUploadedDocs([]);
    setFile(null);
    setManualText('');
    form.reset();
  };

  const shellProps = {
    userName: user?.name || '',
    subtitle: 'New loan application',
    showSearch: false,
  };

  if (success) {
    return (
      <ApplicantShell {...shellProps}>
        <div className={`${CARD} max-w-xl mx-auto p-8 text-center mt-4`}>
          <span className="w-14 h-14 rounded-full bg-emerald-50 grid place-items-center mx-auto">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
          </span>
          <h1 className="text-xl font-semibold text-slate-900 mt-4">Application submitted</h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Your {loanTypeDetail?.label || 'loan'} application with{' '}
            <span className="font-medium text-slate-900">{selectedBank.name}</span> is now with our
            verification team.
          </p>

          <dl className="text-left mt-6 rounded-lg border border-slate-200 divide-y divide-slate-100">
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-xs text-slate-400">Application ID</dt>
              <dd className="font-mono text-[11px] text-slate-600">
                {String(applicationId || '').slice(-8) || '—'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-xs text-slate-400">Amount requested</dt>
              <dd className="text-sm font-medium text-slate-900 tabular-nums">
                {formatINR(Number(form.values.requestedAmount))}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-2.5">
              <dt className="text-xs text-slate-400">Documents attached</dt>
              <dd className="text-sm font-medium text-slate-900 tabular-nums">
                {uploadedDocs.length}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <Link
              to={ROUTES.APPLICANT}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
            >
              Track it on your dashboard
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={handleStartAnother}
              className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer"
            >
              Apply for another loan
            </button>
          </div>
        </div>
      </ApplicantShell>
    );
  }

  return (
    <ApplicantShell {...shellProps}>
      <div className="max-w-[1200px] mx-auto space-y-5">
        <section className="relative overflow-hidden rounded-xl bg-navy-900 text-white p-6 lg:p-7">
          <div className="absolute inset-0 dash-grid-pattern" aria-hidden="true" />

          <div className="relative">
            <button
              type="button"
              onClick={() => navigate(ROUTES.APPLICANT)}
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              Back to dashboard
            </button>

            <div className="flex flex-wrap items-end justify-between gap-5 mt-3">
              <div className="min-w-0">
                <h1 className="text-[24px] lg:text-[28px] font-semibold leading-tight tracking-[-0.01em]">
                  {t('apply_heading')}
                </h1>
                <p className="text-sm text-slate-300 mt-2 max-w-lg">
                  {t('apply_subheading')}
                </p>
              </div>

              <div className="bg-navy-800 border border-white/5 rounded-lg px-4 py-3">
                <p className="text-[11px] text-slate-400">{t('step_of')}</p>
                <p className="text-lg font-semibold tabular-nums leading-tight">
                  {currentStep}
                  <span className="text-slate-400 text-sm font-normal"> {t('of_word')} 4</span>
                </p>
              </div>
            </div>

            <div className="mt-6 pt-5 border-t border-white/10 overflow-x-auto">
              <StepProgress steps={dynamicSteps} currentStep={currentStep} />
            </div>
          </div>
        </section>

        <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            {currentStep === 1 && (
              <form onSubmit={form.handleSubmit} noValidate className="space-y-5">
                <SectionCard
                  icon={Landmark}
                  step="1"
                  title={t('select_bank_title')}
                  description={t('select_bank_sub')}
                >
                  <BankPicker value={form.values.bankId} onChange={handleBankSelect} />
                </SectionCard>

                <SectionCard
                  icon={Wallet}
                  step="2"
                  title={t('select_loan_title')}
                  description={t('select_loan_sub')}
                >
                  <LoanTypePicker
                    value={form.values.loanType}
                    onChange={(value) => form.setFieldValue('loanType', value)}
                    error={form.touched.loanType ? form.errors.loanType : null}
                  />
                </SectionCard>

                <SectionCard
                  icon={ShieldCheck}
                  step="3"
                  title={t('amount_income_title')}
                  description="Required for eligibility underwriting & EMI calculations"
                >
                  {/* Group 1: LOAN DETAILS */}
                  <div className="space-y-4 pb-6 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Group A · Loan Details
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <TextField
                        label="Loan Amount Requested"
                        name="requestedAmount"
                        type="number"
                        prefix="₹"
                        value={form.values.requestedAmount}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        error={form.touched.requestedAmount ? form.errors.requestedAmount : null}
                        helperText="Between ₹10,000 and ₹10,00,00,000"
                        placeholder="1500000"
                        min="10000"
                        required
                      />

                      <TextField
                        label="Desired Tenure"
                        name="tenureMonths"
                        type="number"
                        value={form.values.tenureMonths}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        error={form.touched.tenureMonths ? form.errors.tenureMonths : null}
                        helperText={`In months · max ${loanTypeDetail?.tenure || '30 years'}`}
                        placeholder="36"
                        min="6"
                        max="360"
                        required
                      />
                    </div>

                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="text-xs text-slate-500 flex items-center mr-1">Quick tenure:</span>
                      {tenureOptions.map((months) => {
                        const isActive = Number(form.values.tenureMonths) === months;
                        return (
                          <button
                            type="button"
                            key={months}
                            onClick={() => form.setFieldValue('tenureMonths', months)}
                            className={`text-xs font-mono font-medium rounded-md px-2.5 py-1 border transition-colors cursor-pointer ${
                              isActive
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {formatMonths(months)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Group 2: FINANCIAL DETAILS */}
                  <div className="space-y-4 pt-6">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        Group B · Financial Profile
                      </span>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-5">
                      <SelectField
                        label="Employment Type"
                        name="employmentType"
                        value={form.values.employmentType}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        options={EMPLOYMENT_TYPES}
                        placeholder="Select employment status"
                        error={form.touched.employmentType ? form.errors.employmentType : null}
                        required
                      />

                      <TextField
                        label="Declared Monthly Net Income"
                        name="declaredMonthlyIncome"
                        type="number"
                        prefix="₹"
                        value={form.values.declaredMonthlyIncome}
                        onChange={form.handleChange}
                        onBlur={form.handleBlur}
                        error={
                          form.touched.declaredMonthlyIncome
                            ? form.errors.declaredMonthlyIncome
                            : null
                        }
                        helperText="Take-home monthly income after deductions"
                        placeholder="75000"
                        min="1000"
                        required
                      />
                    </div>
                  </div>
                </SectionCard>

                {form.submitError && (
                  <div
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                    role="alert"
                  >
                    {form.submitError}
                  </div>
                )}

                <div className={`${CARD} p-4 flex flex-wrap items-center justify-between gap-3`}>
                  <p className="text-xs text-slate-400 min-w-0">
                    Saved as a draft — you can finish uploading documents later.
                  </p>
                  <button
                    type="submit"
                    disabled={form.isSubmitting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {form.isSubmitting && (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    )}
                    {t('save_continue_docs')}
                    <ArrowRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </form>
            )}

            {currentStep === 2 && (
              <DocumentUploader
                requiredDocs={requiredDocs}
                currentDocIndex={currentDocIndex}
                currentDocType={currentDocType}
                allDocsUploaded={allDocsUploaded}
                file={file}
                onFileChange={setFile}
                manualText={manualText}
                onManualTextChange={setManualText}
                uploading={uploading}
                uploadSuccess={uploadSuccessState}
                onSubmit={handleFileUpload}
                onContinue={handleVerification}
                bankName={selectedBank.name}
                loanTypeLabel={loanTypeDetail?.label || ''}
              />
            )}

            {currentStep === 3 && (
              <div className={`${CARD} p-10 text-center`}>
                <Loader2
                  className="w-8 h-8 text-emerald-600 animate-spin mx-auto"
                  aria-hidden="true"
                />
                <h2 className="text-[15px] font-semibold text-slate-900 mt-4">
                  Compiling your review summary
                </h2>
                <p className="text-sm text-slate-600 mt-1.5 max-w-md mx-auto">
                  Each document was analysed as you uploaded it. We are gathering those results
                  against {selectedBank.name}&apos;s requirements.
                </p>
              </div>
            )}

            {currentStep === 4 && (
              <div className={`${CARD} p-5 lg:p-6`}>
                <div className="flex items-start gap-3 pb-5 mb-5 border-b border-slate-200">
                  <span className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 grid place-items-center shrink-0">
                    <Send className="w-4 h-4 text-slate-600" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                      Final step
                    </p>
                    <h2 className="text-[15px] font-semibold text-slate-900 leading-tight">
                      Review and submit
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Check these details before they go to an officer
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <BankLogo bank={selectedBank} size="lg" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-slate-400">Lending partner</p>
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {selectedBank.name}
                    </p>
                  </div>
                </div>

                <dl className="mt-5">
                  {[
                    ['Loan type', loanTypeDetail?.label || form.values.loanType],
                    ['Amount requested', formatINR(Number(form.values.requestedAmount))],
                    ['Tenure', formatMonths(Number(form.values.tenureMonths))],
                    [
                      'Employment type',
                      EMPLOYMENT_TYPES.find((t) => t.value === form.values.employmentType)?.label ||
                        '—',
                    ],
                    [
                      'Declared monthly income',
                      `${formatINR(Number(form.values.declaredMonthlyIncome))}/mo`,
                    ],
                    ['Documents attached', `${uploadedDocs.length} of ${requiredDocs.length}`],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-start justify-between gap-3 py-2.5 border-b border-slate-100 last:border-0"
                    >
                      <dt className="text-xs text-slate-400">{label}</dt>
                      <dd className="text-sm font-medium text-slate-900 tabular-nums text-right">
                        {value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-5 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(2)}
                    className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium rounded-lg px-3 py-2 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                    Back to documents
                  </button>

                  <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={submitting}
                    className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="w-4 h-4" aria-hidden="true" />
                    )}
                    Submit to {selectedBank.shortName}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 xl:sticky xl:top-24">
            <ApplicationSummaryRail
              bank={selectedBank}
              loanTypeDetail={loanTypeDetail}
              requestedAmount={form.values.requestedAmount}
              tenureMonths={form.values.tenureMonths}
              declaredMonthlyIncome={form.values.declaredMonthlyIncome}
              documentsUploaded={uploadedDocs.length}
              documentsRequired={requiredDocs.length}
            />
          </div>
        </div>
      </div>
    </ApplicantShell>
  );
}
