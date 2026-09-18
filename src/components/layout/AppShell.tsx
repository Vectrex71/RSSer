import { ReactNode, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { OnboardingTour } from '../dashboard/OnboardingTour';
import { AmbientWave } from './AmbientWave';

export function AppShell({ children }: { children: ReactNode }) {
  const { 
    settings, 
    toggleSidebar, 
    showHeader1,
    showHeader2,
    setShowHeader1,
    setShowHeader2
  } = useSettings();
  const location = useLocation();
  const lastScrollTopRef = useRef(0);
  const scrollAccRef = useRef(0);
  
  const hasPadding = !['/rss-feeds', '/podcasts', '/youtube', '/radio', '/discover', '/settings', '/profile', '/admin'].some(route => 
    location.pathname === route || location.pathname.startsWith(route + '/')
  );

  // Reset headers on route change
  useEffect(() => {
    setShowHeader1(true);
    setShowHeader2(true);
    lastScrollTopRef.current = 0;
    scrollAccRef.current = 0;
  }, [location.pathname, setShowHeader1, setShowHeader2]);

  useEffect(() => {
    const container = document.getElementById('main-scroll-container');
    if (!container) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollTop = container.scrollTop;
          const delta = scrollTop - lastScrollTopRef.current;

          // Always show both headers near top
          if (scrollTop < 80) {
            setShowHeader1(true);
            setShowHeader2(true);
            scrollAccRef.current = 0;
            lastScrollTopRef.current = scrollTop;
            ticking = false;
            return;
          }

          // Accumulate scroll direction
          if ((delta > 0 && scrollAccRef.current < 0) || (delta < 0 && scrollAccRef.current > 0)) {
            scrollAccRef.current = 0;
          }
          scrollAccRef.current += delta;

          // Hysteresis threshold
          if (scrollAccRef.current > 60) {
            // Scrolling down -> hide both headers
            setShowHeader1(false);
            setShowHeader2(false);
          } else if (scrollAccRef.current < -40) {
            // Scrolling up -> show both headers
            setShowHeader1(true);
            setShowHeader2(true);
          }

          lastScrollTopRef.current = scrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [setShowHeader1, setShowHeader2]);

  return (
    <div 
      className={`flex h-screen overflow-hidden ${settings.theme === 'dark' ? 'dark bg-[#0a0a0a] text-[#ededed]' : 'bg-white text-[#1c1c1c]'}`}
    >
      <Sidebar />
      <div className={`flex-1 flex flex-col relative overflow-hidden ${settings.theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <AmbientWave />
        <Header />
        <main id="main-scroll-container" className={`flex-1 overflow-y-auto relative z-10 ${hasPadding ? 'p-4 md:p-8' : ''}`}>{children}</main>
      </div>

      {/* Mobile overlay */}
      {settings.sidebarVisible && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={toggleSidebar}
        />
      )}

      <OnboardingTour />
    </div>
  );
}
