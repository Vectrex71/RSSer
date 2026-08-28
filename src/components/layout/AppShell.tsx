import { ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { PricingModal } from '../dashboard/PricingModal';
import { OnboardingTour } from '../dashboard/OnboardingTour';
import { usePlan } from '../../hooks/usePlan';
import { exportToOPML } from '../../lib/opml';
import { auth, db } from '../../lib/firebase';
import { doc, deleteDoc } from 'firebase/firestore';
import { PLAN_LIMITS } from '../../lib/constants';
import { Trash2, Download, CreditCard, Lock, Radio, Youtube, Podcast, Rss, Camera, FileText } from 'lucide-react';
import { tr } from '../../lib/t';
import { AmbientWave } from './AmbientWave';

export function AppShell({ children }: { children: ReactNode }) {
  const { 
    settings, 
    toggleSidebar, 
    pricingModalOpen, 
    setPricingModalOpen,
    showHeader1,
    showHeader2,
    setShowHeader1,
    setShowHeader2
  } = useSettings();
  const { hasExceeded, counts, feedsList, radiosList } = usePlan();
  const location = useLocation();
  const lastScrollTopRef = useRef(0);
  const scrollAccRef = useRef(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  const hasPadding = !['/rss-feeds', '/podcasts', '/youtube', '/webcam', '/radio', '/blogs', '/discover', '/settings', '/profile', '/admin'].some(route => 
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
          const diff = scrollTop - lastScrollTopRef.current;
          
          if (scrollTop <= 10) {
            setShowHeader1(true);
            setShowHeader2(true);
            scrollAccRef.current = 0;
          } else if (diff > 0) {
            // Scrolling down
            if (scrollAccRef.current < 0) {
              scrollAccRef.current = 0;
            }
            scrollAccRef.current += diff;

            if (scrollAccRef.current > 35) {
              setShowHeader2(false);
            }
            if (scrollAccRef.current > 120) {
              setShowHeader1(false);
            }
          } else if (diff < 0) {
            // Scrolling up
            if (scrollAccRef.current > 0) {
              scrollAccRef.current = 0;
            }
            scrollAccRef.current += diff; // negative diff

            if (scrollAccRef.current < -15) {
              setShowHeader1(true);
              setShowHeader2(true);
              scrollAccRef.current = 0;
            }
          }

          lastScrollTopRef.current = scrollTop;
          ticking = false;
        });
        ticking = true;
      }
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [setShowHeader1, setShowHeader2]);

  const getSourceTypeLabel = (type: string) => {
    if (type === 'rss' || type === 'article' || !type) return tr(settings.language, 'RSS Feed', 'RSS-Feed');
    if (type === 'radio') return tr(settings.language, 'Radio Station', 'Radiosender');
    if (type === 'podcast') return tr(settings.language, 'Podcast', 'Podcast');
    if (type === 'youtube') return tr(settings.language, 'YouTube Channel', 'YouTube-Kanal');
    if (type === 'webcam' || type === 'webcams') return tr(settings.language, 'Webcam', 'Webcam');
    if (type === 'blog') return tr(settings.language, 'Blog', 'Blog');
    return type;
  };

  const handleDeleteFeed = async (feedId: string) => {
    if (!auth.currentUser) return;
    setDeletingId(feedId);
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'feeds', feedId));
    } catch (err) {
      console.error("Error deleting feed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteRadio = async (radioId: string) => {
    if (!auth.currentUser) return;
    setDeletingId(radioId);
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'radioStations', radioId));
    } catch (err) {
      console.error("Error deleting radio:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportOPML = () => {
    const xml = exportToOPML(feedsList);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rsser_feeds.opml';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div 
      className={`flex h-screen overflow-hidden ${settings.theme === 'dark' ? 'dark bg-[#0a0a0a] text-[#ededed]' : 'bg-white text-[#1c1c1c]'}`}
    >
      <Sidebar />
      <div className={`flex-1 flex flex-col relative overflow-hidden ${settings.theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <AmbientWave />
        <Header />
        <main id="main-scroll-container" className={`flex-1 overflow-y-auto relative z-10 ${hasPadding ? 'p-4 md:p-8' : ''} ${hasExceeded ? 'blur-md pointer-events-none select-none' : ''}`}>{children}</main>
      </div>

      <PricingModal 
        isOpen={pricingModalOpen} 
        onClose={() => setPricingModalOpen(false)} 
      />

      {/* Exceeded limit lock screen */}
      {hasExceeded && (
        <div className="fixed inset-0 bg-neutral-950/85 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
          <div className={`w-full max-w-2xl rounded-3xl border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden ${
            settings.theme === 'dark' ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'
          } animate-in fade-in zoom-in duration-300`}>
            
            {/* Header */}
            <div className="p-6 border-b border-black/5 dark:border-white/10 flex items-start gap-4 shrink-0">
              <div className="p-3 bg-orange-500/10 text-orange-500 rounded-2xl shrink-0">
                <Lock className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">
                  {tr(settings.language, "Plan Limit Exceeded", "Plan-Limit überschritten")}
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                  {tr(
                    settings.language,
                    "Your subscription has expired or was downgraded. Access is temporarily locked because your sources exceed the Free plan limits.",
                    "Dein Abonnement ist abgelaufen oder herabgestuft worden. Da deine Quellen die kostenlosen Limits überschreiten, ist der Zugriff vorübergehend gesperrt."
                  )}
                </p>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Limits and current counts */}
              <div>
                <h3 className="text-xs font-mono tracking-widest uppercase text-orange-500 font-bold mb-3">
                  {tr(settings.language, "Your Current Limits", "Deine aktuellen Limits")}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* RSS Feeds */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.rss > PLAN_LIMITS.FREE.rss 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "RSS Feeds", "RSS Feeds")}</div>
                    <div className={`text-lg font-black ${counts.rss > PLAN_LIMITS.FREE.rss ? 'text-red-500' : ''}`}>
                      {counts.rss} / {PLAN_LIMITS.FREE.rss}
                    </div>
                  </div>

                  {/* Radio */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.radio > PLAN_LIMITS.FREE.radio 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "Radio Stations", "Radiosender")}</div>
                    <div className={`text-lg font-black ${counts.radio > PLAN_LIMITS.FREE.radio ? 'text-red-500' : ''}`}>
                      {counts.radio} / {PLAN_LIMITS.FREE.radio}
                    </div>
                  </div>

                  {/* Podcasts */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.podcast > PLAN_LIMITS.FREE.podcast 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "Podcasts", "Podcasts")}</div>
                    <div className={`text-lg font-black ${counts.podcast > PLAN_LIMITS.FREE.podcast ? 'text-red-500' : ''}`}>
                      {counts.podcast} / {PLAN_LIMITS.FREE.podcast}
                    </div>
                  </div>

                  {/* YouTube */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.youtube > PLAN_LIMITS.FREE.youtube 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "YouTube Channels", "YouTube Kanäle")}</div>
                    <div className={`text-lg font-black ${counts.youtube > PLAN_LIMITS.FREE.youtube ? 'text-red-500' : ''}`}>
                      {counts.youtube} / {PLAN_LIMITS.FREE.youtube}
                    </div>
                  </div>

                  {/* Webcams */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.webcam > PLAN_LIMITS.FREE.webcam 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "Webcams", "Webcams")}</div>
                    <div className={`text-lg font-black ${counts.webcam > PLAN_LIMITS.FREE.webcam ? 'text-red-500' : ''}`}>
                      {counts.webcam} / {PLAN_LIMITS.FREE.webcam}
                    </div>
                  </div>

                  {/* Blogs */}
                  <div className={`p-3 rounded-2xl border text-center ${
                    counts.blogs > PLAN_LIMITS.FREE.blogs 
                      ? 'border-red-500/30 bg-red-500/5' 
                      : (settings.theme === 'dark' ? 'border-white/5 bg-white/5' : 'border-gray-100 bg-gray-50')
                  }`}>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">{tr(settings.language, "Blog Subscriptions", "Blog-Abos")}</div>
                    <div className={`text-lg font-black ${counts.blogs > PLAN_LIMITS.FREE.blogs ? 'text-red-500' : ''}`}>
                      {counts.blogs} / {PLAN_LIMITS.FREE.blogs}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => setPricingModalOpen(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-white font-bold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/20"
                >
                  <CreditCard className="w-5 h-5" />
                  {tr(settings.language, "Reactivate Subscription", "Abonnement reaktivieren")}
                </button>
                <button
                  onClick={handleExportOPML}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-bold border border-gray-200 dark:border-white/10 hover:bg-black/5 dark:hover:bg-white/5 transition-all shrink-0"
                >
                  <Download className="w-5 h-5" />
                  {tr(settings.language, "Export OPML", "OPML exportieren")}
                </button>
              </div>

              {/* Source lists */}
              <div className="space-y-3">
                <h3 className="text-xs font-mono tracking-widest uppercase text-gray-500 dark:text-gray-400 font-bold">
                  {tr(settings.language, "Manage Your Sources (Delete to unlock)", "Deine Quellen verwalten (Löschen zum Freischalten)")}
                </h3>
                
                <div className={`border rounded-2xl overflow-hidden divide-y ${
                  settings.theme === 'dark' ? 'border-white/5 divide-white/5' : 'border-gray-100 divide-gray-100'
                }`}>
                  {feedsList.map(feed => {
                    const type = (feed.type || '').split('/')[0] || '';
                    let Icon = Rss;
                    if (type === 'podcast') Icon = Podcast;
                    else if (type === 'youtube') Icon = Youtube;
                    else if (type === 'webcam' || type === 'webcams') Icon = Camera;
                    else if (type === 'blog') Icon = FileText;

                    return (
                      <div key={feed.id} className="p-3 flex items-center justify-between gap-4 bg-black/[0.02] dark:bg-white/[0.01] hover:bg-black/[0.04] dark:hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Icon className={`w-4 h-4 shrink-0 ${
                            type === 'podcast' ? 'text-purple-500' :
                            type === 'youtube' ? 'text-red-500' :
                            (type === 'webcam' || type === 'webcams') ? 'text-emerald-500' :
                            type === 'blog' ? 'text-yellow-500' : 'text-orange-500'
                          }`} />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold truncate">{feed.title || feed.name || "Untitled Source"}</div>
                            <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">{getSourceTypeLabel(type)}</div>
                          </div>
                        </div>
                        <button
                          disabled={deletingId === feed.id}
                          onClick={() => handleDeleteFeed(feed.id)}
                          className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all shrink-0 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}

                  {radiosList.map(radio => (
                    <div key={radio.id} className="p-3 flex items-center justify-between gap-4 bg-black/[0.02] dark:bg-white/[0.01] hover:bg-black/[0.04] dark:hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Radio className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate">{radio.title || radio.name || "Untitled Radio"}</div>
                          <div className="text-[10px] font-mono text-gray-500 dark:text-gray-400 uppercase tracking-wider">{getSourceTypeLabel('radio')}</div>
                        </div>
                      </div>
                      <button
                        disabled={deletingId === radio.id}
                        onClick={() => handleDeleteRadio(radio.id)}
                        className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition-all shrink-0 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {feedsList.length === 0 && radiosList.length === 0 && (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      {tr(settings.language, "No sources found.", "Keine Quellen gefunden.")}
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

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
