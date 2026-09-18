import { BrowserRouter, Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LoginPage } from './components/LoginPage';
import { SettingsProvider } from './context/SettingsContext';
import { ModalProvider } from './context/ModalContext';
import { MediaProvider } from './context/MediaContext';
import { PlanProvider } from './context/PlanContext';
import { LandingPage } from './components/LandingPage';
import { ImpressumPage } from './components/ImpressumPage';
import { DatenschutzPage } from './components/DatenschutzPage';
import { WartelistePage } from './components/WartelistePage';
import { AuthActionPage } from './components/AuthActionPage';
import { SettingsPage } from './components/SettingsPage';
import { DiscoverPage } from './components/dashboard/DiscoverPage';
import { AdminPage } from './components/dashboard/AdminPage';
import { RssPage } from './components/dashboard/RssPage';
import { RadioPage } from './components/dashboard/RadioPage';

import { AppShell } from './components/layout/AppShell';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { GlobalMediaPlayer } from './components/layout/GlobalMediaPlayer';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

function ScrollToHash() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const element = document.getElementById(location.hash.substring(1));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    } else {
      window.scrollTo(0, 0);
    }
  }, [location]);

  return null;
}

function HomeRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(() => {
    if (window.location.hash || location.hash) return false;
    return localStorage.getItem('rsser_logged_in') === 'true';
  });

  useEffect(() => {
    // If we have a hash, don't auto-redirect, just show landing
    if (window.location.hash || location.hash) {
      setChecking(false);
      return;
    }

    const isLoggedIn = localStorage.getItem('rsser_logged_in') === 'true';
    if (isLoggedIn) {
      // Determine start page immediately from cached settings for instant zero-latency transition
      let startPage = '/discover';
      try {
        const cachedSettings = localStorage.getItem('rsser-settings');
        if (cachedSettings) {
          const parsed = JSON.parse(cachedSettings);
          if (parsed && parsed.startPage) startPage = parsed.startPage;
        }
      } catch (e) {}

      navigate(startPage, { replace: true });
      return;
    } else {
      setChecking(false);
    }
  }, [navigate, location.hash]);

  if (checking) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center text-neutral-900 dark:text-white transition-colors duration-150">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <img 
            src="/RSSerLogo.png" 
            alt="RSSer Logo" 
            className="w-16 h-16 rounded-2xl object-contain mb-2 shadow-sm drop-shadow-sm"
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          <p className="text-xs font-mono tracking-[0.25em] uppercase text-neutral-500 dark:text-white/60">
            VERBINDEN...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <LandingPage />
      <Footer />
    </>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "RSSer News";
  }, []);

  return (
    <BrowserRouter>
      <ScrollToHash />
      <div className="bg-white dark:bg-[#0a0a0a] text-black dark:text-white min-h-screen flex flex-col transition-colors duration-300">
      <SettingsProvider>
        <ModalProvider>
          <PlanProvider>
            <MediaProvider>
              <Routes>
              <Route path="/" element={<HomeRoute />} />
              <Route path="/impressum" element={<><Header /><ImpressumPage /><Footer /></>} />
              <Route path="/datenschutz" element={<><Header /><DatenschutzPage /><Footer /></>} />
              <Route path="/warteliste" element={<><Header /><WartelistePage /><Footer /></>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/reset-password" element={<AuthActionPage />} />
              <Route path="/settings" element={<AppShell><SettingsPage /></AppShell>} />
              <Route path="/profile" element={<Navigate to="/settings" replace />} />
              <Route path="/discover" element={<AppShell><DiscoverPage /></AppShell>} />
              <Route path="/discover/:category" element={<AppShell><DiscoverPage /></AppShell>} />
              <Route path="/admin" element={<AppShell><AdminPage /></AppShell>} />
              <Route path="/admin/:category" element={<AppShell><AdminPage /></AppShell>} />
              <Route path="/rss-feeds" element={<AppShell><RssPage /></AppShell>} />
              <Route path="/podcasts" element={<AppShell><RssPage type="podcasts" /></AppShell>} />
              <Route path="/youtube" element={<AppShell><RssPage type="youtube" /></AppShell>} />
              <Route path="/radio" element={<AppShell><RadioPage /></AppShell>} />
              <Route path="/webcam" element={<Navigate to="/discover" replace />} />
              <Route path="/discover/webcam" element={<Navigate to="/discover" replace />} />
              <Route path="/discover/webcams" element={<Navigate to="/discover" replace />} />
              <Route path="/discover/blog" element={<Navigate to="/discover" replace />} />
              <Route path="/discover/blogs" element={<Navigate to="/discover" replace />} />
              <Route path="/blogs/*" element={<Navigate to="/discover" replace />} />
              <Route path="/blog/*" element={<Navigate to="/discover" replace />} />
            </Routes>
            <GlobalMediaPlayer />
          </MediaProvider>
        </PlanProvider>
      </ModalProvider>
    </SettingsProvider>
      </div>
    </BrowserRouter>
  );
}
