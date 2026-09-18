
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Upload, Download, Camera, Trash2, Check, User as UserIcon, Loader2, Mail, LogIn } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { auth, db, storage, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, onSnapshot, query, addDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { exportToOPML, importFromOPML } from '../lib/opml';

export function SettingsPage() {
  const { settings, toggleTheme, setOpenArticlesEmbedded, setViewMode, setStartPage, setShareSourcesPublicly, setShowTopAktuell, setShowAmbientWaves, setShowVoting, setLanguage, toggleSourceVisibility } = useSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [feeds, setFeeds] = useState<any[]>([]);

  // User & Avatar management
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(auth.currentUser);
  const [avatarUrl, setAvatarUrl] = useState<string>('');
  const [nameInput, setNameInput] = useState<string>('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        setNameInput(user.displayName || '');
        try {
          const userSnap = await getDoc(doc(db, 'users', user.uid));
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.avatarUrl) {
              setAvatarUrl(data.avatarUrl);
            } else if (user.photoURL) {
              setAvatarUrl(user.photoURL);
            }
            if (data.displayName && !user.displayName) {
              setNameInput(data.displayName);
            }
          } else if (user.photoURL) {
            setAvatarUrl(user.photoURL);
          }
        } catch (e) {
          console.error('Error fetching user profile in settings:', e);
          if (user.photoURL) setAvatarUrl(user.photoURL);
        }
      } else {
        setAvatarUrl('');
        setNameInput('');
      }
    });
    return () => unsubscribeAuth();
  }, []);

  const compressAvatar = (file: File, maxDim = 320): Promise<Blob | File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob && blob.size < file.size) {
                resolve(blob);
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.85
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !currentUser) return;
    const file = e.target.files[0];
    setUploadingAvatar(true);

    try {
      const storageRef = ref(storage, `avatars/${currentUser.uid}/${Date.now()}_${file.name}`);
      const compressed = await compressAvatar(file, 320);
      const snapshot = await uploadBytes(storageRef, compressed);
      const downloadURL = await getDownloadURL(snapshot.ref);

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { avatarUrl: downloadURL }, { merge: true });
      try {
        await updateProfile(currentUser, { photoURL: downloadURL });
      } catch (err) {
        console.warn('updateProfile photoURL notice:', err);
      }
      setAvatarUrl(downloadURL);
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentUser) return;
    setUploadingAvatar(true);
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { avatarUrl: '' }, { merge: true });
      try {
        await updateProfile(currentUser, { photoURL: '' });
      } catch (err) {
        console.warn('updateProfile clear photoURL notice:', err);
      }
      setAvatarUrl('');
    } catch (err) {
      console.error('Avatar remove failed:', err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveName = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentUser || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const trimmed = nameInput.trim();
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { displayName: trimmed }, { merge: true });
      try {
        await updateProfile(currentUser, { displayName: trimmed });
      } catch (err) {
        console.warn('updateProfile displayName notice:', err);
      }
      setNameSaved(true);
      setTimeout(() => setNameSaved(false), 2500);
    } catch (err) {
      console.error('Error saving display name:', err);
    } finally {
      setSavingName(false);
    }
  };

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
    { value: '/youtube', label: t('youtube') || 'YouTube' }
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

        {/* Account & Avatar Card */}
        <div id="account" className={`p-6 rounded-2xl border mb-6 backdrop-blur-md ${themeDark ? 'bg-neutral-900/40 border-white/10' : 'bg-white/60 border-gray-200/80 shadow-sm'}`}>
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2.5">
                <UserIcon className="w-5 h-5 text-orange-500" />
                {settings.language === 'en' ? 'Account & Avatar' :
                 settings.language === 'fr' ? 'Compte & Avatar' :
                 settings.language === 'es' ? 'Cuenta y Avatar' : 'Konto & Profilbild'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings.language === 'en' ? 'Manage your avatar photo and account display name.' :
                 settings.language === 'fr' ? 'Gérez votre photo de profil et votre nom d\'affichage.' :
                 settings.language === 'es' ? 'Administra tu foto de perfil y nombre para mostrar.' : 'Verwalte dein Profilfoto und deinen Anzeigenamen.'}
              </p>
            </div>
          </div>

          {currentUser ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pt-2">
              {/* Avatar Circle & Action */}
              <div className="flex items-center gap-4">
                <div className="relative group">
                  <div className={`w-20 h-20 rounded-full overflow-hidden border-2 transition-all flex items-center justify-center shrink-0 ${
                    themeDark ? 'border-orange-500/40 bg-neutral-800' : 'border-orange-500/30 bg-orange-50 shadow-sm'
                  }`}>
                    {uploadingAvatar ? (
                      <div className="flex flex-col items-center justify-center text-orange-500 gap-1">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : avatarUrl ? (
                      <img 
                        src={avatarUrl} 
                        alt="Avatar" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                      />
                    ) : (
                      <div className="text-orange-500 font-black text-2xl tracking-wider select-none">
                        {(nameInput || currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <input 
                    type="file" 
                    ref={avatarInputRef} 
                    className="hidden" 
                    accept="image/png,image/jpeg,image/webp,image/gif" 
                    onChange={handleAvatarUpload} 
                    disabled={uploadingAvatar}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {uploadingAvatar ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{settings.language === 'en' ? 'Uploading...' : 'Lädt hoch...'}</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5" />
                          <span>{settings.language === 'en' ? 'Change Photo' :
                                settings.language === 'fr' ? 'Changer la photo' :
                                settings.language === 'es' ? 'Cambiar foto' : 'Foto ändern'}</span>
                        </>
                      )}
                    </button>

                    {avatarUrl && (
                      <button
                        type="button"
                        onClick={handleRemoveAvatar}
                        disabled={uploadingAvatar}
                        title={settings.language === 'en' ? 'Remove picture' : 'Foto entfernen'}
                        className={`p-1.5 rounded-xl text-xs transition-all border cursor-pointer ${
                          themeDark 
                            ? 'border-white/10 text-neutral-400 hover:text-red-400 hover:bg-red-500/10' 
                            : 'border-gray-200 text-neutral-500 hover:text-red-600 hover:bg-red-50'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400">
                    JPG, PNG, GIF, WebP
                  </span>
                </div>
              </div>

              {/* Divider on desktop */}
              <div className="hidden sm:block w-px h-14 bg-gray-200 dark:bg-white/10 mx-2" />

              {/* Name & Email Inputs */}
              <div className="flex-1 w-full flex flex-col gap-3">
                <form onSubmit={handleSaveName} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder={settings.language === 'en' ? 'Your Name' : 'Dein Name'}
                      maxLength={50}
                      className={`w-full px-3.5 py-2 text-sm rounded-xl border transition-all focus:outline-none focus:ring-2 focus:ring-orange-500 ${
                        themeDark 
                          ? 'bg-neutral-800/80 border-white/10 text-white placeholder-neutral-500' 
                          : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'
                      }`}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={savingName || !nameInput.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      nameSaved 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-neutral-200 dark:bg-neutral-800 hover:bg-orange-500 hover:text-white text-neutral-800 dark:text-neutral-200'
                    } disabled:opacity-50`}
                  >
                    {savingName ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : nameSaved ? (
                      <>
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{settings.language === 'en' ? 'Saved' : 'Gespeichert'}</span>
                      </>
                    ) : (
                      <span>{settings.language === 'en' ? 'Save' : 'Speichern'}</span>
                    )}
                  </button>
                </form>

                {currentUser.email && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                    <Mail className="w-3.5 h-3.5 opacity-60" />
                    <span>{currentUser.email}</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
                  <UserIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    {settings.language === 'en' ? 'Not signed in' : 'Nicht angemeldet'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {settings.language === 'en' 
                      ? 'Sign in to sync your avatar and settings across all devices.' 
                      : 'Melde dich an, um dein Profilbild und deine Einstellungen geräteübergreifend zu synchronisieren.'}
                  </p>
                </div>
              </div>
              <Link 
                to="/login" 
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-orange-500 text-white hover:bg-orange-600 transition-colors shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{settings.language === 'en' ? 'Sign In' : 'Anmelden'}</span>
              </Link>
            </div>
          )}
        </div>

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
                id="toggle-ambient-waves-btn"
                onClick={() => setShowAmbientWaves(!settings.showAmbientWaves)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.showAmbientWaves ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showAmbientWaves ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="font-semibold">{t('show-voting') || 'Community-Voting aktivieren'}</span>
                <span className="text-xs text-gray-500">
                  {t('show-voting-desc') || 'Upvote- und Downvote-Schaltflächen für Beiträge und Feeds einblenden.'}
                </span>
              </div>
              <button 
                id="toggle-voting-btn"
                onClick={() => setShowVoting(!settings.showVoting)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${settings.showVoting ? 'bg-orange-500' : 'bg-gray-200 dark:bg-gray-700'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.showVoting ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            
            <div className="flex flex-col gap-4 pt-4 border-t border-gray-200 dark:border-white/10">
              <span className="font-semibold">{t('visible-sources') || 'Sichtbare Quellen'}</span>
              <div className="flex flex-col gap-3">
                {[
                  { name: t('rss-feeds'), path: '/rss-feeds' },
                  { name: t('podcasts'), path: '/podcasts' },
                  { name: t('radio'), path: '/radio' },
                  { name: t('youtube'), path: '/youtube' }
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

