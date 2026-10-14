import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const VARIANTS = {
  success: {
    Icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border border-emerald-200',
    accent: 'border-l-emerald-600',
  },
  error: {
    Icon: XCircle,
    iconClass: 'text-red-600',
    iconBg: 'bg-red-50 border border-red-200',
    accent: 'border-l-red-600',
  },
  warning: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-600',
    iconBg: 'bg-amber-50 border border-amber-200',
    accent: 'border-l-amber-600',
  },
  info: {
    Icon: Info,
    iconClass: 'text-sky-600',
    iconBg: 'bg-sky-50 border border-sky-200',
    accent: 'border-l-sky-600',
  },
};

const DEFAULT_DURATION = 5000;
const ERROR_DURATION = 7000;
const MAX_VISIBLE = 4;

let nextId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const push = useCallback((variant, message, options = {}) => {
    const id = ++nextId;
    const duration = options.duration ?? (variant === 'error' ? ERROR_DURATION : DEFAULT_DURATION);

    setToasts((prev) => {
      const next = [...prev, { id, variant, message, title: options.title }];
      // Keep the newest few so a burst of failures cannot bury the screen.
      return next.slice(-MAX_VISIBLE);
    });

    if (duration !== Infinity) {
      timersRef.current.set(id, setTimeout(() => dismiss(id), duration));
    }
    return id;
  }, [dismiss]);

  // Clear every pending timer on unmount.
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
    };
  }, []);

  const toast = useMemo(() => ({
    success: (message, options) => push('success', message, options),
    error: (message, options) => push('error', message, options),
    warning: (message, options) => push('warning', message, options),
    info: (message, options) => push('info', message, options),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-[130] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const { Icon, iconClass, iconBg, accent } = VARIANTS[t.variant] || VARIANTS.info;
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={`
                pointer-events-auto flex items-start gap-3 p-3.5 pr-2.5
                bg-white text-slate-900 border border-slate-300 border-l-4 ${accent}
                rounded-md shadow-2xl animate-slide-up opacity-100 z-[140]
              `}
              style={{ backgroundColor: '#ffffff', opacity: 1, color: '#0f172a' }}
            >
              <span className={`shrink-0 w-8 h-8 rounded-md flex items-center justify-center ${iconBg}`}>
                <Icon className={`w-4 h-4 ${iconClass}`} />
              </span>
              <div className="flex-1 min-w-0 pt-0.5">
                {t.title && (
                  <p className="text-xs font-bold text-slate-900 leading-snug">{t.title}</p>
                )}
                <p className={`text-xs font-semibold text-slate-800 leading-snug ${t.title ? 'mt-0.5' : ''}`}>
                  {t.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="shrink-0 p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
}
