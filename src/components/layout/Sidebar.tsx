import React, { useState, useEffect } from 'react';
import { Radio, Youtube, Podcast, Rss, Camera, Compass, Shield, FileText, Bell, Play } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { NavLink } from 'react-router-dom';
import { auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { usePlan } from '../../hooks/usePlan';
import { fetchAnnouncements, fetchLatestAnnouncement, Announcement } from '../../services/announcementService';
import { AnnouncementModal } from '../dashboard/AnnouncementModal';
import { useMedia } from '../../context/MediaContext';
import { isAdminEmail } from '../../lib/admin';

export function Sidebar() {
  const { settings, setPricingModalOpen, setLastSeenAnnouncementId } = useSettings();
  const { t } = useTranslation();
  const { plan } = usePlan();
  const { playingAudio, isAudioMinimized, setIsAudioMinimized } = useMedia();
  
  const [isAdmin, setIsAdmin] = React.useState(false);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [latestAnnouncement, setLatestAnnouncement] = useState<Announcement | null>(null);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAdmin(isAdminEmail(user?.email));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const loadAnnouncements = async () => {
      try {
        const all = await fetchAnnouncements();
        setAnnouncements(all);
        if (all.length > 0) {
          setLatestAnnouncement(all[0]);
        }
      } catch (error) {
        console.error("Failed to load announcements in sidebar:", error);
      }
    };
    loadAnnouncements();

    // Set up a small interval to check for new announcements if needed, 
    // but for now, once on mount is okay.
  }, []);

  const hasNewAnnouncement = latestAnnouncement && settings.lastSeenAnnouncementId !== latestAnnouncement.id;

  const mainNavItems = [
    { name: t('rss-feeds'), icon: Rss, path: '/rss-feeds', colorClass: 'text-orange-500', hoverColorClass: 'group-hover:text-orange-500' },
    { name: t('podcasts'), icon: Podcast, path: '/podcasts', colorClass: 'text-purple-500', hoverColorClass: 'group-hover:text-purple-500' },
    { name: t('radio'), icon: Radio, path: '/radio', colorClass: 'text-blue-500', hoverColorClass: 'group-hover:text-blue-500' },
    { name: t('youtube'), icon: Youtube, path: '/youtube', colorClass: 'text-red-500', hoverColorClass: 'group-hover:text-red-500' },
    { name: t('webcam'), icon: Camera, path: '/webcam', colorClass: 'text-emerald-500', hoverColorClass: 'group-hover:text-emerald-500' },
    { name: t('blogs') || 'Blogs', icon: FileText, path: '/blogs/subscribed', colorClass: 'text-yellow-500', hoverColorClass: 'group-hover:text-yellow-500' },
  ].filter(item => !(settings.hiddenSources || []).includes(item.path));
  
  const bottomNavItems = [
    { name: t('discover'), icon: Compass, path: '/discover', colorClass: 'text-cyan-500', hoverColorClass: 'group-hover:text-cyan-500' },
  ];

  if (isAdmin) {
    bottomNavItems.push({ name: t('admin') || 'Admin', icon: Shield, path: '/admin', colorClass: 'text-gray-400', hoverColorClass: 'group-hover:text-gray-400' });
  }

  const renderItem = (item: any) => (
    <NavLink 
      key={item.name} 
      to={item.path} 
      id={item.path === '/discover' ? 'discover-nav' : undefined}
      title={!settings.sidebarVisible ? item.name : undefined}
      className={({ isActive }) => `group flex items-center transition-all duration-300 rounded-xl ${
        settings.sidebarVisible ? 'gap-3 px-3 py-2' : 'justify-center py-2 px-0'
      } ${
        isActive 
          ? (settings.theme === 'dark' ? 'bg-white/10 text-white shadow-lg shadow-white/5' : 'bg-gray-200 text-gray-900') 
          : (settings.theme === 'dark' ? 'text-white/70 hover:text-white' : 'text-gray-600 hover:text-gray-900')
      }`}
    >
      {({ isActive }) => (
        <>
          <item.icon className={`w-5 h-5 shrink-0 transition-colors ${isActive ? item.colorClass : item.hoverColorClass}`} />
          <span className={`transition-opacity duration-300 whitespace-nowrap ${settings.sidebarVisible ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden md:hidden'}`}>{item.name}</span>
        </>
      )}
    </NavLink>
  );

  return (
    <>
      <aside className={`${settings.sidebarVisible ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0 md:w-20'} absolute md:relative z-50 flex flex-col h-full border-r transition-all duration-300 ${settings.theme === 'dark' ? 'border-white/10 bg-[#0f0f0f]' : 'border-gray-200 bg-gray-50'}`}>
        <div className={`flex items-center transition-all duration-300 ${settings.sidebarVisible ? 'p-4 gap-3' : 'pt-10 pb-6 px-0 justify-center'} ${settings.theme === 'dark' ? 'text-white' : 'text-[#0a0a0a]'}`}>
          <img src="/RSSerLogo.png" alt="RSSer Logo" className={`${settings.sidebarVisible ? 'w-12 h-12' : 'w-12 h-12'} rounded-xl object-contain shrink-0 transition-all duration-300`} referrerPolicy="no-referrer" />
          <span className={`text-2xl font-bold tracking-tight transition-opacity duration-300 ${settings.sidebarVisible ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden md:hidden'}`}>RSSer</span>
        </div>
        
        <nav id="sidebar-navigation" className={`flex-1 flex flex-col ${settings.sidebarVisible ? 'px-4 pb-4' : 'px-2 pb-2'} overflow-hidden transition-all duration-300`}>
          <div className="flex-1 overflow-y-auto space-y-1">
            <div className={`text-[10px] uppercase tracking-widest font-semibold px-2 py-2 transition-opacity duration-300 ${settings.sidebarVisible ? 'opacity-100' : 'opacity-0 md:hidden'} ${settings.theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{t('library')}</div>
            {mainNavItems.map(renderItem)}
          </div>

          <div className="mt-auto pt-4 pb-4 space-y-1">
            {/* Minimized Media Player Indicator - Above the divider */}
            {playingAudio && isAudioMinimized && (
              <div className="pb-3">
                <button
                  onClick={() => setIsAudioMinimized(false)}
                  title={playingAudio.title}
                  className={`group relative flex items-center transition-all duration-300 rounded-xl cursor-pointer w-full hover:-translate-y-0.5 ${
                    settings.sidebarVisible 
                      ? `gap-3 px-3 py-2.5 ${settings.theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 shadow-sm'}` 
                      : `justify-center py-2.5 px-0 ${settings.theme === 'dark' ? 'text-white' : 'text-gray-900'}`
                  }`}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    {playingAudio.imageUrl ? (
                      <img 
                        src={playingAudio.imageUrl} 
                        alt="" 
                        className={`w-8 h-8 rounded-lg object-cover ring-2 ${settings.theme === 'dark' ? 'ring-white/10' : 'ring-black/5'}`}
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ring-2 ${settings.theme === 'dark' ? 'bg-white/5 text-white/70 ring-white/10' : 'bg-gray-100 text-gray-600 ring-black/5'}`}>
                        <Radio className="w-4 h-4 animate-pulse" />
                      </div>
                    )}
                    {/* Tiny play icon in the corner */}
                    <span className={`absolute -bottom-1 -right-1 text-black text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center shadow ring-1 ring-black/10 select-none ${settings.theme === 'dark' ? 'bg-white text-black' : 'bg-black text-white'}`}>
                      <Play className={`w-1.5 h-1.5 ${settings.theme === 'dark' ? 'fill-black text-black' : 'fill-white text-white'}`} />
                    </span>
                  </div>
                  {settings.sidebarVisible && (
                    <div className="min-w-0 flex-1 text-left">
                      <p className="text-xs font-bold truncate">{playingAudio.title}</p>
                      <p className="text-[10px] opacity-60 truncate">{settings.language === 'en' ? 'Click to restore player' : 'Klicken zum Maximieren'}</p>
                    </div>
                  )}
                </button>
              </div>
            )}

            <div className={`h-px w-full mb-4 ${settings.theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
            
            {/* Always render Discover first in bottom section */}
            {bottomNavItems.filter(item => item.path === '/discover').map(renderItem)}

            {/* Announcement / News item - Placed directly under DISCOVER */}
            <button
              onClick={() => {
                setIsAnnouncementModalOpen(true);
                if (latestAnnouncement) {
                  setLastSeenAnnouncementId(latestAnnouncement.id);
                }
              }}
              id="news-button"
              title={!settings.sidebarVisible ? (t('news') || 'Neuigkeiten') : undefined}
              className={`group relative flex items-center transition-all duration-300 rounded-xl cursor-pointer w-full text-left ${
                settings.sidebarVisible ? 'gap-3 px-3 py-2' : 'justify-center py-2 px-0'
              } ${
                settings.theme === 'dark' ? 'text-white/70 hover:text-white hover:bg-white/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
            >
              <div className="relative">
                <Bell className={`w-5 h-5 shrink-0 transition-colors group-hover:text-orange-500`} />
                {hasNewAnnouncement && (
                  <span className="absolute -top-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                  </span>
                )}
              </div>
              <span className={`transition-opacity duration-300 whitespace-nowrap overflow-hidden ${settings.sidebarVisible ? 'opacity-100 w-auto' : 'opacity-0 w-0 md:hidden'}`}>
                {t('news') || 'News'}
              </span>
            </button>

            {/* Render other bottom items (like Admin) */}
            {bottomNavItems.filter(item => item.path !== '/discover').map(renderItem)}
          </div>
        </nav>
      </aside>

      <AnnouncementModal 
        isOpen={isAnnouncementModalOpen} 
        onClose={() => setIsAnnouncementModalOpen(false)} 
        announcements={announcements}
      />
    </>
  );
}
