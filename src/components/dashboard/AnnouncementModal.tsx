import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Bell, Calendar } from 'lucide-react';
import { Announcement } from '../../services/announcementService';
import { useSettings } from '../../context/SettingsContext';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  announcements: Announcement[];
}

const LANGUAGES = [
  { code: 'de', flag: '🇩🇪', label: 'DE' },
  { code: 'en', flag: '🇺🇸', label: 'EN' },
  { code: 'fr', flag: '🇫🇷', label: 'FR' },
  { code: 'es', flag: '🇪🇸', label: 'ES' },
];

export function AnnouncementModal({ isOpen, onClose, announcements }: AnnouncementModalProps) {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';
  const [activeLang, setActiveLang] = useState<any>(settings.language || 'de');

  // Synchronize with settings when modal is opened or settings change
  useEffect(() => {
    if (isOpen) {
      setActiveLang(settings.language || 'de');
    }
  }, [isOpen, settings.language]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()} 
        className={`relative w-full max-w-2xl max-h-[80vh] rounded-[2.5rem] flex flex-col shadow-2xl ${isDark ? 'bg-neutral-900 border border-white/10 text-white' : 'bg-white text-gray-900'}`}
      >
        <div className="flex flex-col border-b border-gray-100 dark:border-white/5 shrink-0">
          <div className="flex justify-between items-center p-8 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                <Bell className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-2xl font-black uppercase tracking-tight">Neuigkeiten & Updates</h2>
                <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Was gibt's neues bei RSSer?</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="p-3 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex items-center gap-2 px-8 pb-6">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => setActiveLang(lang.code)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition-all border ${
                  activeLang === lang.code 
                    ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' 
                    : `border-transparent ${isDark ? 'hover:bg-white/10 text-white/50' : 'hover:bg-gray-100 text-gray-500'}`
                }`}
              >
                <span className="text-lg leading-none">{lang.flag}</span>
                <span>{lang.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Announcements renderer */}
          {(() => {
            const listToDisplay = announcements;
            
            return listToDisplay.map((announcement) => (
              <div key={announcement.id} className="space-y-3 pb-8 border-b border-gray-100 dark:border-white/5 last:border-0 last:pb-0">
                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-2">
                  <Calendar className="w-3 h-3" />
                  {announcement.createdAt?.seconds 
                    ? new Date(announcement.createdAt.seconds * 1000).toLocaleDateString(activeLang === 'de' ? 'de-DE' : 'en-US', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })
                    : '---'}
                </div>
                <div 
                  className={`prose prose-sm max-w-none ${isDark ? 'prose-invert' : ''} font-medium leading-relaxed announcement-content`}
                  dangerouslySetInnerHTML={{ __html: announcement.content[activeLang] || announcement.content['de'] || '' }}
                />
              </div>
            ));
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}

