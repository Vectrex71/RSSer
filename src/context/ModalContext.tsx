import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Trash2, 
  XCircle, 
  HelpCircle,
  X,
  AlertOctagon
} from 'lucide-react';
import { useSettings } from './SettingsContext';

export type ModalVariant = 'default' | 'danger' | 'warning' | 'success' | 'info';

interface ModalOptions {
  type?: 'alert' | 'confirm';
  variant?: ModalVariant;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  icon?: ReactNode;
}

interface ModalState extends ModalOptions {
  isOpen: boolean;
  resolve?: (value: boolean) => void;
}

interface ModalContextType {
  showAlert: (message: string, title?: string, confirmText?: string, variant?: ModalVariant) => Promise<void>;
  showConfirm: (message: string, title?: string, confirmText?: string, cancelText?: string, variant?: ModalVariant) => Promise<boolean>;
  showCustomModal: (options: ModalOptions) => Promise<boolean>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const lang = settings.language || 'de';

  const [modal, setModal] = useState<ModalState>({
    isOpen: false,
    type: 'alert',
    variant: 'default',
    message: '',
  });

  const getLocalizedDefaultTitle = (type: 'alert' | 'confirm', variant: ModalVariant) => {
    if (variant === 'danger') {
      if (lang === 'en') return 'Confirm Action';
      if (lang === 'fr') return 'Confirmer l\'action';
      if (lang === 'es') return 'Confirmar acción';
      return 'Aktion bestätigen';
    }
    if (variant === 'warning') {
      if (lang === 'en') return 'Warning';
      if (lang === 'fr') return 'Avertissement';
      if (lang === 'es') return 'Advertencia';
      return 'Hinweis';
    }
    if (variant === 'success') {
      if (lang === 'en') return 'Success';
      if (lang === 'fr') return 'Succès';
      if (lang === 'es') return 'Éxito';
      return 'Erfolg';
    }
    if (type === 'confirm') {
      if (lang === 'en') return 'Confirmation Required';
      if (lang === 'fr') return 'Confirmation requise';
      if (lang === 'es') return 'Confirmación requerida';
      return 'Bestätigung erforderlich';
    }
    if (lang === 'en') return 'Information';
    if (lang === 'fr') return 'Information';
    if (lang === 'es') return 'Información';
    return 'Information';
  };

  const getLocalizedDefaultConfirm = (type: 'alert' | 'confirm', variant: ModalVariant) => {
    if (variant === 'danger' && type === 'confirm') {
      if (lang === 'en') return 'Delete / Remove';
      if (lang === 'fr') return 'Supprimer';
      if (lang === 'es') return 'Eliminar';
      return 'Löschen / Entfernen';
    }
    if (type === 'confirm') {
      if (lang === 'en') return 'Confirm';
      if (lang === 'fr') return 'Confirmer';
      if (lang === 'es') return 'Confirmar';
      return 'Bestätigen';
    }
    return 'OK';
  };

  const getLocalizedDefaultCancel = () => {
    if (lang === 'en') return 'Cancel';
    if (lang === 'fr') return 'Annuler';
    if (lang === 'es') return 'Cancelar';
    return 'Abbrechen';
  };

  const inferVariant = (message: string, title?: string): ModalVariant => {
    const text = `${title || ''} ${message}`.toLowerCase();
    if (
      text.includes('löschen') || 
      text.includes('entfernen') || 
      text.includes('delete') || 
      text.includes('remove') || 
      text.includes('verwerfen') || 
      text.includes('zurücksetzen') ||
      text.includes('bereinigung') ||
      text.includes('fehlerhafte quellen') ||
      text.includes('abbrechen')
    ) {
      return 'danger';
    }
    if (
      text.includes('erfolg') || 
      text.includes('success') || 
      text.includes('gespeichert') || 
      text.includes('saved') || 
      text.includes('veröffentlicht') ||
      text.includes('published')
    ) {
      return 'success';
    }
    if (
      text.includes('warnung') || 
      text.includes('warning') || 
      text.includes('achtung') ||
      text.includes('überschreitet') ||
      text.includes('warten')
    ) {
      return 'warning';
    }
    return 'default';
  };

  const showAlert = (message: string, title?: string, confirmText?: string, variant?: ModalVariant): Promise<void> => {
    const detectedVariant = variant || inferVariant(message, title);
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: 'alert',
        variant: detectedVariant,
        title: title || getLocalizedDefaultTitle('alert', detectedVariant),
        message,
        confirmText: confirmText || getLocalizedDefaultConfirm('alert', detectedVariant),
        resolve: () => {
          resolve();
        },
      });
    });
  };

  const showConfirm = (
    message: string, 
    title?: string, 
    confirmText?: string, 
    cancelText?: string, 
    variant?: ModalVariant
  ): Promise<boolean> => {
    const detectedVariant = variant || inferVariant(message, title);
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: 'confirm',
        variant: detectedVariant,
        title: title || getLocalizedDefaultTitle('confirm', detectedVariant),
        message,
        confirmText: confirmText || getLocalizedDefaultConfirm('confirm', detectedVariant),
        cancelText: cancelText || getLocalizedDefaultCancel(),
        resolve: (val: boolean) => {
          resolve(val);
        },
      });
    });
  };

  const showCustomModal = (options: ModalOptions): Promise<boolean> => {
    const modalType = options.type || 'alert';
    const detectedVariant = options.variant || inferVariant(options.message, options.title);
    return new Promise((resolve) => {
      setModal({
        isOpen: true,
        type: modalType,
        variant: detectedVariant,
        title: options.title || getLocalizedDefaultTitle(modalType, detectedVariant),
        message: options.message,
        confirmText: options.confirmText || getLocalizedDefaultConfirm(modalType, detectedVariant),
        cancelText: options.cancelText || getLocalizedDefaultCancel(),
        icon: options.icon,
        resolve: (val: boolean) => {
          resolve(val);
        },
      });
    });
  };

  const handleClose = (value: boolean) => {
    if (modal.resolve) {
      modal.resolve(value);
    }
    setModal(prev => ({
      ...prev,
      isOpen: false,
    }));
  };

  // Keyboard accessibility
  useEffect(() => {
    if (!modal.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        handleClose(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modal.isOpen, modal.resolve]);

  const renderIcon = () => {
    if (modal.icon) return modal.icon;
    const v = modal.variant;
    if (v === 'danger') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-red-500/10 dark:bg-red-500/20 text-red-500 flex items-center justify-center shrink-0">
          <Trash2 className="w-6 h-6" />
        </div>
      );
    }
    if (v === 'warning') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-6 h-6" />
        </div>
      );
    }
    if (v === 'success') {
      return (
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-6 h-6" />
        </div>
      );
    }
    return (
      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 dark:bg-orange-500/20 text-orange-500 flex items-center justify-center shrink-0">
        {modal.type === 'confirm' ? <HelpCircle className="w-6 h-6" /> : <Info className="w-6 h-6" />}
      </div>
    );
  };

  const getConfirmButtonStyles = () => {
    if (modal.variant === 'danger') {
      return 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20 hover:shadow-red-600/30';
    }
    if (modal.variant === 'success') {
      return 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30';
    }
    return 'bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30';
  };

  return (
    <ModalContext.Provider value={{ showAlert, showConfirm, showCustomModal }}>
      {children}
      {modal.isOpen && (
        <div 
          className="fixed inset-0 z-[100000] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => handleClose(false)}
        >
          <div 
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-white dark:bg-[#141414] border border-neutral-200 dark:border-white/10 rounded-[2rem] p-6 sm:p-8 shadow-2xl flex flex-col gap-6 animate-in zoom-in-95 duration-200 text-left relative overflow-hidden"
          >
            {/* Close X in corner */}
            <button
              onClick={() => handleClose(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-neutral-400 hover:text-neutral-700 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Schließen"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header with Icon and Title */}
            <div className="flex items-start gap-4 pr-6">
              {renderIcon()}
              <div className="flex flex-col">
                <h3 className="text-xl font-black tracking-tight text-neutral-900 dark:text-white">
                  {modal.title}
                </h3>
              </div>
            </div>

            {/* Message Body */}
            <div className="text-sm sm:text-base text-neutral-600 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
              {modal.message}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              {modal.type === 'confirm' && (
                <button
                  onClick={() => handleClose(false)}
                  className="px-5 py-2.5 text-sm font-bold rounded-full bg-neutral-100 dark:bg-white/10 hover:bg-neutral-200 dark:hover:bg-white/15 text-neutral-700 dark:text-neutral-200 transition-all active:scale-95 cursor-pointer"
                >
                  {modal.cancelText}
                </button>
              )}
              <button
                onClick={() => handleClose(true)}
                className={`px-6 py-2.5 text-sm font-bold rounded-full active:scale-95 transition-all cursor-pointer ${getConfirmButtonStyles()}`}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useCustomModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useCustomModal must be used within a ModalProvider');
  return context;
}

export const useModal = useCustomModal;

