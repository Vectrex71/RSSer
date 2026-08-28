
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Zap, ArrowRight, ShieldAlert } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface LimitReachedModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'rss' | 'radio' | 'podcast' | 'youtube' | 'webcam' | 'blogs' | 'blog-write' | 'support' | 'wishes';
  onProceed?: () => void;
}

export function LimitReachedModal({ isOpen, onClose, type, onProceed }: LimitReachedModalProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    window.location.hash = 'pricing';
    window.location.href = '/#pricing';
  };

  const isSoftNotice = type === 'support' || type === 'wishes';

  const handleSecondaryAction = () => {
    if (isSoftNotice && onProceed) {
      onProceed();
    } else {
      onClose();
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'blog-write': return t('limit-blog-write-title') || 'Eigenen Blog schreiben';
      case 'support': return t('limit-support-title') || 'Support';
      case 'wishes': return t('limit-wishes-title') || 'Funktionen wünschen';
      default: return t('limit-reached-title') || 'Limit erreicht';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'blog-write': return t('limit-blog-write-desc') || 'Das Schreiben von eigenen Blog-Artikeln ist ein Premium-Feature.';
      case 'support': return t('limit-support-desc') || 'Support für alle verfügbar – Pro-Nutzer werden jedoch bevorzugt behandelt.';
      case 'wishes': return t('limit-wishes-desc') || 'Funktionswünsche für alle – Pro-Nutzer Einreichungen haben jedoch Vorrang.';
      case 'rss': return t('limit-rss-desc') || 'Du hast das Limit für RSS-Feeds in deinem kostenlosen Account erreicht (3/3).';
      case 'radio': return t('limit-radio-desc') || 'Du hast das Limit für Radio-Stationen in deinem kostenlosen Account erreicht (1/1).';
      case 'podcast': return t('limit-podcast-desc') || 'Du hast das Limit für Podcasts in deinem kostenlosen Account erreicht (1/1).';
      case 'youtube': return t('limit-youtube-desc') || 'Du hast das Limit für YouTube-Kanäle in deinem kostenlosen Account erreicht (1/1).';
      case 'webcam': return t('limit-webcam-desc') || 'Du hast das Limit für Webcams in deinem kostenlosen Account erreicht (1/1).';
      case 'blogs': return t('limit-blogs-desc') || 'Du hast das Limit für Blog-Abonnements in deinem kostenlosen Account erreicht (1/1).';
      default: return '';
    }
  };

  const getSecondaryButtonText = () => {
    if (type === 'support') {
      return t('continue-to-support') || 'Vielleicht später – Weiter zum Support';
    }
    if (type === 'wishes') {
      return t('continue-to-wishes') || 'Vielleicht später – Weiter zu Wünsche';
    }
    return t('maybe-later') || 'Vielleicht später';
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] overflow-y-auto bg-black/60 backdrop-blur-sm">
        <div className="min-h-full flex items-center justify-center p-4" onClick={onClose}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
          >
            <div className="absolute top-4 right-4 z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-8 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6">
              <ShieldAlert className="w-10 h-10 text-orange-500" />
            </div>

            <h2 className="text-2xl font-black mb-3 dark:text-white uppercase tracking-tight">
              {getTitle()}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 font-medium leading-relaxed">
              {getDescription()}
              <br />
              <span className="text-sm opacity-70 mt-2 block italic text-orange-500">
                {t('limit-upgrade-hint') || 'Upgrade jetzt auf Monthly oder Yearly für unlimitierte Freiheit!'}
              </span>
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={handleUpgrade}
                className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 group shadow-lg shadow-orange-500/20"
              >
                <Zap className="w-5 h-5 fill-white" />
                <span>{t('upgrade-now') || 'Jetzt Upgraden'}</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
              <button
                onClick={handleSecondaryAction}
                className="w-full py-4 bg-gray-100 dark:bg-neutral-800 text-gray-900 dark:text-white rounded-2xl font-bold transition-all hover:bg-gray-200 dark:hover:bg-neutral-700 active:scale-95"
              >
                {getSecondaryButtonText()}
              </button>
            </div>
          </div>
          
          <div className="bg-orange-500/5 dark:bg-orange-500/10 p-4 text-center border-t border-white/5">
            <p className="text-[10px] font-black tracking-widest text-orange-600 dark:text-orange-400 uppercase">
              {t('limit-support-footer') || 'Free Support for everyone - Unlimited with Pro'}
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  </AnimatePresence>
  );
}

