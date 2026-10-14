import React from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';

export function LoanSightEmblem({ className = 'w-8 h-8' }) {
  return (
    <div className={`relative shrink-0 flex items-center justify-center ${className}`}>
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="brand-grad-left" x1="10%" y1="0%" x2="90%" y2="100%">
            <stop offset="0%" stopColor="#00F5A0" />
            <stop offset="60%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="brand-grad-right" x1="100%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#047857" />
            <stop offset="50%" stopColor="#10B981" />
            <stop offset="100%" stopColor="#00F5A0" />
          </linearGradient>
        </defs>

        {/* Outer subtle tile */}
        <rect width="100" height="100" rx="26" fill="#0A0F1D" />

        {/* Left / Upper Segment */}
        <path
          d="M 52 18 
             C 40 18 28 28 24 40
             C 20 52 24 66 33 76
             L 46 86
             C 39 78 37 68 40 58
             C 43 48 50 36 54 28
             Z"
          fill="url(#brand-grad-left)"
        />

        {/* Right / Lower Segment */}
        <path
          d="M 58 24
             C 64 32 76 44 78 56
             C 80 68 74 80 62 86
             L 48 86
             C 60 84 66 74 65 62
             C 64 50 56 36 50 20
             Z"
          fill="url(#brand-grad-right)"
        />

        {/* Center Iris Aperture */}
        <path
          d="M 50 34
             C 44 42 40 52 42 62
             C 44 70 50 76 56 72
             C 62 68 64 58 60 48
             C 57 42 53 37 50 34
             Z"
          fill="#0A0F1D"
        />
      </svg>
    </div>
  );
}

export default function BrandLogo({
  to = ROUTES.HOME,
  variant = 'dark', // 'dark' (for white backgrounds) or 'light' (for dark navy sidebars)
  size = 'md', // 'sm', 'md', 'lg'
  showBadge = true,
  className = '',
}) {
  const sizeMap = {
    sm: {
      emblem: 'w-7 h-7',
      text: 'text-base',
      badge: 'text-[9px] px-1 py-0.2',
    },
    md: {
      emblem: 'w-8 h-8',
      text: 'text-lg',
      badge: 'text-[10px] px-1.5 py-0.5',
    },
    lg: {
      emblem: 'w-10 h-10',
      text: 'text-2xl',
      badge: 'text-[11px] px-2 py-0.5',
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  const content = (
    <div className={`flex items-center gap-2.5 group select-none ${className}`}>
      <LoanSightEmblem className={currentSize.emblem} />
      <div className="flex items-center gap-1.5 tracking-tight">
        <span
          className={`font-['Outfit',sans-serif] font-bold ${currentSize.text} tracking-[-0.03em] ${
            variant === 'light' ? 'text-white' : 'text-slate-900'
          }`}
        >
          Loan<span className="text-emerald-500 font-extrabold">Sight</span>
        </span>
        {showBadge && (
          <span
            className={`font-['Plus_Jakarta_Sans',sans-serif] font-extrabold uppercase rounded-md tracking-wider border ${currentSize.badge} ${
              variant === 'light'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
          >
            AI
          </span>
        )}
      </div>
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="inline-flex focus:outline-none" aria-label="LoanSight AI Home">
        {content}
      </Link>
    );
  }

  return content;
}
