import { useState, useEffect } from 'react';
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  BookOpen,
  Sparkles,
  TrendingUp,
  Cpu,
  Database,
  Scale,
} from 'lucide-react';

export default function HeroVisualization() {
  const [activeTab, setActiveTab] = useState(0); // 0: 'diff', 1: 'rag', 2: 'foir'
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  const TABS = [
    { id: 0, key: 'diff', label: '1. Document Diffs', icon: FileText },
    { id: 1, key: 'rag', label: '2. Vector RAG Policy', icon: Sparkles },
    { id: 2, key: 'foir', label: '3. FOIR & Risk Limit', icon: TrendingUp },
  ];

  // Smooth 2.0s Auto-Swipe Progress Animation
  useEffect(() => {
    if (isPaused) return undefined;
    const updateFreq = 30; // 30ms step
    const step = (updateFreq / 2000) * 100; // 2.0 seconds total

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setActiveTab((tabPrev) => (tabPrev + 1) % TABS.length);
          return 0;
        }
        return prev + step;
      });
    }, updateFreq);

    return () => clearInterval(timer);
  }, [isPaused, TABS.length]);

  const handleTabClick = (id) => {
    setActiveTab(id);
    setProgress(0);
  };

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="w-full max-w-xl mx-auto rounded-2xl border border-slate-200/90 bg-white shadow-2xl overflow-hidden font-sans text-xs text-slate-900 transition-all duration-300 ring-1 ring-slate-900/5 relative group"
    >
      {/* ── Top Header: AI Underwriting Live Status ── */}
      <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold text-emerald-400 tracking-wider uppercase">LOANSIGHT AI ENGINE</span>
              <span className="text-slate-600">•</span>
              <span className="font-mono text-[10px] text-slate-300">APP-2026-8941</span>
            </div>
            <p className="text-[13px] font-bold text-white truncate leading-tight">HDFC Personal Loan Verification</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            LIVE VERIFIED
          </span>
        </div>
      </div>

      {/* ── 2.0s Auto-Swipe Active Progress Indicator Line ── */}
      <div className="w-full h-1 bg-slate-100 relative overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 transition-all duration-75 ease-linear shadow-sm"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── High-Impact Tab Controls ── */}
      <div className="grid grid-cols-3 border-b border-slate-200/90 bg-slate-50/80 p-2 gap-2 text-[11px] font-semibold relative">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`py-2.5 px-2 rounded-xl text-center transition-all duration-300 cursor-pointer relative overflow-hidden flex items-center justify-center gap-1.5 select-none ${
                isActive
                  ? 'text-emerald-950 bg-white font-extrabold shadow-md ring-1 ring-emerald-500/30 scale-[1.02] z-10'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 font-semibold'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span className="truncate">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Viewport Area with Animated Tab Content ── */}
      <div className="p-4 bg-gradient-to-b from-slate-50/60 to-white min-h-[220px] flex flex-col justify-between relative overflow-hidden">
        <div key={activeTab} className="animate-tab-slide space-y-3">
          {/* TAB 0: Document Diffs */}
          {activeTab === 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Database className="w-3.5 h-3.5 text-emerald-600" />
                  Cross-Document AI Evidence Diff
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                  ✓ 100% PARSED
                </span>
              </div>

              <div className="rounded-xl border border-slate-200/90 bg-white divide-y divide-slate-100 shadow-xs overflow-hidden">
                <div className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs">Monthly Net Income</p>
                      <p className="text-[10px] text-slate-500 font-mono">Payslip PDF vs HDFC Bank Statement</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono font-bold text-slate-900 text-xs">₹75,000</span>
                    <span className="text-slate-400 text-[10px] font-bold">=</span>
                    <span className="font-mono font-bold text-slate-900 text-xs">₹75,000</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" /> MATCH
                    </span>
                  </div>
                </div>

                <div className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs">Applicant Legal Name</p>
                      <p className="text-[10px] text-slate-500 font-mono">PAN Card vs Aadhaar vs Bank</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-slate-800 text-xs font-semibold">Aditya Nikam</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      100% ID MATCH
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: Vector RAG Policy */}
          {activeTab === 1 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  Vector Policy Search Grounding
                </span>
                <span className="inline-flex items-center gap-1 text-indigo-700 font-mono font-bold bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-200 text-[10px]">
                  99.4% SIMILARITY
                </span>
              </div>

              <div className="p-3.5 rounded-xl border border-indigo-200/90 bg-gradient-to-r from-indigo-50/80 via-sky-50/60 to-indigo-50/80 text-[11px] text-indigo-950 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-extrabold text-indigo-900 text-xs">
                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>HDFC Underwriting Manual §4.2 Citation</span>
                  </div>
                  <span className="text-[10px] font-mono text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-100 font-semibold">
                    Policy Chunk #842
                  </span>
                </div>
                <p className="text-slate-800 italic font-mono text-[11px] leading-relaxed bg-white p-2.5 rounded-lg border border-indigo-100 shadow-2xs">
                  &ldquo;Salaried applicants with &gt; 2 yrs tenure &amp; FOIR &lt; 50% qualify for standard Tier-1 pricing.&rdquo;
                </p>
                <div className="flex items-center gap-1.5 pt-0.5 text-[10px] font-semibold text-indigo-700">
                  <span className="bg-indigo-100/80 text-indigo-800 px-2 py-0.5 rounded-md">#FOIR_Approved</span>
                  <span className="bg-emerald-100/80 text-emerald-800 px-2 py-0.5 rounded-md">#Tier1_Salaried</span>
                  <span className="bg-sky-100/80 text-sky-800 px-2 py-0.5 rounded-md">#Auto_Sanction</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FOIR & Risk Limit */}
          {activeTab === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  Underwriting Risk Metrics
                </span>
                <span className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200 text-[10px]">
                  PASS CRITERIA
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Calculated FOIR</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono font-extrabold text-xl text-slate-900 tabular-nums">42.8%</span>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      &lt; 50% Cap
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full w-[85%]" />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/90 bg-white shadow-xs space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">Max Sanction Limit</span>
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono font-extrabold text-xl text-slate-900 tabular-nums">₹18.5 L</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Proposed: ₹15L</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-teal-500 rounded-full w-[100%]" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer Result Bar ── */}
      <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-200/80 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-emerald-700 font-extrabold">
          <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-3.5 h-3.5" />
          </div>
          <span>Underwriting Signal: Low Risk / Approved</span>
        </div>
        <span className="text-[11px] font-mono text-slate-400 font-semibold">Trace ID: 0f92a4k</span>
      </div>
    </div>
  );
}
