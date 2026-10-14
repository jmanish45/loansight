import { useState, useEffect } from 'react';
import BrandLogo from './BrandLogo';
import { Lock, ShieldCheck, Database, Cpu, Activity } from 'lucide-react';

export default function InitialSiteLoader() {
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(15);
  const [statusStep, setStatusStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  const steps = [
    { label: 'INITIALIZING ENCRYPTED RAG PIPELINE', icon: Lock },
    { label: 'LOADING BANK POLICY VECTOR INDEX', icon: Database },
    { label: 'VERIFYING OCR DISCREPANCY ENGINE', icon: Cpu },
    { label: 'UNDERWRITING PLATFORM ONLINE', icon: ShieldCheck },
  ];

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStatusStep(1);
    }, 320);

    const t2 = setTimeout(() => {
      setProgress(88);
      setStatusStep(2);
    }, 720);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStatusStep(3);
      setExiting(true);
    }, 1120);

    const t4 = setTimeout(() => {
      setLoading(false);
    }, 1550);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (!loading) return null;

  const CurrentIcon = steps[statusStep]?.icon || Activity;

  return (
    <div
      className={`fixed inset-0 z-[9999] bg-black overflow-hidden flex flex-col items-center justify-between p-6 sm:p-10 font-sans text-white transition-all duration-700 select-none ${
        exiting ? 'opacity-0 scale-95 blur-sm pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Pure Black Background with Subtle Ambient Glows */}
      <div className="absolute inset-0 bg-black pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-sky-500/5 rounded-full blur-[90px] pointer-events-none" />
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Top Bar Status */}
      <div className="w-full flex items-center justify-between relative z-10 text-[11px] font-mono text-slate-500 max-w-4xl mx-auto">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950 border border-slate-800/80">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300 font-semibold uppercase tracking-wider">
            LoanSight OS v2.4
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
          <Lock className="w-3.5 h-3.5 text-emerald-400" />
          <span>AES-256 GCM Encrypted</span>
        </div>
      </div>

      {/* Center Polished Floating Glass HUD */}
      <div className="relative z-10 w-full max-w-md mx-auto bg-slate-950/90 border border-slate-800/80 rounded-2xl p-7 sm:p-8 shadow-[0_0_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col items-center gap-6 text-center my-auto">
        {/* Single Logo */}
        <div className="relative pt-1 flex flex-col items-center gap-2">
          <BrandLogo to={null} variant="light" size="lg" showBadge={true} />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 block pt-1">
            Institutional Credit Underwriting Intelligence
          </span>
        </div>

        {/* 3px Precision Progress Bar & Telemetry Ticker */}
        <div className="w-full space-y-3 pt-2">
          <div className="w-full h-[3px] bg-slate-900 rounded-full overflow-hidden relative border border-slate-800/60">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-emerald-400 to-sky-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(16,185,129,0.9)]"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-0.5">
            <span className="flex items-center gap-2 text-slate-300 font-medium truncate max-w-[270px]">
              <CurrentIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
              <span className="text-emerald-400 font-bold">[{String(statusStep + 1).padStart(2, '0')}/04]</span>
              <span className="text-slate-300 truncate">{steps[statusStep]?.label}</span>
            </span>
            <span className="text-emerald-400 font-bold tabular-nums shrink-0 ml-2">
              {progress}%
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer */}
      <div className="w-full flex items-center justify-between relative z-10 text-[10px] font-mono text-slate-500 border-t border-slate-900/90 pt-4 max-w-4xl mx-auto">
        <span>Vector RAG Policy Grounding</span>
        <span>LoanSight AI © {new Date().getFullYear()}</span>
      </div>
    </div>
  );
}
