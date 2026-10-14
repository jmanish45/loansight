import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export default function ErrorState({
  title = 'Something went wrong',
  description = 'Failed to load details. Please try again.',
  onRetry,
  className = '',
}) {
  return (
    <div className={`p-8 text-center border border-red-200 rounded-lg bg-red-50/50 flex flex-col items-center justify-center ${className}`}>
      <span className="w-10 h-10 rounded-full bg-red-100 border border-red-200 grid place-items-center mb-3">
        <AlertCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
      </span>
      <h3 className="text-sm font-semibold text-red-900">{title}</h3>
      <p className="text-xs text-red-700 mt-1 max-w-sm">{description}</p>
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} className="mt-4 gap-1.5">
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          Retry Request
        </Button>
      )}
    </div>
  );
}
