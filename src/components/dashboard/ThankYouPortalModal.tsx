
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, Shield, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';

interface ThankYouPortalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  loading?: boolean;
}

export function ThankYouPortalModal({ isOpen, onClose, onProceed, loading }: ThankYouPortalModalProps) {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className={`relative w-full max-w-lg overflow-hidden rounded-3xl shadow-2xl ${
              isDark ? 'bg-[#1a1a1a] border border-white/10' : 'bg-white border border-gray-200'
            }`}
          >
            {/* Diagonal Ribbon */}
            <div className="absolute top-0 right-0 overflow-hidden w-48 h-48 pointer-events-none z-10">
              <div className="absolute top-10 -right-14 w-64 bg-green-500 py-2 transform rotate-45 flex items-center justify-center shadow-lg">
                <span className="text-white text-[10px] font-black uppercase tracking-widest px-8 text-center leading-tight">
                  {t('thank-you-ribbon')}
                </span>
              </div>
            </div>

            <div className="p-8 sm:p-12 text-center relative z-0">
               <button 
                 onClick={onClose}
                 className={`absolute top-4 left-4 p-2 rounded-full transition-colors ${
                   isDark ? 'hover:bg-white/10 text-white/40' : 'hover:bg-black/5 text-gray-400'
                 }`}
               >
                 <X className="w-5 h-5" />
               </button>

               <div className="mb-6 flex justify-center">
                  <div className="h-20 w-20 rounded-2xl bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <Heart className="w-10 h-10 fill-current" />
                  </div>
               </div>

               <h2 
                 className={`text-2xl sm:text-3xl font-black tracking-tighter mb-6 leading-tight ${isDark ? 'text-white' : 'text-black'}`}
                 dangerouslySetInnerHTML={{ __html: t('thank-you-title') }}
               />

               <p className={`text-sm font-medium mb-10 opacity-60 max-w-xs mx-auto leading-relaxed ${isDark ? 'text-white' : 'text-black'}`}>
                  {t('subscription-desc')}
               </p>

               <button
                 onClick={onProceed}
                 disabled={loading}
                 className="w-full py-4 bg-orange-500 text-white font-black rounded-2xl hover:opacity-90 transition-all shadow-xl shadow-orange-500/20 flex items-center justify-center gap-3 active:scale-[0.98]"
               >
                 {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
                 {t('proceed-to-stripe')}
               </button>

               <button 
                 onClick={onClose}
                 className="w-full mt-4 py-3 text-sm font-bold opacity-30 hover:opacity-100 transition-opacity"
               >
                 {t('back')}
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
