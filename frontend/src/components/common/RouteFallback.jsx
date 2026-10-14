import BrandLogo from './BrandLogo';
import { ShieldCheck, Lock, Loader2 } from 'lucide-react';

/**
 * Full-screen polished dark-mode placeholder shown while session restoration resolves.
 */
export default function RouteFallback() {
  return (
    <div
      className="min-h-screen bg-black flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans text-white select-none"
      role="status"
      aria-live="polite"
    >
      {/* Dark Ambient Glow Backgrounds */}
      <div className="absolute inset-0 bg-black pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-emerald-500/10 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] h-[280px] bg-sky-500/5 rounded-full blur-[90px] pointer-events-none" />
      
      {/* Subtle Grid Accent */}
      <div
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(rgba(255,255,255,0.8) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating Glass HUD Card */}
      <div className="relative z-10 w-full max-w-sm bg-slate-950/90 border border-slate-800/80 rounded-2xl p-8 shadow-[0_0_60px_rgba(0,0,0,0.95)] backdrop-blur-2xl flex flex-col items-center gap-6 text-center">
        {/* Brand Logo */}
        <div className="flex flex-col items-center gap-2 pt-1">
          <BrandLogo to={null} variant="light" size="lg" showBadge={true} />
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-400 pt-1">
            Underwriting & Risk Portal
          </span>
        </div>

        {/* Sleek Dual Ring Spinner & Live Status */}
        <div className="flex flex-col items-center gap-3 pt-2 w-full">
          <div className="relative flex items-center justify-center w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
            <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
          </div>

          <div className="flex items-center justify-center gap-2 text-sm font-medium text-slate-200 pt-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span>Restoring your session...</span>
          </div>

          <p className="text-xs text-slate-400 font-mono">
            Verifying token credentials & encrypted state
          </p>
        </div>

        {/* Security Telemetry Badge */}
        <div className="w-full pt-3 border-t border-slate-900/90 flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Lock className="w-3 h-3 text-emerald-400" />
            <span>256-Bit Encrypted</span>
          </span>
          <span className="flex items-center gap-1 text-slate-400 font-semibold">
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>Active Session</span>
          </span>
        </div>
      </div>
    </div>
  );
}

