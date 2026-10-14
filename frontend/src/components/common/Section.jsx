export default function Section({
  title,
  subtitle,
  action,
  children,
  className = '',
  id,
}) {
  return (
    <section id={id} className={`space-y-4 ${className}`}>
      {(title || subtitle || action) && (
        <div className="flex flex-wrap items-end justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            {title && (
              <h2 className="text-base font-semibold text-slate-900 tracking-tight">
                {title}
              </h2>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
