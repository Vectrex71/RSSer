import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2, CheckCircle2 } from 'lucide-react';
import { auth, db } from '../../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from '../../hooks/useTranslation';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'support' | 'wishes';
}

export function ContactModal({ isOpen, onClose, type }: ContactModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(auth.currentUser?.email || '');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && !email && auth.currentUser?.email) {
      setEmail(auth.currentUser.email);
    }
  }, [isOpen, auth.currentUser?.email]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !email.trim()) return;

    setLoading(true);
    try {
      // 1. Save to Firestore for admin history
      try {
        await addDoc(collection(db, 'messages'), {
          userId: auth.currentUser?.uid || 'anonymous',
          userEmail: email.trim(),
          type,
          message: message.trim(),
          createdAt: serverTimestamp(),
          status: 'new'
        });
      } catch (dbErr) {
        console.warn("Could not save to messages collection:", dbErr);
      }

      // 2. Call server API to send actual email
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: email.trim(),
            type,
            message: message.trim()
          }),
        });
      } catch (apiErr) {
        console.warn("Contact API error:", apiErr);
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setMessage('');
        onClose();
      }, 2000);
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    return type === 'support' ? (t('support') || 'Support') : (t('wishes') || 'Wünsche');
  };

  const getPlaceholder = () => {
    if (type === 'support') {
      return t('placeholder-support') || 'Wie können wir dir helfen?';
    }
    return t('placeholder-wishes') || 'Was für ein Feature wünschst du dir?';
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
            className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-[2rem] overflow-hidden shadow-2xl border border-white/10"
          >
            <div className="absolute top-6 right-6 z-10">
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          <div className="p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <Send className="w-6 h-6 text-orange-500" />
              </div>
              <h2 className="text-3xl font-black uppercase tracking-tight dark:text-white">
                {getTitle()}
              </h2>
            </div>

            {success ? (
              <div className="py-12 flex flex-col items-center text-center">
                <motion.div 
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-6"
                >
                  <CheckCircle2 className="w-12 h-12 text-green-500" />
                </motion.div>
                <h3 className="text-2xl font-bold mb-2 dark:text-white">
                  {t('sent-success-title') || 'Gesendet!'}
                </h3>
                <p className="text-gray-500">
                  {t('sent-success-desc') || 'Vielen Dank für deine Nachricht. Wir melden uns in Kürze.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    {t('your-email') || 'Deine E-Mail'}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-all"
                    placeholder="name@example.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold uppercase tracking-wider text-gray-500 mb-2 ml-1">
                    {t('your-message') || 'Deine Nachricht'}
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    rows={5}
                    className="w-full px-5 py-4 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-black/20 focus:outline-none focus:ring-2 focus:ring-orange-500 dark:text-white transition-all resize-none"
                    placeholder={getPlaceholder()}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !message.trim()}
                  className="w-full py-5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-orange-500/20"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      <span>{t('send-message') || 'Nachricht Senden'}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  </AnimatePresence>
  );
}
