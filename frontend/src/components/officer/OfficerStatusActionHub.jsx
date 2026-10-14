import React, { useState, useRef, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { translateStatus } from '../../constants/translations';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Send,
  Brain,
  AlertTriangle,
  FileText,
  ArrowLeft,
  ChevronDown,
  Trash2,
  Loader2,
  Check,
  Sparkles,
  ShieldCheck,
  FileQuestion,
} from 'lucide-react';

export const OFFICER_STATUS_OPTIONS = [
  {
    value: 'under_review',
    label: 'Under Review',
    description: 'Manual officer evaluation in progress',
    icon: Brain,
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    dotColor: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    hoverBg: 'hover:bg-amber-50/70',
    activeBg: 'bg-amber-50/90 text-amber-900',
  },
  {
    value: 'approved',
    label: 'Approve Loan',
    description: 'Verify eligibility & issue loan approval',
    icon: CheckCircle2,
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotColor: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    hoverBg: 'hover:bg-emerald-50/70',
    activeBg: 'bg-emerald-50/90 text-emerald-900',
  },
  {
    value: 'documents_required',
    label: 'Documents Required',
    description: 'Request applicant to re-upload files',
    icon: AlertTriangle,
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
    dotColor: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
    hoverBg: 'hover:bg-orange-50/70',
    activeBg: 'bg-orange-50/90 text-orange-900',
  },
  {
    value: 'rejected',
    label: 'Reject Application',
    description: 'Decline loan with underwriter note',
    icon: XCircle,
    badgeBg: 'bg-red-50 text-red-700 border-red-200',
    dotColor: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    hoverBg: 'hover:bg-red-50/70',
    activeBg: 'bg-red-50/90 text-red-900',
  },
  {
    value: 'submitted',
    label: 'Submitted',
    description: 'Awaiting initial triage and assessment',
    icon: Send,
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    dotColor: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    hoverBg: 'hover:bg-blue-50/70',
    activeBg: 'bg-blue-50/90 text-blue-900',
  },
  {
    value: 'documents_pending',
    label: 'Documents Pending',
    description: 'Applicant is still uploading paperwork',
    icon: FileText,
    badgeBg: 'bg-slate-50 text-slate-700 border-slate-200',
    dotColor: 'bg-slate-400',
    hoverBg: 'hover:bg-slate-50',
    activeBg: 'bg-slate-100 text-slate-900',
  },
  {
    value: 'withdrawn',
    label: 'Withdrawn',
    description: 'Application cancelled by applicant or expired',
    icon: ArrowLeft,
    badgeBg: 'bg-slate-50 text-slate-600 border-slate-200',
    dotColor: 'bg-slate-400',
    hoverBg: 'hover:bg-slate-50',
    activeBg: 'bg-slate-100 text-slate-800',
  },
  {
    value: 'draft',
    label: 'Draft',
    description: 'Incomplete application stage',
    icon: Clock,
    badgeBg: 'bg-slate-50 text-slate-600 border-slate-200',
    dotColor: 'bg-slate-400',
    hoverBg: 'hover:bg-slate-50',
    activeBg: 'bg-slate-100 text-slate-800',
  },
];

/**
 * Premium Officer Status Action Suite
 * Features:
 * - Solid primary action buttons (Approve, Reject, Request Docs)
 * - Custom interactive animated status dropdown
 * - Polished tactile button states with micro-interactions
 * - Clean delete action
 */
export default function OfficerStatusActionHub({
  currentStatus,
  onStatusChange,
  onDelete,
  updating = false,
}) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption =
    OFFICER_STATUS_OPTIONS.find((opt) => opt.value === currentStatus) ||
    OFFICER_STATUS_OPTIONS[0];
  const ActiveIcon = activeOption.icon;

  const handleSelect = (statusValue) => {
    if (statusValue !== currentStatus && !updating) {
      onStatusChange(statusValue);
    }
    setIsOpen(false);
  };

  const isApproved = currentStatus === 'approved';
  const isRejected = currentStatus === 'rejected';
  const isDocsRequired = currentStatus === 'documents_required';

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {/* Quick Solid Action Button: APPROVE */}
      <button
        type="button"
        disabled={updating || isApproved}
        onClick={() => onStatusChange('approved')}
        className={`group relative inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
          isApproved
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 opacity-90 shadow-none'
            : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-600/30'
        }`}
        title={t('approve_loan', 'Approve Loan')}
      >
        {updating && currentStatus !== 'approved' ? (
          <Loader2 className="w-4 h-4 animate-spin text-white" />
        ) : (
          <CheckCircle2
            className={`w-4 h-4 transition-transform group-hover:scale-110 ${
              isApproved ? 'text-emerald-600' : 'text-emerald-100'
            }`}
          />
        )}
        <span>{isApproved ? t('approved', 'Approved') : t('approve_loan', 'Approve Loan')}</span>
      </button>

      {/* Quick Solid Action Button: REJECT */}
      <button
        type="button"
        disabled={updating || isRejected}
        onClick={() => onStatusChange('rejected')}
        className={`group relative inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-bold transition-all duration-200 shadow-sm active:scale-95 cursor-pointer disabled:cursor-not-allowed ${
          isRejected
            ? 'bg-red-50 text-red-700 border border-red-200 opacity-90 shadow-none'
            : 'bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 active:bg-red-100'
        }`}
        title={t('reject_loan', 'Reject')}
      >
        <XCircle
          className={`w-4 h-4 transition-transform group-hover:scale-110 ${
            isRejected ? 'text-red-600' : 'text-red-500'
          }`}
        />
        <span>{isRejected ? t('rejected', 'Rejected') : t('reject_loan', 'Reject')}</span>
      </button>

      {/* Custom Interactive Dropdown Menu */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          disabled={updating}
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-md text-xs font-bold bg-white border border-slate-200 hover:border-slate-300 text-slate-800 shadow-2xs hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-98 ${
            isOpen ? 'ring-2 ring-emerald-500/20 border-emerald-500 bg-slate-50/50' : ''
          }`}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${activeOption.dotColor} shrink-0`} />
          <span className="font-semibold text-slate-700">{t('status_label', 'Status:')}</span>
          <span className="font-bold text-slate-900">{translateStatus(activeOption.value, t)}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ml-0.5 ${
              isOpen ? 'rotate-180 text-slate-700' : ''
            }`}
          />
        </button>

        {/* Dropdown Popover Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-72 origin-top-right bg-white rounded-md shadow-xl border border-slate-200/90 py-2 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-sm divide-y divide-slate-100">
            <div className="px-3.5 py-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {t('change_state_title', 'Change Application State')}
              </p>
            </div>

            <div className="py-1 max-h-[340px] overflow-y-auto">
              {OFFICER_STATUS_OPTIONS.map((opt) => {
                const isSelected = opt.value === currentStatus;
                const ItemIcon = opt.icon;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={`w-full text-left px-3.5 py-2.5 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? opt.activeBg
                        : `text-slate-700 ${opt.hoverBg}`
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5 border ${opt.badgeBg}`}
                    >
                      <ItemIcon className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-bold truncate ${
                            isSelected ? 'text-slate-900 font-extrabold' : 'text-slate-800'
                          }`}
                        >
                          {translateStatus(opt.value, t)}
                        </span>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 font-bold" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-snug mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Application Button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={updating}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 rounded-md transition-all duration-200 border border-transparent hover:border-red-200 cursor-pointer disabled:opacity-50"
        title={t('delete_btn', 'Delete')}
      >
        <Trash2 className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{t('delete_btn', 'Delete')}</span>
      </button>
    </div>
  );
}
