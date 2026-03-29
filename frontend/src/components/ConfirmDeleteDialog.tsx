import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void> | void;
  title: string;
  description: string;
  itemName?: string;
  warning?: string;
}

export default function ConfirmDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemName,
  warning,
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // error handled by caller
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[95vw] max-w-md -translate-x-1/2 -translate-y-1/2 animate-fade-in">
          <div className="rounded-2xl bg-white dark:bg-brand-900 shadow-2xl border border-brand-200 dark:border-brand-700 overflow-hidden">
            {/* Red accent bar */}
            <div className="h-1.5 bg-gradient-to-r from-danger via-danger/80 to-danger/60" />

            <div className="p-6">
              {/* Icon + Title */}
              <div className="flex items-start gap-4 mb-4">
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-full bg-danger/10 border border-danger/20">
                  <ExclamationTriangleIcon className="h-6 w-6 text-danger" />
                </div>
                <div className="flex-1 min-w-0">
                  <Dialog.Title className="text-lg font-bold text-brand-900 dark:text-white">
                    {title}
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-brand-500 mt-1 leading-relaxed">
                    {description}
                  </Dialog.Description>
                </div>
                <Dialog.Close asChild>
                  <button className="flex-shrink-0 p-1 rounded-lg hover:bg-brand-100 dark:hover:bg-brand-800 transition-colors text-brand-400">
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Item name highlight */}
              {itemName && (
                <div className="bg-brand-50 dark:bg-brand-800/50 border border-brand-200 dark:border-brand-700 rounded-xl px-4 py-3 mb-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-400 mb-1">Item to delete</p>
                  <p className="font-semibold text-brand-900 dark:text-white">{itemName}</p>
                </div>
              )}

              {/* Warning message */}
              {warning && (
                <div className="bg-warning/5 border border-warning/20 rounded-xl px-4 py-3 mb-4 flex items-start gap-2.5">
                  <ExclamationTriangleIcon className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-warning font-medium leading-relaxed">{warning}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 mt-6">
                <Dialog.Close asChild>
                  <button
                    disabled={loading}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl border border-brand-200 dark:border-brand-700 text-brand-700 dark:text-brand-300 bg-white dark:bg-brand-800 hover:bg-brand-50 dark:hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleConfirm}
                  disabled={loading}
                  className="flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl bg-danger text-white hover:bg-danger/90 transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    'Yes, Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
