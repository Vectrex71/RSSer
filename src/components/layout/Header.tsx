import { Search, Settings, Sun, Moon, User, Menu, Play, Pause, FastForward, Rewind, LayoutGrid, LayoutTemplate, List, Tv, LogOut, Rss, Podcast, Radio, Youtube, Camera, FileText, Bookmark, PenTool, MessageSquare, Heart, Shield, Loader2, Zap, Megaphone } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { tr } from '../../lib/t';
import { useState, useEffect, useRef } from 'react';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { usePlan } from '../../hooks/usePlan';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { LimitReachedModal } from '../dashboard/LimitReachedModal';
import { ContactModal } from '../dashboard/ContactModal';
import { ThankYouPortalModal } from '../dashboard/ThankYouPortalModal';

export function Header() {
  const { settings, toggleTheme, setViewMode, toggleSidebar, searchQuery, setSearchQuery, setPricingModalOpen, setQuotaExceeded, showHeader1 } = useSettings();
  const { plan } = usePlan();
  const [limitModal, setLimitModal] = useState<{isOpen: boolean, type: any}>({ isOpen: false, type: 'rss' });
  const [contactModal, setContactModal] = useState<{isOpen: boolean, type: 'support' | 'wishes'}>({ isOpen: false, type: 'support' });
  const [portalLoading, setPortalLoading] = useState(false);
  const [isThankYouModalOpen, setIsThankYouModalOpen] = useState(false);
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useKeyboardShortcuts({
    onToggleTheme: toggleTheme,
    onSetViewGrid: () => setViewMode('grid'),
    onSetViewList: () => setViewMode('list'),
    onSetViewMagazine: () => {
      if (location.pathname === '/rss-feeds') {
        setViewMode('magazine');
      }
    },
    onCloseModal: () => {
      setIsDropdownOpen(false);
    }
  });

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
    localStorage.removeItem('rsser_logged_in');
    if (!auth.currentUser) {
      navigate('/login');
      return; 
    }
    try {
      await signOut(auth);
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const handleManageSubscription = async () => {
    setIsDropdownOpen(false);
    if (plan === 'FREE') {
      setPricingModalOpen(true);
      return;
    }
    setIsThankYouModalOpen(true);
  };

  const handleProceedToPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPricingModalOpen(true);
        setIsThankYouModalOpen(false);
      }
    } catch (error) {
      console.error(error);
      setPricingModalOpen(true);
      setIsThankYouModalOpen(false);
    } finally {
      setPortalLoading(false);
    }
  };

  const isTimeline = location.pathname === '/rss-feeds' && settings.viewMode === 'screensaver';
  const [autoScroll, setAutoScroll] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(0.5);

  const accumulatedScroll = useRef(0);

  useEffect(() => {
    if (!autoScroll) return;
    
    let animationFrameId: number;

    const scroll = () => {
      const container = document.getElementById('main-scroll-container');
      if (container) {
        accumulatedScroll.current += scrollSpeed;
        if (accumulatedScroll.current >= 1) {
          const amount = Math.floor(accumulatedScroll.current);
          container.scrollTop -= amount;
          accumulatedScroll.current -= amount;
        }
      }
      animationFrameId = requestAnimationFrame(scroll);
    };

    animationFrameId = requestAnimationFrame(scroll);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [autoScroll, scrollSpeed]);

  useEffect(() => {
    if (!isTimeline) {
      setAutoScroll(false);
      setScrollSpeed(0.5);
    }
  }, [isTimeline]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem('rsser_logged_in', 'true');
        const userRef = doc(db, 'users', user.uid);
        const unsubscribeDoc = onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists() && docSnap.data().avatarUrl) {
            setAvatarUrl(docSnap.data().avatarUrl);
          } else if (user.photoURL) {
            setAvatarUrl(user.photoURL);
          } else {
            setAvatarUrl(null);
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
        });
        return () => unsubscribeDoc();
      } else {
        localStorage.removeItem('rsser_logged_in');
        setAvatarUrl(null);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  let pageTitle = t('discover') || 'Organisieren';
  if (location.pathname === '/settings') pageTitle = t('settings') || 'Einstellungen';
  else if (location.pathname === '/profile') pageTitle = t('profile') || 'Profil';
  else if (location.pathname === '/timeline') pageTitle = t('timeline') || 'Timeline';
  else if (location.pathname.startsWith('/admin')) pageTitle = t('admin') || 'Admin Bereich';
  else if (location.pathname === '/rss-feeds') pageTitle = t('rss-feeds') || 'RSS';
  else if (location.pathname === '/podcasts') pageTitle = t('podcasts') || 'Podcasts';
  else if (location.pathname === '/youtube') pageTitle = t('youtube') || 'YouTube';
  else if (location.pathname === '/radio') pageTitle = t('radio') || 'Radio';
  else if (location.pathname === '/webcam') pageTitle = t('webcam') || 'Webcams';
  else if (location.pathname.startsWith('/blogs')) pageTitle = t('blogs') || 'Blogs';
  else if (location.pathname.startsWith('/discover')) pageTitle = t('discover') || 'Organisieren';
  // You can add more paths here if needed
  
  const isArticleView = location.pathname.includes('/article/') || (location.pathname.startsWith('/blog/') && !location.pathname.startsWith('/blogs')) || location.pathname.includes('/p/');
  const showViewMode = !['/', '/timeline', '/settings', '/admin', '/youtube', '/podcasts', '/radio', '/webcam', '/blogs', '/blogs/my', '/blogs/write', '/blogs/subscribed'].includes(location.pathname) && !location.pathname.startsWith('/discover') && !location.pathname.startsWith('/admin') && !isArticleView && !location.pathname.startsWith('/blogs/author');
  const isDiscover = location.pathname.startsWith('/discover');
  const isAdmin = location.pathname.startsWith('/admin');
  const isBlogs = location.pathname.startsWith('/blogs') && !location.pathname.startsWith('/blogs/author') && !location.pathname.includes('/p/') && !location.pathname.includes('/article/') && !location.pathname.includes('/user/');
  const isSettings = location.pathname.startsWith('/settings');
  const isProfile = location.pathname === '/profile';

  useEffect(() => {
    document.title = pageTitle === 'Organisieren' || pageTitle === 'Organize' || pageTitle === 'Entdecken' || pageTitle === 'Discover' ? 'RSSer News' : `${pageTitle} | RSSer News`;
  }, [pageTitle]);

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-6 py-3 rounded-full z-[9999] font-medium text-sm transition-opacity duration-300 shadow-2xl';
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => {
       el.style.opacity = '0';
       setTimeout(() => el.remove(), 300);
    }, 3000);
  };

  const isDiscoverOrAdmin = isDiscover || isAdmin;
  const basePath = isDiscover ? '/discover' : '/admin';

  let searchPlaceholder = t('search') || 'Suchen...';
  let searchColorClassDark = 'bg-white/5 border-white/10 text-white focus:border-orange-500/50';
  let searchColorClassLight = 'bg-gray-50 border-gray-200 text-gray-900 focus:border-orange-500/50';

  if (location.pathname.includes('/podcasts')) {
    searchPlaceholder = t('search-podcasts') || 'Podcasts suchen...';
    searchColorClassDark = 'bg-purple-500/5 border-purple-500/20 text-white focus:bg-purple-500/10 focus:border-purple-500/50';
    searchColorClassLight = 'bg-purple-50 border-purple-200 focus:bg-purple-100 text-gray-900 focus:border-purple-500/50';
  } else if (location.pathname.includes('/radio')) {
    searchPlaceholder = t('search-radio') || 'Radio suchen...';
    searchColorClassDark = 'bg-blue-500/5 border-blue-500/20 text-white focus:bg-blue-500/10 focus:border-blue-500/50';
    searchColorClassLight = 'bg-blue-50 border-blue-200 focus:bg-blue-100 text-gray-900 focus:border-blue-500/50';
  } else if (location.pathname.includes('/youtube')) {
    searchPlaceholder = t('search-youtube') || 'YouTube Kanal suchen...';
    searchColorClassDark = 'bg-red-500/5 border-red-500/20 text-white focus:bg-red-500/10 focus:border-red-500/50';
    searchColorClassLight = 'bg-red-50 border-red-200 focus:bg-red-100 text-gray-900 focus:border-red-500/50';
  } else if (location.pathname.includes('/webcam')) {
    searchPlaceholder = t('search-webcams') || 'Webcams suchen...';
    searchColorClassDark = 'bg-emerald-500/5 border-emerald-500/20 text-white focus:bg-emerald-500/10 focus:border-emerald-500/50';
    searchColorClassLight = 'bg-emerald-50 border-emerald-200 focus:bg-emerald-100 text-gray-900 focus:border-emerald-500/50';
  } else if (location.pathname.includes('/blogs')) {
    searchPlaceholder = t('search-blogs') || 'Blogs suchen...';
    searchColorClassDark = 'bg-yellow-500/5 border-yellow-500/20 text-white focus:bg-yellow-500/10 focus:border-yellow-500/50';
    searchColorClassLight = 'bg-yellow-50 border-yellow-200 focus:bg-yellow-100 text-gray-900 focus:border-yellow-500/50';
  } else {
    searchPlaceholder = t('search-feeds') || 'Feeds suchen...';
    searchColorClassDark = 'bg-orange-500/5 border-orange-500/20 text-white focus:bg-orange-500/10 focus:border-orange-500/50';
    searchColorClassLight = 'bg-orange-50 border-orange-200 focus:bg-orange-100 text-gray-900 focus:border-orange-500/50';
  }

  return (
    <>
      {settings.isQuotaExceeded && (
        <div className="bg-red-500 text-white text-[10px] py-1 px-4 text-center font-bold uppercase tracking-widest relative z-[101] flex items-center justify-center gap-4">
          <span>
            {settings.language === 'de' 
              ? "DATENBANK-QUOTE ÜBERSCHRITTEN - DEINE DATEN SIND SICHER - EINIGE FUNKTIONEN SIND VORÜBERGEHEND EINGESCHRÄNKT"
              : "DATABASE QUOTA EXCEEDED - YOUR DATA IS SAFE - SOME FEATURES MAY BE LIMITED UNTIL RESET"}
          </span>
          <button 
            onClick={() => setQuotaExceeded(false)}
            className="hover:bg-white/20 p-0.5 rounded transition-colors"
            title="Schließen"
          >
            <Menu className="w-3 h-3 rotate-45" />
          </button>
        </div>
      )}
      <header 
        style={{
          marginTop: showHeader1 ? '0px' : '-64px',
          transition: 'margin-top 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          transitionDelay: showHeader1 ? '0ms' : '150ms'
        }}
        className={`h-16 shrink-0 border-b relative z-[100] ${settings.theme === 'dark' ? 'border-white/10 bg-[#0a0a0a]/80' : 'border-gray-200 bg-white/80'} flex items-center justify-between px-4 md:px-8 backdrop-blur-md`}
      >
        <div className="flex items-center gap-4 md:gap-6 pt-1">
        <button 
          id="sidebar-toggle"
          onClick={toggleSidebar}
          className={`p-1.5 rounded-md ${settings.theme === 'dark' ? 'text-white hover:bg-white/10' : 'text-gray-900 hover:bg-gray-100'}`}
        >
          <Menu className="w-5 h-5 md:w-6 md:h-6" />
        </button>
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold hidden sm:block">{pageTitle}</h2>
          {isTimeline && (
            <div className={`hidden md:flex items-center gap-2 ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded-full p-1 pl-2 ml-2`}>
               <button 
                 onClick={() => setAutoScroll(!autoScroll)}
                 className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${autoScroll ? 'bg-orange-500 text-white' : (settings.theme === 'dark' ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-white text-gray-800 hover:bg-gray-50')}`}
               >
                 {autoScroll ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
               </button>
               
               <div className="flex items-center gap-0.5 px-1 pb-0.5">
                  <button 
                     onClick={() => setScrollSpeed(Math.max(0.1, scrollSpeed - 0.2))}
                     className={`p-1 rounded-full transition-colors ${settings.theme === 'dark' ? 'hover:bg-white/10 text-white/70' : 'hover:bg-white text-gray-600'}`}
                  >
                     <Rewind className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-6 flex items-center justify-center">
                     <span className="text-[10px] font-mono opacity-80 mt-0.5">{(scrollSpeed * 10).toFixed(0)}x</span>
                  </div>
                  <button 
                     onClick={() => setScrollSpeed(Math.min(3, scrollSpeed + 0.2))}
                     className={`p-1 rounded-full transition-colors ${settings.theme === 'dark' ? 'hover:bg-white/10 text-white/70' : 'hover:bg-white text-gray-600'}`}
                  >
                     <FastForward className="w-3.5 h-3.5" />
                  </button>
               </div>
            </div>
          )}
        </div>
        {showViewMode && (
          <div className={`flex ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded-lg p-1`}>
            <button onClick={() => setViewMode('grid')} title={t('grid') || 'Grid'} className={`px-1.5 md:px-2 py-1 transition-colors ${settings.viewMode === 'grid' ? (settings.theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white text-gray-900') : (settings.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-900')} rounded`}><LayoutGrid className="w-4 h-4" /></button>
            {location.pathname === '/rss-feeds' && (
              <button onClick={() => setViewMode('magazine')} title={t('magazine') || 'Magazine'} className={`hidden sm:block px-1.5 md:px-2 py-1 transition-colors ${settings.viewMode === 'magazine' ? (settings.theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white text-gray-900') : (settings.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-900')} rounded`}><LayoutTemplate className="w-4 h-4" /></button>
            )}
            <button onClick={() => setViewMode('list')} title={t('list') || 'List'} className={`px-1.5 md:px-2 py-1 transition-colors ${settings.viewMode === 'list' ? (settings.theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white text-gray-900') : (settings.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-900')} rounded`}><List className="w-4 h-4" /></button>
            {location.pathname === '/rss-feeds' && (
               <button onClick={() => setViewMode('screensaver')} title="Screensaver" className={`px-1.5 md:px-2 py-1 transition-colors ${settings.viewMode === 'screensaver' ? (settings.theme === 'dark' ? 'bg-white/10 text-white' : 'bg-white text-gray-900') : (settings.theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-500 hover:text-gray-900')} rounded`}><Tv className="w-4 h-4" /></button>
            )}
          </div>
        )}
        {isDiscoverOrAdmin && (
          <div className={`flex overflow-x-auto hide-scrollbar ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded-lg p-1 max-w-[50vw] sm:max-w-none`}>
            {(isAdmin ? ['feeds', 'podcasts', 'radio', 'youtube', 'webcams', 'blogs', 'news'] : ['feeds', 'podcasts', 'radio', 'youtube', 'webcams', 'blogs']).map((cat) => {
              const isActive = location.pathname === `${basePath}/${cat}` || (location.pathname === basePath && cat === 'feeds');
              
              let activeLight = 'bg-white text-gray-900';
              let activeDark = 'bg-white/10 text-white';
              
              if (isActive) {
                if (cat === 'feeds') {
                  activeLight = 'bg-orange-100 text-orange-700';
                  activeDark = 'bg-orange-500/20 text-orange-400';
                } else if (cat === 'podcasts') {
                  activeLight = 'bg-purple-100 text-purple-700';
                  activeDark = 'bg-purple-500/20 text-purple-400';
                } else if (cat === 'youtube') {
                  activeLight = 'bg-red-100 text-red-700';
                  activeDark = 'bg-red-500/20 text-red-400';
                } else if (cat === 'radio') {
                  activeLight = 'bg-blue-100 text-blue-700';
                  activeDark = 'bg-blue-500/20 text-blue-400';
                } else if (cat === 'webcams') {
                  activeLight = 'bg-emerald-100 text-emerald-800';
                  activeDark = 'bg-emerald-500/20 text-emerald-400';
                } else if (cat === 'blogs') {
                  activeLight = 'bg-yellow-100 text-yellow-800';
                  activeDark = 'bg-yellow-500/20 text-yellow-400';
                } else if (cat === 'news') {
                  activeLight = 'bg-orange-100 text-orange-700';
                  activeDark = 'bg-orange-500/20 text-orange-400';
                }
              }
              
              const text = cat === 'feeds' ? t('rss-feeds') : cat === 'webcams' ? t('webcam') : cat === 'blogs' ? t('blogs') : cat === 'news' ? 'Admin News' : t(cat) || cat;
              
              return (
              <button 
                key={cat} 
                onClick={() => navigate(`${basePath}/${cat}`)}
                title={text}
                className={`px-2 lg:px-3 py-1 flex items-center justify-center text-xs font-medium capitalize rounded transition-colors ${
                  isActive 
                  ? (settings.theme === 'dark' ? activeDark : activeLight) 
                  : (settings.theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50')
                }`}
              >
                <span className="hidden sm:inline">{text}</span>
                <span className="sm:hidden">
                  {cat === 'feeds' ? <Rss className="w-4 h-4" /> : 
                   cat === 'podcasts' ? <Podcast className="w-4 h-4" /> : 
                   cat === 'youtube' ? <Youtube className="w-4 h-4" /> : 
                   cat === 'radio' ? <Radio className="w-4 h-4" /> : 
                   cat === 'webcams' ? <Camera className="w-4 h-4" /> : 
                   cat === 'news' ? <Megaphone className="w-4 h-4" /> :
                   <FileText className="w-4 h-4" />}
                </span>
              </button>
            )})}
          </div>
        )}
 
        {isBlogs && (
          <div className={`flex overflow-x-auto hide-scrollbar ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'} rounded-lg p-1 max-w-[50vw] sm:max-w-none`}>
            {[
              { id: 'subscribed', name: t('subscribed-blogs') || 'Abonnierte Blogs', path: '/blogs/subscribed', icon: <Bookmark className="w-4 h-4" /> },
              { id: 'my', name: t('my-posts') || 'Meine Beiträge', path: '/blogs/my', icon: <User className="w-4 h-4" /> },
              { id: 'write', name: t('write-post') || 'Schreibe einen Beitrag', path: '/blogs/write', icon: <PenTool className="w-4 h-4" /> }
            ].map((tab) => {
              const isActive = location.pathname.includes(tab.path) || (location.pathname === '/blogs' && tab.id === 'subscribed');
              return (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  title={tab.name}
                  className={`px-3 py-1 flex items-center justify-center text-xs font-medium rounded transition-colors ${
                    isActive 
                      ? (settings.theme === 'dark' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800')
                      : (settings.theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-gray-600 hover:text-gray-900 hover:bg-white/50')
                  }`}
                >
                  <span className="hidden sm:inline">{tab.name}</span>
                  <span className="sm:hidden">{tab.icon}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 md:gap-4 pt-1">
        {!(isAdmin || isSettings || isProfile) && (
          <div id="header-search" className="relative flex items-center">
            <div className="relative hidden md:block">
              <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${settings.theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
              <input 
                type="text" 
                value={searchQuery} 
                onChange={e => setSearchQuery(e.target.value)} 
                placeholder={searchPlaceholder} 
                className={`${settings.theme === 'dark' ? searchColorClassDark : searchColorClassLight} border rounded-full pl-9 pr-8 py-1.5 text-sm w-48 lg:w-64 focus:outline-none transition-colors`} 
              />
              <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none hidden lg:inline-flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10 bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-white/30">
                /
              </kbd>
            </div>
            <button className="md:hidden p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}
        <button 
          id="theme-toggle"
          onClick={toggleTheme}
          className={`w-8 h-8 shrink-0 rounded-full border ${settings.theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'} flex items-center justify-center`}
        >
          {settings.theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        <div className="relative" ref={dropdownRef}>
          <button 
            id="profile-menu"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className={`w-8 h-8 shrink-0 rounded-full border ${settings.theme === 'dark' ? 'border-white/10 hover:bg-white/5' : 'border-gray-200 hover:bg-gray-100'} flex items-center justify-center overflow-hidden`}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </button>
          
          {isDropdownOpen && (
            <div className={`absolute right-0 top-full mt-2 w-56 rounded-2xl border overflow-hidden shadow-2xl z-50 ${settings.theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'}`}>
              <div className="py-2">
                <Link to="/settings" onClick={() => setIsDropdownOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'}`}>
                  <Settings className="w-4 h-4 opacity-70" /> {t('settings') || 'Einstellungen'}
                </Link>
                <Link to="/profile" onClick={() => setIsDropdownOpen(false)} className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'}`}>
                  <User className="w-4 h-4 opacity-70" /> {t('profile') || 'Profil'}
                </Link>

                <button 
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'} disabled:opacity-50`}
                >
                  {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                    plan === 'FREE' ? <Zap className="w-4 h-4 text-orange-500 fill-current" /> : <Shield className="w-4 h-4 opacity-70" />
                  )}
                  {plan === 'FREE' ? t('subscribe') : t('manage-subscription')}
                </button>
                
                <div className={`h-px my-1 ${settings.theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`} />
                
                <button 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (plan === 'FREE') {
                      setLimitModal({ isOpen: true, type: 'support' });
                    } else {
                      setContactModal({ isOpen: true, type: 'support' });
                    }
                  }} 
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'}`}
                >
                  <MessageSquare className="w-4 h-4 opacity-70" /> {t('support') || 'Support'}
                </button>

                <button 
                  onClick={() => {
                    setIsDropdownOpen(false);
                    if (plan === 'FREE') {
                      setLimitModal({ isOpen: true, type: 'wishes' });
                    } else {
                      setContactModal({ isOpen: true, type: 'wishes' });
                    }
                  }} 
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-white/5 text-white' : 'hover:bg-gray-50 text-gray-900'}`}
                >
                  <Heart className="w-4 h-4 opacity-70" /> {t('wishes') || 'Wünsche'}
                </button>

                <div className={`h-px my-1 ${settings.theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`} />

                <button onClick={handleLogout} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${settings.theme === 'dark' ? 'hover:bg-red-500/10 text-red-400' : 'hover:bg-red-50 text-red-600'}`}>
                  <LogOut className="w-4 h-4" /> {auth.currentUser ? (t('logout') || 'Logout') : (t('login') || 'Login')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      </header>
      <LimitReachedModal 
        isOpen={limitModal.isOpen} 
        onClose={() => setLimitModal({ ...limitModal, isOpen: false })} 
        type={limitModal.type} 
        onProceed={() => {
          const currentType = limitModal.type;
          setLimitModal({ ...limitModal, isOpen: false });
          if (currentType === 'support' || currentType === 'wishes') {
            setContactModal({ isOpen: true, type: currentType });
          }
        }}
      />
      <ContactModal
        isOpen={contactModal.isOpen}
        onClose={() => setContactModal({ ...contactModal, isOpen: false })}
        type={contactModal.type}
      />
      <ThankYouPortalModal
        isOpen={isThankYouModalOpen}
        onClose={() => setIsThankYouModalOpen(false)}
        onProceed={handleProceedToPortal}
        loading={portalLoading}
      />
    </>
  );
}
