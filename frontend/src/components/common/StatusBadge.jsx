import { useLanguage } from '../../context/LanguageContext';
import { translateStatus } from '../../constants/translations';
import { statusMeta } from '../../lib/officerData';

export default function StatusBadge({ status, className = '' }) {
  const { t } = useLanguage();
  const meta = statusMeta(status);
  const label = translateStatus(status, t) || meta.label;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-md tracking-tight whitespace-nowrap border border-slate-200 ${meta.chip} ${className}`}
    >
      {label}
    </span>
  );
}

