import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  ArrowRight,
  Plus,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Upload,
  Loader2,
} from 'lucide-react';
import { formatINR, formatMonths } from '../../lib/loanMath';
import { statusMeta, getBank } from '../../lib/dashboardData';
import BankLogo from '../common/BankLogo';
import { getDocumentRequirements } from '../../constants/mockData';
import { ROUTES } from '../../constants/routes';
import { useLanguage } from '../../context/LanguageContext';
import {
  translateDocType,
  translateDocPill,
  translateBlurb,
  translateStatus,
  translateLoanType,
} from '../../constants/translations';

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

const ACCENT_BY_TONE = {
  positive: 'border-l-emerald-500',
  negative: 'border-l-red-500',
  attention: 'border-l-amber-500',
  neutral: 'border-l-slate-300',
};

const TONE_ICON = {
  positive: CheckCircle2,
  negative: XCircle,
  attention: AlertTriangle,
  neutral: Clock,
};

const TONE_ICON_COLOR = {
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  attention: 'text-amber-600',
  neutral: 'text-slate-400',
};

const DOC_PILL = {
  approved: { label: 'Approved', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  rejected: { label: 'Rejected', pill: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  pending_review: { label: 'In Review', pill: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
};

const MISSING_PILL = { label: 'Missing', pill: 'bg-slate-100 text-slate-600', dot: 'bg-slate-300' };

function humanise(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(value, lang) {
  if (!value) return '—';
  const activeLang = lang || (typeof window !== 'undefined' ? localStorage.getItem('loanlens_language') : null) || 'en';
  const locale = activeLang === 'mr' ? 'mr-IN' : activeLang === 'hi' ? 'hi-IN' : 'en-IN';
  return new Date(value).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function DocRow({ dot, label, sub, pill, pillLabel, isMissing, onUpload, uploading, t }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <span className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${dot}`} />
        <div className="min-w-0">
          <p className="text-sm text-slate-900 truncate">{label}</p>
          <p className="text-[11px] text-slate-400 truncate">{sub}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${pill}`}>
          {pillLabel}
        </span>
        {isMissing && onUpload && (
          <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer transition-colors shadow-2xs">
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            <span>{uploading ? (t ? t('uploading', 'Uploading...') : 'Uploading...') : (t ? t('upload_btn', 'Upload') : 'Upload')}</span>
            <input
              type="file"
              accept=".pdf,image/jpeg,image/png"
              disabled={uploading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onUpload(f);
              }}
            />
          </label>
        )}
      </div>
    </div>
  );
}

function ReplaceControls({ docKey, docLabel, isOpen, uploading, onOpen, onCancel, onSubmit, t }) {
  const [file, setFile] = useState(null);

  // A file chosen for one document must never be submitted for another.
  useEffect(() => {
    if (!isOpen) setFile(null);
  }, [isOpen, docKey]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center gap-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-medium rounded-lg px-3 py-2 transition-colors cursor-pointer"
      >
        <Upload className="w-4 h-4" aria-hidden="true" />
        {t ? t('replace_document', 'Replace Document') : 'Replace Document'}
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="file"
        accept=".pdf,image/jpeg,image/png"
        aria-label={`Replacement file for ${docLabel}`}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={() => file && onSubmit(file)}
          className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="w-4 h-4" aria-hidden="true" />
          )}
          {uploading ? (t ? t('uploading', 'Uploading...') : 'Uploading...') : (t ? t('upload_replacement', 'Upload Replacement') : 'Upload Replacement')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium rounded-lg px-3 py-2 transition-colors cursor-pointer"
        >
          {t ? t('cancel_btn', 'Cancel') : 'Cancel'}
        </button>
      </div>
    </div>
  );
}

export default function ApplicationsPanel({
  applications = [],
  searchTerm = '',
  onReplace = async () => {},
  uploading = false,
  replacingKey = null,
  onReplaceTargetChange = () => {},
}) {
  const { t } = useLanguage();
  const list = Array.isArray(applications) ? applications.filter(Boolean) : [];

  const filtered = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return list;
    return list.filter((app) => {
      const haystack = [
        app._id,
        app.bankName,
        app.loanType,
        statusMeta(app.status).label,
        ...(Array.isArray(app.documents)
          ? app.documents.flatMap((d) => [d?.originalName, d?.documentType])
          : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [list, searchTerm]);

  const [expandedId, setExpandedId] = useState(null);
  const defaultExpandedId = filtered[0]?._id ?? null;
  const activeExpandedId = expandedId === null ? defaultExpandedId : expandedId;

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[15px] font-semibold text-slate-900">{t('my_applications', 'My Applications')}</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          {list.length} {t('total', 'total')}{filtered.length !== list.length ? ` · ${filtered.length} ${t('shown', 'shown')}` : ''}
        </p>
      </div>
      <Link
        to={ROUTES.APPLY}
        className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-sm font-medium rounded-lg px-3 py-2 transition-colors"
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        {t('new_application', 'New application')}
      </Link>
    </div>
  );

  if (list.length === 0) {
    return (
      <section id="applications" className="space-y-4">
        {header}
        <div className={`${CARD} py-12 text-center px-5`}>
          <span className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 grid place-items-center mx-auto">
            <FileText className="w-5 h-5 text-slate-400" aria-hidden="true" />
          </span>
          <h3 className="text-[15px] font-semibold text-slate-900 mt-4">{t('no_applications_yet', 'No applications yet')}</h3>
          <p className="text-sm text-slate-600 mt-1 mb-5 max-w-sm mx-auto">
            {t('start_app_desc', 'Start your first application to compare partner banks and track verification.')}
          </p>
          <Link
            to={ROUTES.APPLY}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
          >
            {t('start_application', 'Start Application')}
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section id="applications" className="space-y-4">
      {header}

      {filtered.length === 0 ? (
        <div className={`${CARD} py-10 text-center px-5`}>
          <p className="text-sm text-slate-600">
            {t('no_match_search', 'No applications match')} &ldquo;{searchTerm}&rdquo;.
          </p>
        </div>
      ) : (
        filtered.map((app) => {
          const meta = statusMeta(app.status);
          const documents = Array.isArray(app.documents) ? app.documents : [];
          const activeTypes = new Set(
            documents
              .filter((d) => d?.status !== 'rejected' && d?.status !== 'superseded')
              .map((d) => (d?.documentType || '').toLowerCase().replace(/[-_ ]/g, ''))
          );
          const rejected = documents.filter((d) => {
            if (d?.status !== 'rejected') return false;
            const dt = (d?.documentType || '').toLowerCase().replace(/[-_ ]/g, '');
            return !activeTypes.has(dt);
          });
          const requirements = getDocumentRequirements(app.loanType) || [];
          const requiredTypes = new Set(requirements.map((r) => r.type.toLowerCase().replace(/[-_ ]/g, '')));
          const extras = documents.filter((d) => {
            const dt = (d?.documentType || '').toLowerCase().replace(/[-_ ]/g, '');
            return !requiredTypes.has(dt) && d?.status !== 'superseded';
          });
          const isExpanded = activeExpandedId === app._id;
          const bank = getBank(app);
          const ToneIcon = TONE_ICON[meta.tone] || Clock;

          return (
            <div
              key={app._id}
              className={`${CARD} overflow-hidden border-l-[3px] ${ACCENT_BY_TONE[meta.tone] || ACCENT_BY_TONE.neutral}`}
            >
              <button
                type="button"
                aria-expanded={isExpanded}
                onClick={() => setExpandedId(isExpanded ? '' : app._id)}
                className="w-full text-left p-5 hover:bg-slate-50/70 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <BankLogo bank={bank} name={app.bankName} size="md" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900 capitalize">
                          {translateLoanType(app.loanType, t)}
                        </span>
                        <span className="text-slate-300">·</span>
                        <span className="text-sm text-slate-600 tabular-nums">
                          {formatINR(app.requestedAmount)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 truncate">
                        {app.bankName || 'Partner bank'} · {formatMonths(app.tenureMonths)} · {t('timeline_created', 'Applied')}{' '}
                        {formatDate(app.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {rejected.length > 0 && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 tabular-nums">
                        {rejected.length} {t('to_fix', 'to fix')}
                      </span>
                    )}
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${meta.pill}`}>
                      {translateStatus(app.status, t) || meta.label}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-slate-200 p-5 pt-4 space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t('lending_partner', 'Lending Partner')}
                      </p>
                      <p className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                        {app.bankName || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t('tenure', 'Tenure')}
                      </p>
                      <p className="text-sm font-medium text-slate-900 tabular-nums mt-0.5">
                        {formatMonths(app.tenureMonths)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t('declared_income', 'Declared Income')}
                      </p>
                      <p className="text-sm font-medium text-slate-900 tabular-nums mt-0.5">
                        {formatINR(app.declaredMonthlyIncome)}
                        <span className="text-slate-400">/mo</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                        {t('application_id', 'Application ID')}
                      </p>
                      <p className="font-mono text-[11px] text-slate-600 mt-1">
                        {String(app._id || '').slice(-8)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <ToneIcon
                      className={`w-4 h-4 shrink-0 mt-0.5 ${TONE_ICON_COLOR[meta.tone] || TONE_ICON_COLOR.neutral}`}
                      aria-hidden="true"
                    />
                    <p className="text-sm text-slate-600">{translateBlurb(app.status, t) || meta.blurb}</p>
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mb-1">
                      {t('documents', 'Documents')}
                    </p>
                    <div>
                      {requirements.map((req) => {
                        const rt = (req?.type || '').toLowerCase().replace(/[-_ ]/g, '');
                        const match = documents.find((d) => {
                          if (d?.status === 'superseded') return false;
                          const dt = (d?.documentType || '').toLowerCase().replace(/[-_ ]/g, '');
                          const pred = (d?.aiProcessing?.predictedType || '').toLowerCase().replace(/[-_ ]/g, '');
                          return (
                            dt === rt ||
                            pred === rt ||
                            (rt.includes('form16') && (dt.includes('form16') || pred.includes('form16') || dt.includes('itr')))
                          );
                        });
                        const isMissing = !match;
                        const style = match
                          ? DOC_PILL[match.status] || DOC_PILL.pending_review
                          : MISSING_PILL;
                        return (
                          <DocRow
                            key={req.type}
                            dot={style.dot}
                            label={translateDocType(req.type, t) || req.label}
                            sub={match?.originalName || t('doc_not_uploaded', 'Not uploaded')}
                            pill={style.pill}
                            pillLabel={match ? translateDocPill(match.status, t) : translateDocPill('missing', t)}
                            isMissing={isMissing}
                            uploading={uploading}
                            onUpload={(f) => onReplace(app._id, req.type, f)}
                            t={t}
                          />
                        );
                      })}
                    </div>

                    {extras.length > 0 && (
                      <>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400 mt-4 mb-1">
                          {t('additional_documents', 'Additional Documents')}
                        </p>
                        <div>
                          {extras.map((doc) => {
                            const style = DOC_PILL[doc.status] || DOC_PILL.pending_review;
                            return (
                              <DocRow
                                key={doc._id}
                                dot={style.dot}
                                label={translateDocType(doc.documentType, t) || humanise(doc.documentType)}
                                sub={doc.originalName || '—'}
                                pill={style.pill}
                                pillLabel={translateDocPill(doc.status, t)}
                                t={t}
                              />
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {rejected.length > 0 && (
                    <div
                      className="rounded-lg border border-red-200 bg-red-50 p-4 scroll-mt-24"
                    >
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" aria-hidden="true" />
                        <h4 className="text-sm font-semibold text-slate-900">{t('action_required', 'Action Required')}</h4>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 mb-3">
                        {t('reupload_docs_desc', 'Re-upload the documents below. Everything else stays as it is.')}
                      </p>

                      <div className="space-y-3">
                        {rejected.map((doc) => {
                          const key = `${app._id}:${doc._id}`;
                          const docLabel = translateDocType(doc.documentType, t) || humanise(doc.documentType);
                          return (
                            <div key={doc._id} className="bg-white border border-red-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-slate-900">{docLabel}</p>
                              <p className="text-[11px] text-slate-400 truncate">{doc.originalName}</p>

                              {doc.reviewComment && (
                                <p className="bg-red-50 border border-red-100 rounded-md p-2 text-[11px] text-red-700 mt-2">
                                  <span className="font-semibold">{t('officer_note', 'Officer note:')} </span>
                                  {doc.reviewComment}
                                </p>
                              )}

                              <div className="mt-3">
                                <ReplaceControls
                                  docKey={key}
                                  docLabel={docLabel}
                                  isOpen={replacingKey === key}
                                  uploading={uploading}
                                  onOpen={() => onReplaceTargetChange(key)}
                                  onCancel={() => onReplaceTargetChange(null)}
                                  onSubmit={(file) => onReplace(app._id, doc.documentType, file)}
                                  t={t}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {app.status === 'draft' && (
                    <Link
                      to={ROUTES.APPLY}
                      className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 transition-colors"
                    >
                      {t('continue_application', 'Continue application')}
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
