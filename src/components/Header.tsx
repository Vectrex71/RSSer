import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { tr } from '../lib/t';
import { Sun, Moon, Menu, X, User, Settings, LogOut } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { useTranslation } from '../hooks/useTranslation';

export function Header() {
  const { settings, toggleTheme, setLanguage } = useSettings();
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    try {
      localStorage.removeItem('rsser_logged_in');
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        localStorage.setItem('rsser_logged_in', 'true');
        try {
          const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
          if (userDoc.exists()) {
            setAvatarUrl(userDoc.data().avatarUrl);
          }
        } catch (error) {
          console.error("Failed to load user profile:", error);
        }
      } else {
        localStorage.removeItem('rsser_logged_in');
        setAvatarUrl(null);
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <header className="fixed top-0 left-0 w-full z-50 px-6 py-4 flex items-center justify-between bg-black/40 backdrop-blur-md">
      <Link to="/" className="flex items-center gap-2">
        <img src="/RSSerLogo.png" alt="RSSer Logo" className="w-8 h-8 rounded-lg" />
        <div className="flex flex-col">
          <span className="text-xl font-bold text-white">RSSer</span>
        </div>
      </Link>
      
      {/* Desktop Navigation */}
      <nav className="hidden md:flex items-center gap-6 text-white font-bold text-sm">
        <div className="flex items-center gap-2 mr-4">
          <button onClick={() => setLanguage('de')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'de' ? '' : 'opacity-50 grayscale'}`}>
            🇩🇪
          </button>
          <button onClick={() => setLanguage('en')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'en' ? '' : 'opacity-50 grayscale'}`}>
            🇬🇧
          </button>
          <button onClick={() => setLanguage('fr')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'fr' ? '' : 'opacity-50 grayscale'}`}>
            🇫🇷
          </button>
          <button onClick={() => setLanguage('es')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'es' ? '' : 'opacity-50 grayscale'}`}>
            🇪🇸
          </button>
        </div>
        <button onClick={toggleTheme} className="hover:text-[var(--brand-orange)]">
          {settings.theme === 'light' ? <Moon className="w-5 h-5 text-white" /> : <Sun className="w-5 h-5 text-white" />}
        </button>
        
        {user ? (
          <button 
            onClick={async () => {
              const settingsSnap = await getDoc(doc(db, 'users', user.uid, 'settings', 'userConfig'));
              const startPage = settingsSnap.exists() ? settingsSnap.data().startPage || '/discover' : '/discover';
              navigate(startPage);
            }}
            className="bg-black text-white dark:bg-white dark:text-black px-8 py-3 rounded-full font-black text-sm tracking-widest hover:scale-105 transition-transform"
          >
            DASHBOARD
          </button>
        ) : (
          <button 
            onClick={() => navigate('/login')}
            className="bg-[#f89440] text-white px-8 py-3 rounded-full hover:bg-[#e67e22] transition-all font-black text-xs tracking-[0.2em] hover:scale-105 active:scale-95"
          >
            {tr(settings.language, "START FOR FREE", "STARTE KOSTENLOS")}
          </button>
        )}
      </nav>

      {/* Mobile Menu Button */}
      <div className="md:hidden flex items-center gap-4">
        <div className="flex items-center gap-2 mr-2">
          <button onClick={() => setLanguage('de')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'de' ? '' : 'opacity-50 grayscale'}`}>
            🇩🇪
          </button>
          <button onClick={() => setLanguage('en')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'en' ? '' : 'opacity-50 grayscale'}`}>
            🇬🇧
          </button>
          <button onClick={() => setLanguage('fr')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'fr' ? '' : 'opacity-50 grayscale'}`}>
            🇫🇷
          </button>
          <button onClick={() => setLanguage('es')} className={`hover:opacity-80 transition-opacity text-xl ${settings.language === 'es' ? '' : 'opacity-50 grayscale'}`}>
            🇪🇸
          </button>
        </div>
        <button onClick={toggleTheme} className="text-white">
          {settings.theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white">
          {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="absolute top-full left-0 w-full bg-black/80 backdrop-blur-md p-6 flex flex-col items-center gap-6 text-white font-bold text-sm md:hidden z-50">
          <button onClick={() => { setIsMenuOpen(false); navigate('/login'); }} className="bg-[var(--brand-orange)] text-white px-4 py-2 rounded-full hover:bg-orange-600 transition-colors">
             {tr(settings.language, "START FOR FREE", "STARTE KOSTENLOS")}
          </button>
        </div>
      )}
    </header>
  );
}
