import { useRef, useState } from 'react';
import {
  Upload,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  Loader2,
  ShieldCheck,
  AlertCircle,
  FileText,
  HelpCircle,
  Sparkles,
} from 'lucide-react';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB multer limit
const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

function formatSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const CARD = 'bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_0_rgba(15,23,42,0.04)]';

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
      setSizeError(`${nextFile.name} is ${formatSize(nextFile.size)}. The maximum limit is 10 MB.`);
      onFileChange(null);
      return;
    }
    setSizeError(null);
    onFileChange(nextFile);
  };

  return (
    <div className="space-y-5">
      {/* Top Header Progress Bar */}
      <div className={`${CARD} p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-slate-900">Document Submission</h2>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {loanTypeLabel || 'Loan'} {bankName ? `· ${bankName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono font-medium text-slate-600 shrink-0">
              {Math.min(currentDocIndex, total)} / {total} uploaded
            </span>
            <div
              className="w-28 h-2 bg-slate-100 rounded-full overflow-hidden"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-500"
                style={{ width: `${percent}%` }}
              />
            </div>
            <span className="text-xs font-mono font-semibold text-slate-900 w-9 text-right">
              {percent}%
            </span>
          </div>
        </div>
      </div>

      {/* Main Upload Box */}
      <div className={`${CARD} p-6 lg:p-8`}>
        {allDocsUploaded ? (
          <div className="text-center py-6">
            <span className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            </span>
            <h3 className="text-lg font-semibold text-slate-900 mt-4">
              All Required Documents Uploaded
            </h3>
            <p className="text-xs text-slate-600 mt-1.5 max-w-sm mx-auto leading-relaxed">
              Your document bundle for {bankName || 'lending partner'} has been verified and stored securely.
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-5 py-2.5 mt-6 transition-colors cursor-pointer"
            >
              Continue to Final Review
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
        ) : uploadSuccess ? (
          <div className="text-center py-10 space-y-3">
            <span className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 grid place-items-center mx-auto">
              <CheckCircle2 className="w-7 h-7 text-emerald-600" aria-hidden="true" />
            </span>
            <h3 className="text-base font-semibold text-slate-900">
              {currentDocType?.label} Received & Extracting Text
            </h3>
            <p className="text-xs text-slate-500">Preparing next required document step…</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="max-w-xl mx-auto space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Document {currentDocIndex + 1} of {total}
                </span>
                <span className="text-xs text-slate-400 font-mono">
                  REQUIRED
                </span>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mt-2">
                {currentDocType?.label}
              </h3>
            </div>

            {/* Why Required & Specification Box */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-start gap-2 text-xs text-slate-700">
                <HelpCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-slate-900">Why it is required: </span>
                  <span>{currentDocType?.description || 'Required by underwriting guidelines for identity & income verification.'}</span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200 text-[11px]">
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="font-medium text-slate-500">Supported Formats:</span>
                  <span className="font-mono text-slate-900">PDF, JPG, PNG</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-600">
                  <span className="font-medium text-slate-500">Max Size:</span>
                  <span className="font-mono text-slate-900">10 MB</span>
                </div>
              </div>
            </div>

            {/* Manual text input for PAN / Aadhaar fallback */}
            {(currentDocType?.type === 'pan' || currentDocType?.type === 'aadhaar') && (
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Enter {currentDocType?.label} Number (Optional text verification)
                </label>
                <input
                  type="text"
                  value={manualText}
                  onChange={(e) => onManualTextChange(e.target.value)}
                  placeholder={currentDocType?.type === 'pan' ? 'e.g. ABCDE1234F' : 'e.g. 1234 5678 9012'}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-xs font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 uppercase"
                />
                <p className="text-[11px] text-slate-400">
                  If your document scan is faint, providing the text number helps speed up OCR verification.
                </p>
              </div>
            )}

            {/* Drag and Drop Zone */}
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
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors ${
                dragging
                  ? 'border-emerald-500 bg-emerald-50/60'
                  : file
                    ? 'border-emerald-500 bg-emerald-50/30'
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
                className={`w-12 h-12 rounded-full grid place-items-center ${
                  file ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}
              >
                {file ? (
                  <FileCheck className="w-6 h-6" aria-hidden="true" />
                ) : (
                  <Upload className="w-6 h-6" aria-hidden="true" />
                )}
              </span>

              {file ? (
                <div className="text-center mt-3 space-y-1">
                  <p className="text-sm font-semibold text-slate-900 truncate max-w-xs mx-auto">
                    {file.name}
                  </p>
                  <p className="text-xs font-mono text-slate-500">
                    {formatSize(file.size)}
                  </p>
                  <p className="text-xs font-medium text-emerald-700 pt-1">
                    Click or drop to replace file
                  </p>
                </div>
              ) : (
                <div className="text-center mt-3 space-y-1">
                  <p className="text-sm font-medium text-slate-900">
                    Select a file or drag & drop here
                  </p>
                  <p className="text-xs text-slate-400">
                    Accepted formats: PDF, JPG, PNG (Max 10 MB)
                  </p>
                </div>
              )}
            </label>

            {sizeError && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium" role="alert">
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                {sizeError}
              </p>
            )}

            <button
              type="submit"
              disabled={!file || uploading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg px-4 py-3 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>Uploading & Extracting OCR Data…</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" aria-hidden="true" />
                  <span>Upload & Continue</span>
                </>
              )}
            </button>
          </form>
        )}
      </div>

      {/* Checklist Panel */}
      <div className={CARD}>
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Document Checklist</h3>
            <p className="text-xs text-slate-400">Required by {bankName || 'lending partner'}</p>
          </div>
          <span className="text-xs font-mono font-medium text-slate-600">
            {currentDocIndex} / {total} Completed
          </span>
        </div>

        <ul className="divide-y divide-slate-100 p-2">
          {requiredDocs.map((doc, index) => {
            const isDone = index < currentDocIndex;
            const isCurrent = index === currentDocIndex && !allDocsUploaded;

            return (
              <li
                key={`${doc.type}-${index}`}
                className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  isCurrent ? 'bg-emerald-50/70 border border-emerald-200' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-7 h-7 rounded-full grid place-items-center text-xs font-mono font-semibold shrink-0 ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : index + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`text-xs truncate ${
                        isCurrent ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'
                      }`}
                    >
                      {doc.label}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{doc.description}</p>
                  </div>
                </div>

                <span
                  className={`text-[10px] font-mono font-semibold uppercase px-2 py-0.5 rounded shrink-0 ${
                    isDone
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : isCurrent
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isDone ? 'Verified' : isCurrent ? 'Active Step' : 'Pending'}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-200 bg-slate-50 rounded-b-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden="true" />
          <p className="text-xs text-slate-600">
            Encrypted document transfer. Stored securely and reviewed only by authorized loan officers.
          </p>
        </div>
      </div>
    </div>
  );
}

