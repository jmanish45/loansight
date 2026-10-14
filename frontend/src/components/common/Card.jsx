export default function Card({
  children,
  glass = false,
  variant = 'default',
  className = '',
  ...props
}) {
  const variantStyles = {
    default: 'bg-white border border-slate-200 shadow-subtle',
    panel: 'bg-white border border-slate-200 shadow-panel',
    subtle: 'bg-slate-50 border border-slate-200',
    dark: 'bg-slate-900 text-white border border-slate-800',
    outlined: 'bg-transparent border border-slate-200',
  };

  return (
    <div
      className={`
        rounded-lg p-5 transition-colors duration-150
        ${variantStyles[variant] || variantStyles.default}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}
