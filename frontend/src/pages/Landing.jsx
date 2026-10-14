import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  FileSearch,
  CheckCircle2,
  Lock,
  Eye,
  BarChart3,
  BookOpen,
  FileCheck,
  Building,
  UserCheck,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import Footer from '../components/layout/Footer';
import Container from '../components/layout/Container';
import Section from '../components/layout/Section';
import Button from '../components/common/Button';
import Card from '../components/common/Card';
import Badge from '../components/common/Badge';
import HeroVisualization from '../components/ui/HeroVisualization';
import { ROUTES } from '../constants/routes';
import { useLanguage } from '../context/LanguageContext';

export default function Landing() {
  const { t } = useLanguage();
  const [activeStep, setActiveStep] = useState(0);

  const processSteps = [
    {
      id: 'app',
      step: '01',
      title: 'Application Entry',
      subtitle: 'Bank Partner & Loan Type',
      detail: 'Applicant selects lending bank (e.g. HDFC, ICICI, SBI) and submits income/tenure request.',
      artifact: 'Requested Amount: ₹15,00,000 · Tenure: 36 Months',
      badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      activeBorder: 'border-emerald-500/80 ring-1 ring-emerald-500/30',
      stepColor: 'text-emerald-400',
      indicatorBg: 'bg-emerald-400',
    },
    {
      id: 'docs',
      step: '02',
      title: 'Document Ingestion',
      subtitle: 'Payslips, Statements, ID',
      detail: 'Encrypted upload of PDF financial documents and government identification cards.',
      artifact: 'File Hash SHA-256 Verified · AES-256 Encrypted',
      badgeClass: 'bg-sky-100 text-sky-800 border-sky-300',
      activeBorder: 'border-sky-500/80 ring-1 ring-sky-500/30',
      stepColor: 'text-sky-400',
      indicatorBg: 'bg-sky-400',
    },
    {
      id: 'ocr',
      step: '03',
      title: 'Field Extraction',
      subtitle: 'OCR & Financial Parsing',
      detail: 'Native PDF parsing and OCR extract monthly net pay, average balances, and account numbers.',
      artifact: 'Monthly Net Income Extracted: ₹75,000 / mo',
      badgeClass: 'bg-teal-100 text-teal-800 border-teal-300',
      activeBorder: 'border-teal-500/80 ring-1 ring-teal-500/30',
      stepColor: 'text-teal-400',
      indicatorBg: 'bg-teal-400',
    },
    {
      id: 'cross',
      step: '04',
      title: 'Cross-Verification',
      subtitle: 'Discrepancy Detection Engine',
      detail: 'Automated cross-checking compares name on PAN vs Bank Account and salary vs bank credits.',
      artifact: 'Status: 100% ID Match · 0 Salary Discrepancies',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      activeBorder: 'border-indigo-500/80 ring-1 ring-indigo-500/30',
      stepColor: 'text-indigo-400',
      indicatorBg: 'bg-indigo-400',
    },
    {
      id: 'risk',
      step: '05',
      title: 'FOIR & Risk Engine',
      subtitle: 'Debt Burden Analysis',
      detail: 'Calculates Fixed Obligations to Income Ratio (FOIR), EMI capacity, and maximum sanction limit.',
      artifact: 'FOIR: 42.8% · Proposed EMI: ₹32,100 / mo',
      badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
      activeBorder: 'border-amber-500/80 ring-1 ring-amber-500/30',
      stepColor: 'text-amber-400',
      indicatorBg: 'bg-amber-400',
    },
    {
      id: 'copilot',
      step: '06',
      title: 'Underwriting Support',
      subtitle: 'Vector RAG Policy Copilot',
      detail: 'Loan officer chats with AI Assistant grounded in vector-indexed bank policy clauses.',
      artifact: 'Cited Policy: HDFC Clause 4.2 Approved',
      badgeClass: 'bg-violet-100 text-violet-800 border-violet-300',
      activeBorder: 'border-violet-500/80 ring-1 ring-violet-500/30',
      stepColor: 'text-violet-400',
      indicatorBg: 'bg-violet-400',
    },
  ];

  const trustProofItems = [
    { label: 'Bank-Grade AES-256 Encryption', icon: Lock },
    { label: 'Vector RAG Policy Citation', icon: BookOpen },
    { label: 'Automated Discrepancy Audits', icon: FileCheck },
    { label: 'Explainable Underwriting Signals', icon: Eye },
  ];

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <Navbar />

      {/* ─── HERO SECTION ─── */}
      <section className="pt-24 pb-16 md:pt-32 md:pb-24 border-b border-slate-200 bg-white">
        <Container>
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 tracking-tight">
                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                Underwriting Intelligence Platform
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-[1.15]">
                Cross-Document Verification & Policy-Grounded Underwriting
              </h1>

              <p className="text-sm md:text-base text-slate-600 leading-relaxed max-w-xl">
                LoanSight extracts financial data from payslips and bank statements, detects cross-document discrepancies, calculates FOIR capacity, and grounds credit decisions in bank policy rules.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link to={ROUTES.APPLY}>
                  <Button variant="navy" size="lg" className="gap-2">
                    {t('start_application', 'Start Loan Application')}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg">
                    Explore Architecture
                  </Button>
                </a>
              </div>

              <div className="pt-4 flex items-center gap-6 text-xs font-medium text-slate-500 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Audit-Ready Records</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Zero Data Selling</span>
                </div>
              </div>
            </div>

            {/* Right Product Evidence Console */}
            <div className="lg:col-span-6 lg:-mt-8 lg:-translate-y-3 transition-transform duration-300">
              <HeroVisualization />
            </div>
          </div>
        </Container>
      </section>

      {/* ─── TRUST & COMPLIANCE STRIP ─── */}
      <div className="bg-slate-900 text-slate-300 py-8 md:py-10 border-y border-slate-800/80 shadow-inner">
        <Container>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {trustProofItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-center gap-3.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4.5 h-4.5 text-emerald-400" />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-white tracking-tight">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Container>
      </div>

      {/* ─── HOW IT WORKS (INTERACTIVE PIPELINE VISUALIZER) ─── */}
      <Section id="how-it-works" className="py-16 md:py-24 bg-white border-b border-slate-200">
        <Container>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 shadow-2xs">
              End-To-End Architecture
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-3">
              How LoanSight Operates
            </h2>
            <p className="text-xs md:text-sm text-slate-600 mt-2 leading-relaxed">
              From document ingestion to officer decision support—every step generates traceable financial evidence.
            </p>
          </div>

          {/* Stepper Tabs with Color-Coded Active States */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2.5 mb-8">
            {processSteps.map((step, idx) => {
              const isActive = activeStep === idx;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setActiveStep(idx)}
                  className={`
                    p-3.5 rounded-xl border text-left transition-all duration-300 transform cursor-pointer relative overflow-hidden
                    ${isActive
                      ? `bg-slate-900 text-white ${step.activeBorder} shadow-panel -translate-y-1`
                      : 'bg-white text-slate-700 border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 hover:-translate-y-0.5 shadow-2xs'
                    }
                  `}
                >
                  <span className={`font-mono text-[10px] font-bold block mb-1 tracking-wider ${isActive ? step.stepColor : 'text-slate-400'}`}>
                    STEP {step.step}
                  </span>
                  <p className="text-xs font-bold truncate leading-snug">{step.title}</p>
                  {isActive && (
                    <span className={`absolute bottom-1.5 left-3 right-3 h-[2px] rounded-full ${step.indicatorBg} opacity-90`} />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Step Artifact Box with Animated Transition */}
          <div
            key={activeStep}
            className="p-6 md:p-8 rounded-2xl border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/50 to-white shadow-panel grid md:grid-cols-12 gap-6 items-center animate-tab-slide transition-all duration-500"
          >
            <div className="md:col-span-7 space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className={`text-xs font-mono font-bold uppercase tracking-wider px-3 py-1 rounded-lg border ${processSteps[activeStep].badgeClass}`}>
                  Phase {processSteps[activeStep].step}
                </span>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  {processSteps[activeStep].title}
                </h3>
              </div>
              <p className="text-xs font-bold text-slate-800">{processSteps[activeStep].subtitle}</p>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                {processSteps[activeStep].detail}
              </p>
            </div>

            <div className="md:col-span-5 p-4.5 rounded-xl border border-slate-800 bg-slate-950 text-white space-y-2.5 shadow-xl">
              <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Generated Evidence Artifact
                </span>
                <span className="text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">JSON/PDF</span>
              </div>
              <div className="font-mono text-xs font-semibold text-emerald-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800 tabular-nums break-all leading-relaxed shadow-inner">
                {processSteps[activeStep].artifact}
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ─── CAPABILITIES MATRIX: ASYMMETRIC UNDERWRITING ENGINE ARCHITECTURE ─── */}
      <Section id="platform" className="py-16 md:py-24 bg-slate-50 border-b border-slate-200">
        <Container>
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
              Platform Architecture
            </span>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 mt-3">
              Underwriting Intelligence Infrastructure
            </h2>
            <p className="text-xs md:text-sm text-slate-600 mt-2 leading-relaxed">
              Engineered for credit risk evaluation, document extraction, and vector-grounded policy compliance.
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-6 items-stretch">
            {/* Primary Command Feature Tile (7 cols) */}
            <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/90 p-6 md:p-8 shadow-panel flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                    MODULE 01 · CORE ENGINE
                  </span>
                  <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Active Inspection
                  </span>
                </div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                  Cross-Document Matching &amp; FOIR Calculation Engine
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Automatically extracts financial line items from PDF salary slips and bank statements, cross-references applicant identity against PAN records, and calculates debt-to-income ratios against bank limits.
                </p>
              </div>

              {/* Engine Sub-features Grid */}
              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <FileSearch className="w-4 h-4 text-emerald-600" />
                    <span>OCR Document Extractor</span>
                  </div>
                  <p className="text-[11px] text-slate-500">Payslip Net Pay &amp; Statement Credit Parsing</p>
                  <span className="text-[10px] font-mono font-semibold text-emerald-700 block">99.2% Accuracy</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <UserCheck className="w-4 h-4 text-sky-600" />
                    <span>Identity Cross-Matcher</span>
                  </div>
                  <p className="text-[11px] text-slate-500">PAN Card vs Bank Account Name Alignment</p>
                  <span className="text-[10px] font-mono font-semibold text-sky-700 block">Automated Discrepancy Flag</span>
                </div>
              </div>

              <div className="p-3 bg-slate-900 rounded-xl text-white flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300">FOIR Threshold Check:</span>
                <span className="text-emerald-400 font-bold">Compliant (&lt; 50% Cap)</span>
              </div>
            </div>

            {/* Secondary Modules Column (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* Stack Module A */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-panel space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                      MODULE 02 · RAG VECTOR STORE
                    </span>
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Vector Policy Citation Index</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Queries indexed bank policy vectors (HDFC, ICICI, SBI) to ground officer underwriting answers in official policy rules.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-indigo-50/70 border border-indigo-100 font-mono text-[11px] text-indigo-950 flex items-center justify-between">
                  <span>Policy Chunk: HDFC Clause 4.2</span>
                  <span className="font-bold text-indigo-700">99% Similarity Match</span>
                </div>
              </div>

              {/* Stack Module B */}
              <div className="flex-1 bg-white rounded-2xl border border-slate-200/90 p-6 shadow-panel space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-500 uppercase tracking-wider">
                      MODULE 03 · AUDIT TRAIL
                    </span>
                    <FileCheck className="w-4 h-4 text-emerald-600" />
                  </div>
                  <h4 className="text-base font-bold text-slate-900">Immutable Audit Ledger</h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Every document reprocessing event, status change, and officer note is saved with timestamped audit records.
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-100 font-mono text-[11px] text-emerald-950 flex items-center justify-between">
                  <span>State Event: UNDER_REVIEW</span>
                  <span className="font-bold text-emerald-700">100% Traceable Log</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ─── SECURITY & COMPLIANCE: INSTITUTIONAL GOVERNANCE CONSOLE ─── */}
      <Section id="security" className="py-16 md:py-24 bg-white border-b border-slate-200">
        <Container>
          <div className="bg-slate-950 text-white rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl overflow-hidden relative">
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              {/* Left Column Description */}
              <div className="lg:col-span-6 space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono font-bold text-emerald-400">
                  <Lock className="w-3.5 h-3.5" /> BANK-GRADE GOVERNANCE
                </div>

                <h2 className="text-2xl md:text-4xl font-bold tracking-tight text-white leading-tight">
                  Institutional Data Protection &amp; Security Controls
                </h2>

                <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
                  LoanSight enforces strict financial data isolation. Applicant documents and extracted data points are protected by enterprise-grade encryption and auditability standards.
                </p>

                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-white block">AES-256 GCM Storage</span>
                    <p className="text-[11px] text-slate-400">Financial PDFs &amp; JSON objects encrypted at rest.</p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
                    <span className="text-xs font-bold text-white block">Tenant RAG Boundaries</span>
                    <p className="text-[11px] text-slate-400">Strict route &amp; vector store isolation.</p>
                  </div>
                </div>
              </div>

              {/* Right Column Interactive Security Terminal Card */}
              <div className="lg:col-span-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl font-mono text-xs">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-slate-300 font-bold">Security Compliance Console</span>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      VERIFIED
                    </span>
                  </div>

                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between text-slate-300">
                      <span>Encryption Protocol:</span>
                      <span className="text-white font-bold">AES-256-GCM</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Checksum Integrity:</span>
                      <span className="text-emerald-400 font-bold">SHA-256 MATCHED</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Data Monetization:</span>
                      <span className="text-emerald-400 font-bold">0% (Strict Prohibition)</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Audit Logging:</span>
                      <span className="text-white font-bold">Immutable Append-Only</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Cryptographic Hash Status:</span>
                    <span className="text-emerald-400 font-bold">0x89f42a9b...c1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </Section>

      {/* ─── CALL TO ACTION ─── */}
      <section className="py-16 bg-slate-900 text-white">
        <Container>
          <div className="max-w-2xl mx-auto text-center space-y-5">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Ready to Submit Your Loan Application?
            </h2>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Select your bank partner, upload required documents, and get real-time verification status.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link to={ROUTES.APPLY}>
                <Button variant="emerald" size="lg" className="gap-2">
                  Start Loan Application
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link to={ROUTES.LOGIN}>
                <Button variant="outline" size="lg" className="!border-slate-700 !text-slate-200 hover:!bg-slate-800">
                  Loan Officer Sign In
                </Button>
              </Link>
            </div>
          </div>
        </Container>
      </section>

      <Footer />
    </div>
  );
}
