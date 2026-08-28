
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Upload, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { auth, db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc } from 'firebase/firestore';
import { exportToOPML, importFromOPML } from '../lib/opml';

export function SettingsPage() {
  const { settings, toggleTheme, setOpenArticlesEmbedded, setViewMode, setStartPage, setShareSourcesPublicly, setShowTopAktuell, setShowAmbientWaves, setLanguage, toggleSourceVisibility } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feeds, setFeeds] = useState<any[]>([]);

  useEffect(() => {
    if (!auth.currentUser) return;
    const feedsRef = collection(db, 'users', auth.currentUser.uid, 'feeds');
    const q = query(feedsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setFeeds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'users/' + auth.currentUser?.uid + '/feeds');
    });
    return () => unsubscribe();
  }, []);

  const handleExportOPML = () => {
    const xml = exportToOPML(feeds);
    const blob = new Blob([xml], { type: 'text/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rsser_feeds.opml';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportOPML = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser) return;
    
    const text = await file.text();
    const importedFeeds = await importFromOPML(text);
    
    for (const feed of importedFeeds) {
      const exists = feeds.some(f => f.url === feed.url);
      if (!exists) {
         const feedsRef = collection(db, 'users', auth.currentUser.uid, 'feeds');
         try {
           await addDoc(feedsRef, {
             title: feed.title,
             url: feed.url,
             category: feed.category
           });
         } catch (error) {
           handleFirestoreError(error, OperationType.CREATE, 'users/' + auth.currentUser.uid + '/feeds');
         }
      }
    }
  };
  
  const startPages = [
    { value: '/rss-feeds', label: t('rss-all') || 'RSS (Alle)' },
    { value: '/podcasts', label: t('podcasts') || 'Podcasts' },
    { value: '/radio', label: t('radio') || 'Radio' },
    { value: '/youtube', label: t('youtube') || 'YouTube' },
    { value: '/webcam', label: t('webcam') || 'Webcams' },
    { value: '/blogs', label: t('blogs') || 'Blogs' }
  ];

  const viewModes = [
    { value: 'grid', label: t('grid') || 'Grid' },
    { value: 'list', label: t('list') || 'Liste' },
    { value: 'magazine', label: t('magazine') || 'Magazin' },
    { value: 'screensaver', label: t('screensaver') || 'Screensaver' }
  ];

  const themeDark = settings.theme === 'dark';

  return (
    <div className={`p-4 sm:p-8 ${themeDark ? 'text-white' : 'text-gray-900'} relative z-10`}>
      <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300">
        <h1 className="text-3xl font-black mb-8 flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-orange-500" />
          {t('settings') || 'Einstellungen'}
        </h1>

        <div className={`p-6 rounded-2xl border mb-6 backdrop-blur-md ${themeDark ? 'bg-neutral-900/40 border-white/10' : 'bg-white/60 border-gray-200/80 shadow-sm'}`}>
          <h2 className="text-xl font-bold mb-6">{t('appearance-behavior') || 'Darstellung & Verhalten'}</h2>
          
          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('language-title') || 'Sprache / Language'}</span>
                <span className="text-xs text-gray-500">{t('language-desc') || 'App-Sprache auswählen / Choose app language.'}</span>
              </div>
              <div className="flex overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 text-xl shrink-0 bg-gray-50 dark:bg-neutral-800">
                <button 
                  onClick={() => setLanguage('de')}
                  className={`px-4 py-2 ${settings.language === 'de' ? 'bg-[#f89440] text-white' : 'text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'} transition-all`}
                >
                  🇩🇪
                </button>
                <button 
                  onClick={() => setLanguage('en')}
                  className={`px-4 py-2 border-l border-gray-200 dark:border-white/10 ${settings.language === 'en' ? 'bg-[#f89440] text-white' : 'text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'} transition-all`}
                >
                  🇺🇸
                </button>
                <button 
                  onClick={() => setLanguage('fr')}
                  className={`px-4 py-2 border-l border-gray-200 dark:border-white/10 ${settings.language === 'fr' ? 'bg-[#f89440] text-white' : 'text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'} transition-all`}
                >
                  🇫🇷
                </button>
                <button 
                  onClick={() => setLanguage('es')}
                  className={`px-4 py-2 border-l border-gray-200 dark:border-white/10 ${settings.language === 'es' ? 'bg-[#f89440] text-white' : 'text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'} transition-all`}
                >
                  🇪🇸
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('dark-mode') || 'Dark Mode'}</span>
                <span className="text-xs text-gray-500">{t('dark-mode-desc') || 'Das Design der App anpassen.'}</span>
              </div>
              <button 
                onClick={toggleTheme}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${themeDark ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${themeDark ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">
                  {settings.language === 'de' && 'Interaktive Tutorial Tour'}
                  {settings.language === 'en' && 'Interactive Tutorial Tour'}
                  {settings.language === 'fr' && 'Visite guidée interactive'}
                  {settings.language === 'es' && 'Recorrido turístico interactivo'}
                  {!['de', 'en', 'fr', 'es'].includes(settings.language || '') && 'Interactive Tutorial Tour'}
                </span>
                <span className="text-xs text-gray-500">
                  {settings.language === 'de' && 'Lerne die wichtigsten Bereiche und Funktionen der App in einer kurzen geführten Tour kennen.'}
                  {settings.language === 'en' && 'Learn the key areas and features of the app in a short guided tour.'}
                  {settings.language === 'fr' && "Découvrez les principales zones et fonctionnalités de l'application lors d'une courte visite guidée."}
                  {settings.language === 'es' && 'Conozca las áreas y funciones clave de la aplicación en un breve recorrido guiado.'}
                  {!['de', 'en', 'fr', 'es'].includes(settings.language || '') && 'Learn the key areas and features of the app in a short guided tour.'}
                </span>
              </div>
              <button 
                onClick={() => {
                  sessionStorage.setItem('start-onboarding-tour-pending', 'true');
                  navigate('/rss-feeds');
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
                  themeDark 
                    ? 'border-white/10 hover:bg-white/5 text-white' 
                    : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                }`}
              >
                {settings.language === 'de' && 'Tour starten'}
                {settings.language === 'en' && 'Start Tour'}
                {settings.language === 'fr' && 'Démarrer la visite'}
                {settings.language === 'es' && 'Iniciar recorrido'}
                {!['de', 'en', 'fr', 'es'].includes(settings.language || '') && 'Start Tour'}
              </button>
            </div>
            
            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="font-semibold">{t('default-startpage') || 'Standard-Startseite'}</span>
                <span className="text-xs text-gray-500">{t('default-startpage-desc') || 'Wähle, welche Seite nach dem Login standardmäßig angezeigt wird.'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {startPages.map(page => (
                  <button 
                    key={page.value}
                    onClick={() => setStartPage(page.value)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      (settings.startPage || '/rss-feeds') === page.value 
                        ? 'bg-[#f89440] text-white' 
                        : themeDark ? 'bg-neutral-800 text-gray-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {page.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col">
                <span className="font-semibold">{t('default-view') || 'Standard-Ansicht für Artikel'}</span>
                <span className="text-xs text-gray-500">{t('default-view-desc') || 'Wähle, in welchem Layout Artikel standardmäßig angezeigt werden sollen.'}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {viewModes.map(mode => (
                  <button 
                    key={mode.value}
                    onClick={() => setViewMode(mode.value as any)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                      settings.viewMode === mode.value 
                        ? 'bg-[#f89440] text-white' 
                        : themeDark ? 'bg-neutral-800 text-gray-300 hover:bg-neutral-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('read-embedded') || 'Artikel eingebettet lesen (Desktop)'}</span>
                <span className="text-xs text-gray-500">{t('read-embedded-desc') || 'Artikel direkt als Overlay lesen, anstatt im neuen Tab.'}</span>
              </div>
              <button 
                onClick={() => setOpenArticlesEmbedded(!settings.openArticlesEmbedded)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.openArticlesEmbedded ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.openArticlesEmbedded ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('share-publicly') || 'Zur gemeinsamen Quellendatenbank beitragen'}</span>
                <span className="text-xs text-gray-500">{t('share-publicly-desc') || 'Neue Inhalte standardmäßig zur allgemeinen Entdecken-Datenbank hinzufügen.'}</span>
              </div>
              <button 
                onClick={() => setShareSourcesPublicly(!settings.shareSourcesPublicly)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.shareSourcesPublicly ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.shareSourcesPublicly ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('show-top-aktuell') || 'Bereich "Top Aktuell" anzeigen'}</span>
                <span className="text-xs text-gray-500">
                  {t('show-top-aktuell-desc') || 'Zeige den kompakten Bereich mit den 10 am besten bewerteten Beiträgen.'}
                </span>
              </div>
              <button 
                onClick={() => setShowTopAktuell(settings.showTopAktuell === undefined ? false : !settings.showTopAktuell)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.showTopAktuell !== false ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showTopAktuell !== false ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('show-ambient-waves') || 'Hintergrund-Wellen-Animation'}</span>
                <span className="text-xs text-gray-500">
                  {t('show-ambient-waves-desc') || 'Die dynamische, farbige Wellen-Animation im Hintergrund ein- oder ausschalten.'}
                </span>
              </div>
              <button 
                onClick={() => setShowAmbientWaves(settings.showAmbientWaves === undefined ? false : !settings.showAmbientWaves)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.showAmbientWaves !== false ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showAmbientWaves !== false ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <span className="font-semibold">{t('visible-sources') || 'Sichtbare Quellen'}</span>
              <div className="flex flex-col gap-3">
                {[
                  { name: t('rss-feeds'), path: '/rss-feeds' },
                  { name: t('podcasts'), path: '/podcasts' },
                  { name: t('radio'), path: '/radio' },
                  { name: t('youtube'), path: '/youtube' },
                  { name: t('webcam'), path: '/webcam' },
                  { name: t('blogs'), path: '/blogs/subscribed' }
                ].map(source => (
                  <div key={source.path} className="flex items-center justify-between gap-4">
                    <span className="text-sm">{source.name}</span>
                    <button 
                      onClick={() => toggleSourceVisibility(source.path)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${!(settings.hiddenSources || []).includes(source.path) ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${!(settings.hiddenSources || []).includes(source.path) ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <div className="flex flex-col">
                <span className="font-semibold">{t('opml-data') || 'OPML Daten'}</span>
                <span className="text-xs text-gray-500">{t('opml-data-desc') || 'Feeds importieren oder exportieren.'}</span>
              </div>
              <div className="flex gap-2">
                <input type="file" ref={fileInputRef} className="hidden" accept=".opml,.xml" onChange={handleImportOPML} />
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all">
                  <Download className="w-4 h-4" /> Import
                </button>
                <button onClick={handleExportOPML} className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 transition-all">
                  <Upload className="w-4 h-4" /> Export
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

