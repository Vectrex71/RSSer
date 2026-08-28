
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Loader2, Zap, Star, ShieldCheck } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { auth } from '../../lib/firebase';
import { useNavigate } from 'react-router-dom';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PricingModal({ isOpen, onClose }: PricingModalProps) {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [checkoutLoading, setCheckoutLoading] = React.useState<string | null>(null);
  const isDark = settings.theme === 'dark';
  const language = settings.language;

  const handleCheckout = async (planType: string) => {
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }

    if (planType === "Kostenlos" || planType === "Free") {
      onClose();
      return;
    }

    let priceId = '';
    const env = (import.meta as any).env;
    if (planType === "Monatlich" || planType === "Monthly") {
      priceId = env.VITE_STRIPE_MONTHLY_PRICE_ID || env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID;
    } else if (planType === "Jährlich" || planType === "Yearly") {
      priceId = env.VITE_STRIPE_YEARLY_PRICE_ID || env.NEXT_PUBLIC_STRIPE_YEARLY_PRICE_ID;
    }

    setCheckoutLoading(planType);
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId,
          planType,
          userId: auth.currentUser.uid,
          email: auth.currentUser.email
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error(error);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getFeatures = (isYearly: boolean) => {
    const list = [
      t('pricing-feature-rss'),
      t('pricing-feature-radio'),
      t('pricing-feature-podcasts'),
      t('pricing-feature-youtube'),
      t('pricing-feature-webcams'),
      t('pricing-feature-blogs'),
      t('pricing-feature-write'),
      t('pricing-feature-support'),
      t('pricing-feature-requests'),
      ...(isYearly ? [t('pricing-feature-2-months-free')] : [])
    ];
    return list;
  };

  const plans = [
    { 
      plan: t('plan-monthly'), 
      price: "5.90$", 
      features: getFeatures(false), 
      recommended: false
    },
    { 
      plan: t('plan-yearly'), 
      price: "59$", 
      features: getFeatures(true), 
      recommended: true
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
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
          className={`relative w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col ${isDark ? 'bg-[#0f0f0f] border border-white/10' : 'bg-white border border-gray-200'}`}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-8 pb-4 text-center">
            <button 
              onClick={onClose}
              className={`absolute top-6 right-6 p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            >
              <X className="w-6 h-6" />
            </button>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-500/10 text-orange-500 rounded-full text-[10px] font-black tracking-widest uppercase mb-4">
              <Zap className="w-3 h-3 fill-current" />
              <span>{t('go-pro')}</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tighter mb-2 italic">
              {t('pricing-title')}
            </h2>
            <p className="opacity-60 max-w-md mx-auto text-sm font-medium">
              {t('pricing-desc')}
            </p>
          </div>

          {/* Plans */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {plans.map((p, i) => (
              <div 
                key={i} 
                className={`relative p-8 rounded-3xl border-2 transition-all duration-300 flex flex-col ${
                  p.recommended 
                    ? 'border-orange-500 bg-orange-500/[0.02]' 
                    : isDark ? 'border-white/5 bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'
                }`}
              >
                {p.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-500 text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg">
                    {t('best-value')}
                  </div>
                )}

                <div className="mb-6">
                  <h3 className="text-xl font-black mb-1">{p.plan}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-orange-500">{p.price}</span>
                    <span className="text-sm font-bold opacity-40 uppercase tracking-widest">
                      / {p.plan === t('plan-monthly') ? t('month') : t('year')}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {p.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-orange-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-orange-500 stroke-[4]" />
                      </div>
                      <span className="text-sm font-bold opacity-70 leading-tight">{feat}</span>
                    </li>
                  ))}
                </ul>

                <button 
                  onClick={() => handleCheckout(p.plan)}
                  disabled={checkoutLoading === p.plan}
                  className={`w-full py-4 px-6 rounded-2xl text-sm font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                    p.recommended 
                      ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/20 hover:bg-orange-600 scale-[1.02] hover:scale-[1.05] active:scale-95' 
                      : isDark ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-neutral-800'
                  } disabled:opacity-50 disabled:scale-100`}
                >
                  {checkoutLoading === p.plan ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                    <>
                      <span>{t('choose-plan') || t('register')}</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>

          <div className="p-8 pt-0 text-center">
            <p className="text-[10px] font-bold opacity-30 uppercase tracking-[0.2em]">
              {t('secure-stripe')}
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
