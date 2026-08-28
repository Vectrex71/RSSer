import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useRef } from 'react';
import { auth, db, handleFirestoreError, OperationType, isQuotaError } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, getDocFromServer } from 'firebase/firestore';

export type Language = 'de' | 'en' | 'fr' | 'es';

interface Settings {
  theme: 'light' | 'dark';
  sidebarVisible: boolean;
  language: Language; 
  viewMode: 'list' | 'grid' | 'magazine' | 'screensaver';
  openArticlesEmbedded: boolean;
  startPage: string;
  shareSourcesPublicly: boolean;
  showTopAktuell?: boolean;
  showAmbientWaves?: boolean;
  lastSeenAnnouncementId?: string;
  isQuotaExceeded: boolean;
  hiddenSources: string[];
  hasSeenTour?: boolean;
}

interface SettingsContextType {
  settings: Settings;
  searchQuery: string;
  pricingModalOpen: boolean;
  showHeader1: boolean;
  showHeader2: boolean;
  setPricingModalOpen: (open: boolean) => void;
  setSearchQuery: (query: string) => void;
  toggleSidebar: () => void;
  setSidebarVisible: (visible: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setLanguage: (lang: Language) => void;
  setViewMode: (mode: 'list' | 'grid' | 'magazine' | 'screensaver') => void;
  setOpenArticlesEmbedded: (open: boolean) => void;
  setStartPage: (page: string) => void;
  setShareSourcesPublicly: (share: boolean) => void;
  setShowTopAktuell: (show: boolean) => void;
  setShowAmbientWaves: (show: boolean) => void;
  setLastSeenAnnouncementId: (id: string) => void;
  setQuotaExceeded: (exceeded: boolean) => void;
  toggleSourceVisibility: (path: string) => void;
  setShowHeader1: (show: boolean) => void;
  setShowHeader2: (show: boolean) => void;
  setHasSeenTour: (seen: boolean) => void;
}

const defaultSettings: Settings = { 
  theme: 'light', 
  sidebarVisible: true, 
  language: 'de', 
  viewMode: 'grid',
  openArticlesEmbedded: false,
  startPage: '/rss-feeds',
  shareSourcesPublicly: false,
  showTopAktuell: true,
  showAmbientWaves: true,
  isQuotaExceeded: false,
  hiddenSources: [],
  hasSeenTour: false
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [showHeader1, setShowHeader1] = useState(true);
  const [showHeader2, setShowHeader2] = useState(true);
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('rsser-settings');
      let loaded = defaultSettings;
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            loaded = { ...defaultSettings, ...parsed };
          }
        } catch {
          // ignore parsing error
        }
      }
      return { 
        ...loaded, 
        hiddenSources: loaded.hiddenSources || [],
        showAmbientWaves: loaded.showAmbientWaves !== false,
        isQuotaExceeded: false 
      };
    } catch {
      return { ...defaultSettings, isQuotaExceeded: false };
    }
  });

  const settingsRef = useRef<Settings>(settings);
  useEffect(() => {
    settingsRef.current = settings;
    // Only persist relevant settings, not temporary states like quota
    const { isQuotaExceeded, ...persistentSettings } = settings;
    localStorage.setItem('rsser-settings', JSON.stringify(persistentSettings));
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  }, [settings]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Use getDocFromServer to ensure we are seeing the latest rules and bypass cache
          const docRef = doc(db, 'users', user.uid, 'settings', 'userConfig');
          const docSnap = await getDocFromServer(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data && typeof data === 'object') {
              // Never load the quota exceeded state from the database
              setSettings(prev => ({ 
                ...defaultSettings,
                ...prev, 
                ...data, 
                hiddenSources: Array.isArray(data.hiddenSources) ? data.hiddenSources : (prev.hiddenSources || []),
                showAmbientWaves: data.showAmbientWaves !== false,
                isQuotaExceeded: false 
              }));
            }
          } else {
            // Only try to create if it doesn't exist - but catch the error specifically
            try {
              await setDoc(docRef, settingsRef.current, { merge: true });
            } catch (createErr) {
              console.warn("Could not create initial user settings:", createErr);
            }
          }
        } catch (e: any) {
          console.error("Failed to load user settings:", e);
          if (isQuotaError(e)) {
            console.error("QUOTA ERROR DETECTED in onAuthStateChanged:", e.message);
            setSettings(prev => ({ ...prev, isQuotaExceeded: true }));
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const updateSetting = useCallback((key: keyof Settings, value: any) => {
    if (settingsRef.current[key] === value) {
      return;
    }
    setSettings(prev => ({ ...prev, [key]: value }));

    const user = auth.currentUser;
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'settings', 'userConfig'), { [key]: value }, { merge: true })
        .catch(e => {
          console.error("Error updating setting in Firestore:", e);
          if (isQuotaError(e)) {
            console.error("QUOTA ERROR DETECTED in updateSetting:", e.message);
            setSettings(prevQuota => {
              if (prevQuota.isQuotaExceeded) return prevQuota;
              return { ...prevQuota, isQuotaExceeded: true };
            });
          }
        });
    }
  }, []);

  const toggleSidebar = () => updateSetting('sidebarVisible', !settingsRef.current.sidebarVisible);
  const setSidebarVisible = useCallback((visible: boolean) => updateSetting('sidebarVisible', visible), [updateSetting]);
  const setTheme = (theme: 'light' | 'dark') => updateSetting('theme', theme);
  const toggleTheme = () => updateSetting('theme', settingsRef.current.theme === 'light' ? 'dark' : 'light');
  const setLanguage = (lang: Language) => updateSetting('language', lang);
  const setViewMode = (mode: 'list' | 'grid' | 'magazine' | 'screensaver') => updateSetting('viewMode', mode);
  const setOpenArticlesEmbedded = (open: boolean) => updateSetting('openArticlesEmbedded', open);
  const setStartPage = (page: string) => updateSetting('startPage', page);
  const setShareSourcesPublicly = (share: boolean) => updateSetting('shareSourcesPublicly', share);
  const setShowTopAktuell = (show: boolean) => updateSetting('showTopAktuell', show);
  const setShowAmbientWaves = (show: boolean) => updateSetting('showAmbientWaves', show);
  const setLastSeenAnnouncementId = (id: string) => updateSetting('lastSeenAnnouncementId', id);
  const setQuotaExceeded = (exceeded: boolean) => updateSetting('isQuotaExceeded', exceeded);
  const setHasSeenTour = useCallback((seen: boolean) => updateSetting('hasSeenTour', seen), [updateSetting]);
  
  const toggleSourceVisibility = useCallback((path: string) => {
    const currentHidden = settingsRef.current.hiddenSources || [];
    const hiddenSources = currentHidden.includes(path) 
      ? currentHidden.filter(p => p !== path)
      : [...currentHidden, path];
    
    setSettings(prev => ({ ...prev, hiddenSources }));

    const user = auth.currentUser;
    if (user) {
      setDoc(doc(db, 'users', user.uid, 'settings', 'userConfig'), { hiddenSources }, { merge: true })
        .catch(e => {
          console.error("Error updating setting in Firestore:", e);
          if (isQuotaError(e)) {
            setSettings(prevQuota => {
              if (prevQuota.isQuotaExceeded) return prevQuota;
              return { ...prevQuota, isQuotaExceeded: true };
            });
          }
        });
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ 
      settings, 
      searchQuery, 
      pricingModalOpen, 
      showHeader1,
      showHeader2,
      setPricingModalOpen, 
      setSearchQuery, 
      toggleSidebar, 
      setSidebarVisible,
      setTheme, 
      toggleTheme, 
      setLanguage, 
      setViewMode, 
      setOpenArticlesEmbedded, 
      setStartPage, 
      setShareSourcesPublicly, 
      setShowTopAktuell, 
      setShowAmbientWaves,
      setLastSeenAnnouncementId, 
      setQuotaExceeded, 
      toggleSourceVisibility,
      setShowHeader1,
      setShowHeader2,
      setHasSeenTour
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) throw new Error('useSettings must be used within SettingsProvider');
  return context;
};
