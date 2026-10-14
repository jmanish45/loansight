import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

const variants = {
  success: {
    container: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    icon: CheckCircle2,
    iconColor: 'text-emerald-600',
  },
  warning: {
    container: 'bg-amber-50 border-amber-200 text-amber-900',
    icon: AlertTriangle,
    iconColor: 'text-amber-600',
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-900',
    icon: XCircle,
    iconColor: 'text-red-600',
  },
  info: {
    container: 'bg-sky-50 border-sky-200 text-sky-900',
    icon: Info,
    iconColor: 'text-sky-600',
  },
};

export default function Alert({
  title,
  children,
  variant = 'info',
  action,
  className = '',
}) {
  const config = variants[variant] || variants.info;
  const Icon = config.icon;

  return (
    <div
      role="alert"
      className={`p-3.5 rounded-lg border flex items-start gap-3 text-xs leading-relaxed ${config.container} ${className}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${config.iconColor}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <h4 className="font-semibold text-sm leading-tight mb-1">{title}</h4>}
        <div>{children}</div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
