import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'primary' | 'danger';
  showCancel?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'キャンセル',
  confirmTone = 'primary',
  showCancel = true,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26, 27, 25, 0.45)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="surface-card w-full max-w-md p-6 shadow-xl">
        <h3
          id="confirm-modal-title"
          className="text-lg font-bold"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </h3>
        <p
          className="mt-3 text-sm leading-relaxed whitespace-pre-line"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {message}
        </p>
        <div className="mt-6 flex items-center justify-end gap-3">
          {showCancel && (
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            className={confirmTone === 'danger' ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
