import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import Button from '../common/Button';

export default function FileUpload({
  accept = '.pdf,.jpg,.jpeg,.png',
  maxSizeMB = 10,
  onFileSelect,
  file,
  uploading = false,
  success = false,
  error = null,
  label = 'Upload document',
  description = 'PDF, JPG or PNG up to 10MB',
  className = '',
}) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSelect(e.dataTransfer.files[0]);
    }
  };

  const validateAndSelect = (selectedFile) => {
    if (selectedFile.size > maxSizeMB * 1024 * 1024) {
      alert(`File size exceeds limit of ${maxSizeMB}MB`);
      return;
    }
    if (onFileSelect) onFileSelect(selectedFile);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative p-6 text-center border-2 border-dashed rounded-lg cursor-pointer
          transition-colors duration-150 ease-in-out flex flex-col items-center justify-center
          ${isDragOver
            ? 'border-sky-500 bg-sky-50/50'
            : file
              ? 'border-emerald-300 bg-emerald-50/30'
              : error
                ? 'border-red-300 bg-red-50/30'
                : 'border-slate-300 hover:border-slate-400 bg-white'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => e.target.files?.[0] && validateAndSelect(e.target.files[0])}
        />

        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 text-sky-600 animate-spin" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-900">Uploading and hashing document...</p>
          </div>
        ) : success ? (
          <div className="flex flex-col items-center gap-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" aria-hidden="true" />
            <p className="text-xs font-semibold text-emerald-900">Document attached successfully</p>
            <p className="text-[11px] text-emerald-700">{file?.name}</p>
          </div>
        ) : file ? (
          <div className="flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-emerald-600" aria-hidden="true" />
            <p className="text-xs font-semibold text-slate-900">{file.name}</p>
            <p className="text-[11px] text-slate-500 font-mono tabular-nums">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
            <span className="text-[11px] text-sky-600 hover:underline">Click to change file</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <span className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 grid place-items-center">
              <Upload className="w-5 h-5 text-slate-500" aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold text-slate-900">{label}</p>
            <p className="text-[11px] text-slate-500">{description}</p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs font-medium text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
