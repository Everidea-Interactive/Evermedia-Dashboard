import { useEffect } from 'react';

type ToastProps = {
  message: string;
  type: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
};

export default function Toast({ message, type, onClose, duration = 5000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const colors = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    error: 'border-red-200 bg-red-50 text-red-700',
    info: 'border-blue-200 bg-blue-50 text-blue-700',
  };

  return (
    <div className="fixed inset-x-0 bottom-4 flex justify-center px-4 pointer-events-none z-50">
      <div className={`pointer-events-auto max-w-md w-full rounded-lg border px-4 py-3 text-sm shadow-lg ${colors[type]}`}>
        <div className="flex items-center justify-between">
          <span>{message}</span>
          <button
            onClick={onClose}
            className="ml-4 text-current opacity-70 hover:opacity-100"
            aria-label="Close"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

