import * as React from 'react';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useTranslation } from '../hooks/useTranslation';
import { useSettings } from '../context/SettingsContext';
import { AmbientWave } from './layout/AmbientWave';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { t } = useTranslation();
  const { settings, setLanguage } = useSettings();
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate(settings.startPage || '/rss-feeds');
      }
    });
    return () => unsubscribe();
  }, [navigate, settings.startPage]);

  const handleResetPassword = async () => {
    if (!email) {
      setError(t('please-enter-email'));
      return;
    }
    if (isResetting) return;
    try {
      setIsResetting(true);
      setError('');
      setResetMessage('');
      await sendPasswordResetEmail(auth, email);
      setResetMessage(t('password-reset-success'));
      
      // Cooldown to prevent spamming which invalidates older links
      setTimeout(() => {
        setIsResetting(false);
      }, 60000); // 60 seconds cooldown
    } catch (err: any) {
      setIsResetting(false);
      console.error(err);
      if (err.code === 'auth/user-not-found') {
        setError(t('auth-error-user-not-found'));
      } else if (err.code === 'auth/invalid-email') {
        setError(t('auth-error-invalid-email'));
      } else if (err.code === 'auth/too-many-requests') {
        setError(t('auth-error-too-many-requests'));
      } else {
        setError(t('auth-error-default'));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isRegister) {
        await createUserWithEmailAndPassword(auth, email, password);
        try {
          sessionStorage.setItem('start-onboarding-tour-pending', 'true');
          localStorage.removeItem('rsser-tour-seen');
        } catch (e) {}
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      localStorage.setItem('rsser_logged_in', 'true');
      navigate(settings.startPage || '/rss-feeds');
    } catch (err: any) {
      console.error("Email Auth Error:", err);
      let errorMessage = err.message;
      if (err.code === 'auth/invalid-credential') errorMessage = t('auth-error-invalid-credential');
      else if (err.code === 'auth/user-not-found') errorMessage = t('auth-error-user-not-found-register');
      else if (err.code === 'auth/wrong-password') errorMessage = t('auth-error-wrong-password');
      else if (err.code === 'auth/email-already-in-use') errorMessage = t('auth-error-email-already-in-use');
      else if (err.code === 'auth/weak-password') errorMessage = t('auth-error-weak-password');
      else if (err.code === 'auth/invalid-email') errorMessage = t('auth-error-invalid-email');
      else if (err.code?.includes('requests-from-referer') || err.message?.includes('requests-from-referer')) errorMessage = t('auth-error-referer-blocked');
      
      setError((isRegister ? t('registration') : t('login')) + ' ' + t('failed') + ': ' + errorMessage);
    }
  };

  return (
    <div className="flex-1 bg-white dark:bg-[#0a0a0a] transition-colors duration-300 relative min-h-screen p-6 flex flex-col items-center justify-center overflow-hidden">
      <AmbientWave className="fixed inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-1000" />
      
      <div className="relative z-10 max-w-md w-full p-8 bg-white/70 dark:bg-[#0f172a]/70 rounded-3xl border border-gray-200/80 dark:border-gray-800/80 shadow-xl backdrop-blur-md text-gray-900 dark:text-white transition-colors duration-300">
        
        {/* Language Selector inside Login Card */}
        <div className="absolute top-4 right-4 flex items-center gap-1.5 z-20">
          <button onClick={() => setLanguage('de')} className={`hover:opacity-80 transition-opacity text-base sm:text-lg ${settings.language === 'de' ? '' : 'opacity-40 grayscale'}`}>
            🇩🇪
          </button>
          <button onClick={() => setLanguage('en')} className={`hover:opacity-80 transition-opacity text-base sm:text-lg ${settings.language === 'en' ? '' : 'opacity-40 grayscale'}`}>
            🇬🇧
          </button>
          <button onClick={() => setLanguage('fr')} className={`hover:opacity-80 transition-opacity text-base sm:text-lg ${settings.language === 'fr' ? '' : 'opacity-40 grayscale'}`}>
            🇫🇷
          </button>
          <button onClick={() => setLanguage('es')} className={`hover:opacity-80 transition-opacity text-base sm:text-lg ${settings.language === 'es' ? '' : 'opacity-40 grayscale'}`}>
            🇪🇸
          </button>
        </div>

        <div className="flex flex-col items-center justify-center mb-6">
          <Link to="/">
            <img src="/RSSerLogo.png" alt="RSSer Logo" className="w-16 h-16 rounded-2xl object-contain hover:scale-105 transition-transform shadow-md mb-2" style={{ imageRendering: '-webkit-optimize-contrast' }} />
          </Link>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--brand-orange)]">RSSer</span>
        </div>

        <h2 className="text-2xl font-bold mb-6 text-center">{isRegister ? t('registration') : t('login')}</h2>
        {error && <p className="text-red-400 mb-4 text-sm whitespace-pre-wrap">{error}</p>}
        {resetMessage && <p className="text-green-500 mb-4 text-sm whitespace-pre-wrap">{resetMessage}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('email')}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-950/60"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('password')}
            className="w-full p-3 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-white dark:bg-gray-950/60"
            required
          />
          <button type="submit" className="w-full p-3 bg-[var(--brand-orange)] hover:bg-orange-600 transition-colors text-white rounded-lg font-bold">
            {isRegister ? t('register') : t('sign-in')}
          </button>
        </form>
        
        {!isRegister && (
          <div className="mt-4 text-center">
            <button 
              type="button" 
              onClick={handleResetPassword}
              disabled={isResetting}
              className={`text-sm transition-colors ${isResetting ? 'text-gray-400 cursor-not-allowed' : 'text-gray-500 hover:text-orange-500'}`}
            >
              {isResetting ? t('sending') : t('forgot-password')}
            </button>
          </div>
        )}

        <p className="mt-4 text-center text-sm text-gray-600 dark:text-gray-300">
          {isRegister ? t('already-have-account') : t('no-account')}
          <button onClick={() => setIsRegister(!isRegister)} className="ml-1 text-[var(--brand-orange)] font-bold hover:underline">
            {isRegister ? t('here-sign-in') : t('here-register')}
          </button>
        </p>

        <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800/50 text-center">
          <Link to="/" className="inline-block bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-6 py-2.5 rounded-full transition-colors">
            {t('back-to-home')}
          </Link>
        </div>
      </div>
    </div>
  );
}
