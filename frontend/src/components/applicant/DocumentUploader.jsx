import { useRef, useState } from 'react';
import {
  Upload,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

const MAX_BYTES = 10 * 1024 * 1024; // Matches the backend multer limit.
const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

/**
 * Step 2 of the application: one required document at a time, with the full
 * checklist alongside so the applicant always knows what is still outstanding.
 */
export default function DocumentUploader({
  requiredDocs = [],
  currentDocIndex = 0,
  currentDocType = null,
  allDocsUploaded = false,
  file = null,
  onFileChange = () => {},
  manualText = '',
  onManualTextChange = () => {},
  uploading = false,
  uploadSuccess = false,
  onSubmit = () => {},
  onContinue = () => {},
  bankName = '',
  loanTypeLabel = '',
}) {
  const total = requiredDocs.length || 1;
  const percent = Math.round((currentDocIndex / total) * 100);
  const [dragging, setDragging] = useState(false);
  const [sizeError, setSizeError] = useState(null);
  const inputRef = useRef(null);

  const acceptFile = (nextFile) => {
    if (!nextFile) return;
    if (nextFile.size > MAX_BYTES) {
      setSizeError(`${nextFile.name} is ${formatSize(nextFile.size)}. The limit is 10 MB.`);
      onFileChange(null);
      return;
    }
    setSizeError(null);
    onFileChange(nextFile);
  };

  return (
    <div className="space-y-5">
      <div className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">Upload your documents</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {loanTypeLabel || 'Loan'}
              {bankName ? ` · ${bankName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-600 tabular-nums shrink-0">
              {Math.min(currentDocIndex, total)} of {total} uploaded
            </span>
            <div
              className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Document upload progress"
            >
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-slate-900 tabular-nums w-9 text-right">
              {percent}%
            </span>
          </div>
        </div>
      </div>

      <div className={`${CARD} p-6 lg:p-8`}>
        {allDocsUploaded ? (
          <div className="text-center py-6">
            <span className="w-14 h-14 rounded-full bg-emerald-50 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold text-slate-900 mt-4">
              All required documents uploaded
            </h3>
            <p className="text-sm text-slate-600 mt-1.5 max-w-sm mx-auto">
              Your application {bankName ? `with ${bankName} ` : ''}is ready for review.
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 mt-6 transition-colors cursor-pointer"
            >
              Continue to review
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : uploadSuccess ? (
          <div className="text-center py-10">
            <span className="w-14 h-14 rounded-full bg-emerald-50 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold text-slate-900 mt-4">
              {currentDocType?.label} received
            </h3>
            <p className="text-sm text-slate-600 mt-1.5">Opening the next document…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="max-w-xl mx-auto">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-600">
              Document {currentDocIndex + 1} of {total}
            </p>
            <h3 className="text-lg font-semibold text-slate-900 mt-1">
              {currentDocType?.label}
            </h3>
            <p className="text-sm text-slate-600 mt-1">{currentDocType?.description}</p>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                acceptFile(e.dataTransfer?.files?.[0] || null);
              }}
              className={`flex flex-col items-center justify-center border border-dashed rounded-xl p-8 mt-5 cursor-pointer transition-colors ${
                dragging
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : file
                    ? 'border-emerald-500 bg-emerald-50/40'
                    : 'border-slate-300 bg-slate-50 hover:border-slate-400'
              }`}
            >
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept={ACCEPTED}
                aria-label={`Upload ${currentDocType?.label || 'document'}`}
                onChange={(e) => acceptFile(e.target.files?.[0] || null)}
              />
              <span
                className={`w-11 h-11 rounded-full grid place-items-center ${
                  file ? 'bg-emerald-500' : 'bg-white border border-slate-200'
                }`}
              >
                {file ? (
                  <FileCheck className="w-5 h-5 text-white" aria-hidden="true" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-600" aria-hidden="true" />
                )}
              </span>

              {file ? (
                <span className="text-center mt-3">
                  <span className="block text-sm font-medium text-slate-900 truncate max-w-xs">
                    {file.name}
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5 tabular-nums">
                    {formatSize(file.size)}
                  </span>
                  <span className="block text-xs font-medium text-emerald-600 mt-1.5">
                    Click to choose a different file
                  </span>
                </span>
              ) : (
                <span className="text-center mt-3">
                  <span className="block text-sm font-medium text-slate-900">
                    Click to upload or drag a file here
                  </span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    PDF, JPG or PNG · up to 10 MB
                  </span>
                </span>
              )}
            </label>

            {sizeError && (
              <p className="flex items-start gap-1.5 text-xs text-red-600 mt-2" role="alert">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
                {sizeError}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg px-4 py-2.5 mt-6 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Upload className="w-4 h-4" aria-hidden="true" />
              )}
              {uploading ? 'Uploading…' : 'Upload & continue'}
            </button>
          </form>
        )}
      </div>

      <div className={CARD}>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-[15px] font-semibold text-slate-900">Required documents</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Based on your {loanTypeLabel ? loanTypeLabel.toLowerCase() : 'loan'} selection
          </p>
        </div>

        <ol className="p-2">
          {requiredDocs.map((doc, index) => {
            const isDone = index < currentDocIndex;
            const isCurrent = index === currentDocIndex && !allDocsUploaded;

            return (
              <li
                key={`${doc.type}-${index}`}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 ${
                  isCurrent ? 'bg-emerald-50/60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                          ? 'bg-navy-900 text-white'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                    aria-hidden="true"
                  >
                    {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-sm truncate ${
                        isCurrent ? 'font-medium text-slate-900' : 'text-slate-900'
                      }`}
                    >
                      {doc.label}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{doc.description}</p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                    isDone
                      ? 'bg-emerald-50 text-emerald-700'
                      : isCurrent
                        ? 'bg-slate-100 text-slate-700'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? 'Uploaded' : isCurrent ? 'Now' : 'Pending'}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <p className="text-xs text-slate-600">
            Files are shared only with the authorised loan officers reviewing your application.
          </p>
        </div>
      </div>
    </div>
  );
}
