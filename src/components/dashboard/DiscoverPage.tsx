import { tr } from '../../lib/t';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { useMedia } from '../../context/MediaContext';
import { Compass, Rss, Podcast, Youtube, Radio, Plus, Minus, Search, Camera, Loader2, Upload, Edit3, X, FileText, Play, Trash2, User, Check, ShieldAlert, Zap, ArrowRight } from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { addDoc, collection, doc, deleteDoc, updateDoc, onSnapshot, query, where, getDocs, limit } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { FEED_CATEGORIES } from '../../lib/constants';
import { handleInternalLinkClick } from '../../lib/utils';
import { usePlan } from '../../hooks/usePlan';
import { LimitReachedModal } from './LimitReachedModal';
import { useCustomModal } from '../../context/ModalContext';
import { isAdminEmail } from '../../lib/admin';


const getFlagEmoji = (lang: string | undefined): string => {
  if (!lang) return '🇩🇪';
  const l = lang.toLowerCase();
  switch (l) {
    case 'de': return '🇩🇪';
    case 'en': return '🇬🇧';
    case 'fr': return '🇫🇷';
    case 'es': return '🇪🇸';
    case 'it': return '🇮🇹';
    case 'pt': return '🇵🇹';
    default: return '🌐';
  }
};

export function DiscoverPage() {
  const { t } = useTranslation();
  const { isAtLimit } = usePlan();
  const { showConfirm } = useCustomModal();
  const [limitModal, setLimitModal] = useState<{isOpen: boolean, type: any}>({ isOpen: false, type: 'rss' });
  const { settings, searchQuery } = useSettings();
  const { setPlayingAudio } = useMedia();
  const { category = 'feeds' } = useParams();
  const navigate = useNavigate();
  const isDark = settings.theme === 'dark';
  const isEn = settings.language === 'en';

  const [isOpen, setIsOpen] = useState(false);
  const [type, setType] = useState('feeds');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [feedCategory, setFeedCategory] = useState(FEED_CATEGORIES[0]);
  const [radioGenre, setRadioGenre] = useState('Pop');
  const [sourceLanguage, setSourceLanguage] = useState('de');
  const [icon, setIcon] = useState<string | null>(null);
  const [sharePublicly, setSharePublicly] = useState(settings.shareSourcesPublicly);
  const [loading, setLoading] = useState(false);
  const [dbFilterCategory, setDbFilterCategory] = useState<string>('Alle');
  const [dbFilterLanguage, setDbFilterLanguage] = useState<string>('Alle');
  const [sortBy, setSortBy] = useState<'default' | 'abc' | 'subscribed'>('default');
  
  const [editingSource, setEditingSource] = useState<any>(null); // { id, title, url, category, imageUrl, faviconUrl, isRadio }
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  const renderSortToggle = (themeColor: 'orange' | 'purple' | 'red' | 'blue' | 'emerald' | 'yellow') => {
    const activeBg = 
      themeColor === 'orange' ? 'bg-orange-500 text-white' :
      themeColor === 'purple' ? 'bg-purple-500 text-white' :
      themeColor === 'red' ? 'bg-red-500 text-white' :
      themeColor === 'blue' ? 'bg-blue-500 text-white' :
      themeColor === 'emerald' ? 'bg-emerald-500 text-white' :
      'bg-yellow-500 text-black font-bold';

    return (
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-xs font-semibold ${isDark ? 'text-white/40' : 'text-gray-500'}`}>
          {tr(settings.language, 'Sort:', 'Sortierung:')}
        </span>
        <div className={`flex rounded-lg p-0.5 border ${isDark ? 'bg-neutral-900 border-white/10' : 'bg-gray-100 border-gray-200'}`}>
          <button
            onClick={() => setSortBy('default')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              sortBy === 'default'
                ? activeBg
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            {tr(settings.language, 'Featured', 'Beliebt')}
          </button>
          <button
            onClick={() => setSortBy('abc')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              sortBy === 'abc'
                ? activeBg
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            A-Z
          </button>
          <button
            onClick={() => setSortBy('subscribed')}
            className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
              sortBy === 'subscribed'
                ? activeBg
                : (isDark ? 'text-white/60 hover:text-white' : 'text-gray-500 hover:text-gray-900')
            }`}
          >
            {tr(settings.language, 'Subscribed', 'Abonniert')}
          </button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    document.title = isEn ? `${categoryName} Organize | RSSer News` : `${categoryName} organisieren | RSSer News`;
  }, [category, isEn]);

  const showToast = (msg: string) => {
     const el = document.createElement('div');
     el.className = 'fixed bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900 text-white px-6 py-3 rounded-full z-[9999] font-medium text-sm transition-opacity duration-300';
     el.innerText = msg;
     document.body.appendChild(el);
     setTimeout(() => {
        el.style.opacity = '0';
        setTimeout(() => el.remove(), 300);
     }, 3000);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !editingSource) return;
    setEditUploading(true);
    try {
      let docRef;
      if (editingSource.isPublic) {
        docRef = doc(db, 'publicSources', editingSource.id);
      } else {
        const collectionName = editingSource.isRadio ? 'radioStations' : 'feeds';
        docRef = doc(db, 'users', auth.currentUser.uid, collectionName, editingSource.id);
      }
      
      let newImageUrl = editingSource.imageUrl || editingSource.faviconUrl;
      
      if (editFile) {
        newImageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const max_size = 128;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > max_size) {
                  height *= max_size / width;
                  width = max_size;
                }
              } else {
                if (height > max_size) {
                  width *= max_size / height;
                  height = max_size;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              ctx?.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
            img.onerror = () => reject(new Error('Invalid image'));
            img.src = ev.target?.result as string;
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(editFile);
        });
      }
      
      const updateData: any = {
        title: editingSource.title,
        url: editingSource.url
      };
      
      if (editingSource.language !== undefined) {
         updateData.language = editingSource.language;
      }
      
      if (!editingSource.isRadio) {
        if (editingSource.category) updateData.category = editingSource.category;
        if (newImageUrl) updateData.imageUrl = newImageUrl;
      } else {
        if (editingSource.category) updateData.category = editingSource.category;
        if (newImageUrl) {
          updateData.faviconUrl = newImageUrl;
          updateData.imageUrl = newImageUrl;
        }
      }
      
      await updateDoc(docRef, updateData);
      setEditingSource(null);
      setEditFile(null);
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Fehler beim Speichern');
    } finally {
      setEditUploading(false);
    }
  };

  const getRootDomain = (urlStr: string) => {
    try {
      const hostname = new URL(urlStr).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const secondToLast = parts[parts.length - 2];
        const tlds = ['com', 'co', 'org', 'net', 'edu', 'gov', 'ac', 'de', 'ch', 'at'];
        if (tlds.includes(secondToLast)) {
          return parts.slice(-3).join('.');
        }
        return parts.slice(-2).join('.');
      }
      return hostname;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    if (category === 'feeds' || category === 'podcasts' || category === 'youtube' || category === 'radio' || category === 'webcams' || category === 'blogs') {
      setType(category);
      setDbFilterCategory('Alle');
      setDbFilterLanguage('Alle');
    }
  }, [category]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit before resize
         showToast("Bild ist zu gross. Bitte ein kleineres Bild wählen.");
         return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const max_size = 128;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > max_size) {
              height *= max_size / width;
              width = max_size;
            }
          } else {
            if (height > max_size) {
              width *= max_size / height;
              height = max_size;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          setIcon(dataUrl);
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !url) return;
    setLoading(true);

    try {
      if (type === 'radio') {
        if (!title) {
          showToast('Titel ist für Radio Sender erforderlich.');
          setLoading(false);
          return;
        }
        await addDoc(collection(db, 'users', auth.currentUser.uid, 'radioStations'), {
          title,
          url,
          category: radioGenre,
          language: sourceLanguage,
          faviconUrl: icon || null,
          addedAt: Date.now()
        });

        if (sharePublicly) {
          try {
            await addDoc(collection(db, 'publicSources'), {
              title,
              url,
              category: radioGenre,
              language: sourceLanguage,
              type: 'radio',
              imageUrl: icon || null,
              addedBy: auth.currentUser.uid,
              addedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("error adding to public sources", e);
          }
        }

        showToast(`"${title}" wurde erfolgreich hinzugefügt!`);
      } else if (type === 'webcams') {
        if (!title) {
          showToast('Titel ist für WebCams erforderlich.');
          setLoading(false);
          return;
        }

        let ytThumbnail = icon || null;
        if (!ytThumbnail && url) {
           const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
           if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
        }

        await addDoc(collection(db, 'users', auth.currentUser.uid, 'feeds'), {
          userId: auth.currentUser.uid,
          title,
          url,
          category: 'WebCam',
          language: sourceLanguage,
          type: 'webcams',
          imageUrl: ytThumbnail,
          addedAt: Date.now()
        });

        if (sharePublicly) {
          try {
            await addDoc(collection(db, 'publicSources'), {
              title,
              url,
              category: 'WebCam',
              language: sourceLanguage,
              type: 'webcams',
              imageUrl: ytThumbnail,
              addedBy: auth.currentUser.uid,
              addedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("error adding to public sources", e);
          }
        }
        showToast(`"${title}" wurde erfolgreich hinzugefügt!`);
      } else {
        const res = await fetch('/api/rss', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url })
        });
        
        let fetchedData: any = {};
        if (res.ok) {
           fetchedData = await res.json();
        } else if (!title) {
           throw new Error('RSS konnte nicht automatisch geladen werden. Bitte Titel manuell eingeben.');
        }

        const finalTitle = title || fetchedData.title || url;
        const imageUrl = icon || fetchedData.image?.url;
        let categoryValue = type === 'radio' ? 'Radio' : (feedCategory || 'Allgemein');
        if (categoryValue === 'Technik') {
          categoryValue = 'Tech';
        }

        const docData: any = {
          userId: auth.currentUser.uid,
          title: finalTitle,
          url,
          category: categoryValue,
          language: sourceLanguage,
          addedAt: Date.now()
        };
        if (imageUrl) docData.imageUrl = imageUrl;
        if (fetchedData.bannerUrl) docData.bannerUrl = fetchedData.bannerUrl;
        if (type === 'podcasts' || fetchedData.isPodcast) docData.isPodcast = true;

        await addDoc(collection(db, 'users', auth.currentUser.uid, 'feeds'), docData);

        if (sharePublicly) {
          try {
            await addDoc(collection(db, 'publicSources'), {
              title: finalTitle,
              url,
              category: categoryValue,
              language: sourceLanguage,
              type: type,
              imageUrl: imageUrl || null,
              addedBy: auth.currentUser.uid,
              addedAt: new Date().toISOString()
            });
          } catch (e) {
            console.error("error adding to public sources", e);
          }
        }

        showToast(`"${finalTitle}" wurde erfolgreich hinzugefügt!`);
      }
      
      setUrl('');
      setTitle('');
      setIcon(null);
      setIsOpen(false);
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Fehler beim Hinzufügen. Bitte überprüfe die URL.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Falls man auf /discover ist, pushe nach /discover/feeds
    if (window.location.pathname === '/discover') {
      navigate('/discover/feeds', { replace: true });
    }
  }, [navigate]);

  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [previewingIds, setPreviewingIds] = useState<string[]>([]);
  const [publicFeeds, setPublicFeeds] = useState<any[]>([]);

  // Management State
  const [userFeeds, setUserFeeds] = useState<any[]>([]);
  const [userRadio, setUserRadio] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const handlePreviewPodcast = async (feedUrl: string, title: string, imageUrl?: string | null) => {
    setPreviewingIds(prev => [...prev, feedUrl]);
    try {
      const res = await fetch('/api/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: feedUrl })
      });
      if (res.ok) {
        const data = await res.json();
        const firstAudioItem = data.items?.find((i: any) => i.enclosure?.url && i.enclosure.type?.startsWith('audio/'));
        if (firstAudioItem?.enclosure?.url) {
           setPlayingAudio({
             title: firstAudioItem.title || title,
             url: firstAudioItem.enclosure.url,
             feedTitle: title,
             imageUrl: imageUrl || data.image?.url || null
           });
        } else {
           showToast("Keine Audio-Datei in diesem Feed gefunden.");
        }
      } else {
         showToast("Fehler beim Laden des Podcasts.");
      }
    } catch (e) {
      console.error(e);
      showToast("Fehler beim Laden des Podcasts.");
    } finally {
      setPreviewingIds(prev => prev.filter(url => url !== feedUrl));
    }
  };

  const handlePreviewRadio = (url: string, title: string, imageUrl?: string | null) => {
    setPlayingAudio({
      title: title,
      url: url,
      feedTitle: "Live Radio",
      imageUrl: imageUrl || null
    });
  };

  useEffect(() => {
    // Fetch generic public sources from server API to save Firestore reads
    const fetchPublicSources = async () => {
      try {
        const res = await fetch('/api/public-sources');
        if (res.ok) {
          const data = await res.json();
          setPublicFeeds(data);
        }
      } catch (e) {
        console.error("Failed to fetch public sources", e);
      }
    };
    fetchPublicSources();

    let feedsUnsub: (() => void) | undefined;
    let radioUnsub: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
      // Clean up previous listeners if auth state changes
      if (feedsUnsub) feedsUnsub();
      if (radioUnsub) radioUnsub();

      setIsAdmin(isAdminEmail(user?.email));
      if (user) {
        feedsUnsub = onSnapshot(query(collection(db, 'users', user.uid, 'feeds')), snapshot => {
          setUserFeeds(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, error => {
          if (!error.message?.includes('CANCELLED')) {
            handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/feeds`);
          }
        });
        radioUnsub = onSnapshot(query(collection(db, 'users', user.uid, 'radioStations')), snapshot => {
          setUserRadio(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        }, error => {
          if (!error.message?.includes('CANCELLED')) {
            handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/radioStations`);
          }
        });
      }
    });

    return () => { 
      unsubscribeAuth(); 
      if (feedsUnsub) feedsUnsub();
      if (radioUnsub) radioUnsub();
    };
  }, []);

  const handleDeleteFeed = async (id: string, isRadio: boolean) => {
    if (!auth.currentUser) return;
    const confirmed = await showConfirm(
      settings.language === 'en' ? 'Are you sure you want to delete this entry?' : 'Möchtest du diesen Eintrag wirklich löschen?',
      settings.language === 'en' ? 'Delete entry' : 'Eintrag löschen'
    );
    if (confirmed) {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, isRadio ? 'radioStations' : 'feeds', id));
    }
  };

  const handleDeletePublicFeed = async (id: string) => {
    if (!isAdmin) return;
    const confirmed = await showConfirm(
      settings.language === 'en' ? 'Are you sure you want to delete this public entry?' : 'Diesen öffentlichen Eintrag wirklich löschen?',
      settings.language === 'en' ? 'Delete public entry' : 'Öffentlichen Eintrag löschen'
    );
    if (confirmed) {
      await deleteDoc(doc(db, 'publicSources', id));
    }
  };

  const handleOpenFeedChannel = (feed: any) => {
    if (!feed) return;
    const isYouTube = feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be') || feed.category === 'YouTube' || feed.type === 'youtube';
    const isWebCam = feed.category === 'WebCam' || feed.type === 'webcams';
    const isPodcast = feed.category === 'Podcast' || feed.isPodcast || feed.type === 'podcasts';
    const isBlog = feed.type === 'blogs' || feed.category === 'Blogs' || feed.category === 'blogs';
    const isRadio = feed.category === 'Radio' || feed.type === 'radio' || feed.isRadio;

    let targetPath = '/rss-feeds';
    if (isYouTube) targetPath = '/youtube';
    else if (isPodcast) targetPath = '/podcasts';
    else if (isWebCam) targetPath = '/webcam';
    else if (isBlog) targetPath = '/rss-feeds';
    else if (isRadio) targetPath = '/radio';

    navigate(`${targetPath}?channel=${feed.id}`, { state: { selectedChannelId: feed.id } });
  };

  const handleDiscoverCardClick = (e: React.MouseEvent, item: any, isAlreadyAdded: boolean) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return; 
    }

    if (isAlreadyAdded) {
      const matchingUserFeed = userFeeds.find(f => f.url === item.url);
      if (matchingUserFeed) {
        handleOpenFeedChannel(matchingUserFeed);
      } else {
        const matchingUserRadio = userRadio.find(r => r.url === item.url);
        if (matchingUserRadio) {
          handleOpenFeedChannel(matchingUserRadio);
        }
      }
    } else if (item.id && (userFeeds.some(f => f.id === item.id) || userRadio.some(r => r.id === item.id))) {
      handleOpenFeedChannel(item);
    }
  };

  const handleAddFeed = async (title: string, url: string, cat: string, itemType?: string, customImageUrl?: string | null, authorInfo?: { name: string, bio?: string, avatar?: string, banner?: string, bannerOffset?: number }) => {
    if (!auth.currentUser || !url) {
      showToast("Feed URL fehlt");
      return;
    }

    // Plan Limit Checks
    const typeKey = (itemType || 'feeds') === 'feeds' ? 'rss' : 
                   (itemType === 'podcasts' ? 'podcast' : 
                   (itemType === 'youtube' ? 'youtube' : 
                   (itemType === 'webcams' ? 'webcam' : 
                   (itemType === 'blogs' ? 'blogs' : 'rss'))));

    if (isAtLimit(typeKey as any)) {
      setLimitModal({ isOpen: true, type: typeKey });
      return;
    }
    
    setAddingIds(prev => [...prev, title]);
    try {
      let imageUrl = customImageUrl || null;
      let bannerUrl = authorInfo?.banner || authorInfo?.avatar || null;

      if (!imageUrl && !authorInfo) {
        if (itemType === 'webcams') {
          const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          if (match && match[1]) {
             imageUrl = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
          }
        } else {
          const res = await fetch('/api/rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
          });
          
          if (res.ok) {
             const data = await res.json();
             imageUrl = data.image?.url;
             bannerUrl = data.bannerUrl;
          }
        }
      }

      const feedsRef = collection(db, 'users', auth.currentUser.uid, 'feeds');
      const docData: any = {
        userId: auth.currentUser.uid,
        title,
        url,
        category: cat
      };
      
      if (authorInfo) {
        docData.authorName = authorInfo.name;
        docData.authorBio = authorInfo.bio;
        docData.authorAvatar = authorInfo.avatar;
        docData.authorBanner = authorInfo.banner;
        docData.authorBannerOffset = authorInfo.bannerOffset;
        if (authorInfo.avatar && !imageUrl) imageUrl = authorInfo.avatar;
      }

      if (imageUrl) docData.imageUrl = imageUrl;
      if (bannerUrl) docData.bannerUrl = bannerUrl;
      if (itemType) docData.type = itemType;

      await addDoc(feedsRef, docData);
      showToast(`"${title}" wurde zu deinen Feeds hinzugefügt!`);
    } catch (error) {
      console.error(error);
      showToast('Fehler beim Hinzufügen');
    } finally {
      setAddingIds(prev => prev.filter(id => id !== title));
    }
  };

  const handleAddRadio = async (title: string, url: string, imageUrl?: string, category?: string) => {
    if (!auth.currentUser || !url) {
      showToast("Stream URL fehlt");
      return;
    }
    
    if (isAtLimit('radio')) {
      setLimitModal({ isOpen: true, type: 'radio' });
      return;
    }

    setAddingIds(prev => [...prev, title]);
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'radioStations'), {
        title,
        url,
        imageUrl: imageUrl || null,
        category: category || 'Pop',
        addedAt: Date.now()
      });
      showToast(`"${title}" wurde zu deinen Radiosendern hinzugefügt!`);
    } catch (error) {
      console.error(error);
      showToast('Fehler beim Hinzufügen');
    } finally {
      setAddingIds(prev => prev.filter(id => id !== title));
    }
  };

  const isWebCamItem = (p: any) => p.type === 'webcams' || p.category === 'WebCam' || (p.url && (p.url.includes('/watch') || p.url.includes('youtu.be/')));
  const isYouTubeItem = (p: any) => (p.type === 'youtube' || p.category === 'YouTube' || (p.url && (p.url.includes('/@') || p.url.includes('/channel/') || p.url.includes('/c/') || p.url.includes('feeds/videos.xml')))) && !isWebCamItem(p);
  const isFeedItem = (p: any) => p.type === 'feeds' || (!p.type && !p.isPodcast && p.category !== 'YouTube' && p.category !== 'Podcast' && p.category !== 'Radio' && !isYouTubeItem(p) && !isWebCamItem(p));

  return (
    <div className="space-y-8 max-w-[2400px] mx-auto pb-12 px-4 md:px-8">
      <div className="space-y-12 mt-4">
        
        {category !== 'blogs' && category !== 'Blogs' && type !== 'blogs' && (
        <div className={`rounded-2xl border overflow-hidden ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'}`}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="w-full flex items-center justify-between p-6 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl flex items-center justify-center ${
                type === 'youtube' ? (isDark ? 'bg-red-500/20 text-red-500' : 'bg-red-500/10 text-red-600') :
                type === 'radio' ? (isDark ? 'bg-blue-500/20 text-blue-500' : 'bg-blue-500/10 text-blue-600') :
                type === 'podcasts' ? (isDark ? 'bg-purple-500/20 text-purple-500' : 'bg-purple-500/10 text-purple-600') : 
                type === 'webcams' ? (isDark ? 'bg-emerald-500/20 text-emerald-500' : 'bg-emerald-500/10 text-emerald-600') :
                type === 'blogs' ? (isDark ? 'bg-yellow-500/20 text-yellow-500' : 'bg-yellow-500/10 text-yellow-600') :
                (isDark ? 'bg-orange-500/20 text-orange-500' : 'bg-orange-500/10 text-orange-600')
              }`}>
                <Plus className="w-6 h-6" />
              </div>
              <div className="text-left">
                <h3 className="font-bold text-xl">{type === 'youtube' ? (tr(settings.language, 'Add YouTube Channel', 'YouTube Kanal hinzufügen')) : type === 'radio' ? (tr(settings.language, 'Add Radio Station', 'Radio Station hinzufügen')) : type === 'podcasts' ? (tr(settings.language, 'Add Podcast', 'Podcast hinzufügen')) : type === 'feeds' ? (tr(settings.language, 'Add RSS', 'RSS hinzufügen')) : type === 'webcams' ? (tr(settings.language, 'Add WebCam', 'WebCam hinzufügen')) : (tr(settings.language, 'Add Blog', 'Blog hinzufügen'))}</h3>
                <p className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {type === 'youtube' ? (tr(settings.language, 'Add your favorite YouTube channels', 'Füge deine Lieblings-YouTube-Kanäle hinzu')) : type === 'radio' ? (tr(settings.language, 'Add your favorite radio station streams', 'Füge deine Lieblings-Radiosender-Streams hinzu')) : type === 'podcasts' ? (tr(settings.language, 'Add your favorite podcasts', 'Füge deine Lieblings-Podcasts hinzu')) : type === 'feeds' ? (tr(settings.language, 'Add your favorite RSS feeds', 'Füge deine Lieblings-RSS-Feeds hinzu')) : type === 'webcams' ? (tr(settings.language, 'Add own WebCams', 'Füge eigene WebCams hinzu')) : (tr(settings.language, 'Add your favorite blogs', 'Füge deine Lieblings-Blogs hinzu'))}
                </p>
              </div>
            </div>
            <div className={`transform transition-transform ${isOpen ? 'rotate-45' : ''}`}>
              <Plus className="w-6 h-6 opacity-50" />
            </div>
          </button>

          {isOpen && (
            <div className={`p-6 pt-0 border-t ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
              <form onSubmit={handleManualSubmit} className="flex flex-col gap-6 mt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Type dropdown removed as requested */}

                  <label className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">URL {type === 'radio' && <span className="text-orange-500">*</span>}</span>
                    <input required type="url" placeholder={
                      type === 'radio' ? (tr(settings.language, 'Stream URL (e.g. http://...)', 'Stream-URL (z.B. http://...)')) :
                      type === 'youtube' ? (tr(settings.language, 'YouTube URL (e.g. https://www.youtube.com/@jimmycarr)', 'YouTube-URL (z.B. https://www.youtube.com/@jimmycarr)')) :
                      type === 'webcams' ? (tr(settings.language, 'Webcam URL (e.g. https://www.youtube.com/watch?v=rnXIjl_Rzy4)', 'Webcam-URL (z.B. https://www.youtube.com/watch?v=rnXIjl_Rzy4)')) :
                      'https://.../rss.xml'
                    } value={url} onChange={e => setUrl(e.target.value)} className={`p-3 outline-none focus:ring-2 focus:ring-orange-500 rounded-lg border ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`} />
                  </label>

                  <label className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">{tr(settings.language, 'Title', 'Titel')} {type === 'radio' ? <span className="text-orange-500">*</span> : <span className="opacity-50">(Optional)</span>}</span>
                    <input required={type === 'radio'} type="text" placeholder={tr(settings.language, "My Station / Feed", "Mein Sender / Feed")} value={title} onChange={e => setTitle(e.target.value)} className={`p-3 outline-none focus:ring-2 focus:ring-orange-500 rounded-lg border ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`} />
                  </label>

                  {type === 'radio' ? (
                    <label className="flex flex-col gap-2">
                      <span className="font-semibold text-sm">Genre</span>
                      <select value={radioGenre} onChange={e => setRadioGenre(e.target.value)} className={`p-3 rounded-lg border appearance-none outline-none focus:ring-2 focus:ring-orange-500 ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`}>
                        <option value="Pop">Pop</option>
                        <option value="60s">60s</option>
                        <option value="70s">70s</option>
                        <option value="80s">80s</option>
                        <option value="90s">90s</option>
                        <option value="Game Music">Game Music</option>
                        <option value="Black">Black</option>
                        <option value="Rock">Rock</option>
                        <option value="Heavy Metal">Heavy Metal</option>
                        <option value="Relax">Relax</option>
                        <option value="KPop">KPop</option>
                        <option value="Nachrichten">{t('cat-Nachrichten', 'Nachrichten')}</option>
                        <option value="Klassik">{t('cat-Klassik', 'Klassik')}</option>
                        <option value="Dance / Electronic">Dance / Electronic</option>
                        <option value="Hip Hop">Hip Hop</option>
                        <option value="Jazz">Jazz</option>
                        <option value="Country">Country</option>
                        <option value="Volksmusik">{t('cat-Volksmusik', 'Volksmusik')}</option>
                        <option value="Rap">Rap</option>
                        <option value="Schlager">{t('cat-Schlager', 'Schlager')}</option>
                        <option value="Techno">Techno</option>
                      </select>
                    </label>
                  ) : type === 'webcams' ? (
                    <label className="flex flex-col gap-2">
                      <span className="font-semibold text-sm">{tr(settings.language, 'Category', 'Kategorie')}</span>
                      <select 
                        value={feedCategory} 
                        onChange={e => setFeedCategory(e.target.value)} 
                        className={`p-3 outline-none focus:ring-2 focus:ring-emerald-500 rounded-lg border appearance-none ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`}
                      >
                        <option value="WebCam">{t('cat-Allgemein', 'Allgemein')}</option>
                        <option value="Tiere">{t('cat-Tiere', 'Tiere')}</option>
                        <option value="Reisen">{t('cat-Reisen', 'Reisen')}</option>
                        <option value="Weltraum">{t('cat-Weltraum', 'Weltraum')}</option>
                        <option value="Natur">{t('cat-Natur', 'Natur')}</option>
                        <option value="Stadt">{t('cat-Stadt', 'Stadt')}</option>
                      </select>
                    </label>
                  ) : (type === 'feeds' || type === 'youtube' || type === 'podcasts') && (
                    <label className="flex flex-col gap-2">
                      <span className="font-semibold text-sm">{tr(settings.language, 'Category', 'Kategorie')}</span>
                      <select 
                        value={feedCategory} 
                        onChange={e => setFeedCategory(e.target.value)} 
                        className={`p-3 outline-none focus:ring-2 focus:ring-orange-500 rounded-lg border appearance-none ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`}
                      >
                        <option value="" disabled>{tr(settings.language, 'Please select...', 'Bitte wählen...')}</option>
                        {FEED_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">{tr(settings.language, 'Custom Icon / Favicon', 'Eigenes Icon / Favicon')} <span className="opacity-50">(Optional)</span></span>
                    <div className="flex items-center gap-4">
                      {icon ? (
                        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-gray-200">
                          <img loading="lazy" src={icon} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          <button type="button" onClick={() => setIcon(null)} className="absolute top-0 right-0 bg-black/50 hover:bg-red-500 text-white w-6 h-6 flex items-center justify-center rounded-bl-xl backdrop-blur-md transition-colors">
                             ✕
                          </button>
                        </div>
                      ) : (
                        <label className={`w-16 h-16 flex items-center justify-center rounded-xl border-2 border-dashed cursor-pointer hover:opacity-80 transition-opacity ${isDark ? 'border-white/20 bg-black' : 'border-gray-300 bg-gray-50'}`}>
                          <Upload className="w-5 h-5 opacity-50" />
                          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                        </label>
                      )}
                      <div className={`text-xs ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                        {tr(settings.language, 'Preferably square format (PNG, JPG, WEBP).', 'Vorzugsweise quadratisches Format (PNG, JPG, WEBP).')}<br/>{tr(settings.language, 'Max. 2MB.', 'Max. 2MB.')}
                      </div>
                    </div>
                  </div>

                  <label className="flex flex-col gap-2">
                    <span className="font-semibold text-sm">{tr(settings.language, 'Language', 'Sprache')}</span>
                    <select 
                      value={sourceLanguage} 
                      onChange={e => setSourceLanguage(e.target.value)} 
                      className={`p-3 outline-none focus:ring-2 focus:ring-orange-500 rounded-lg border appearance-none ${isDark ? 'bg-black border-white/20' : 'bg-gray-50 border-gray-300'}`}
                    >
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="es">🇪🇸 Español</option>
                      <option value="none">🌐 {tr(settings.language, 'Other / None', 'Andere / Keine')}</option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-2">
                  <p className="text-sm opacity-60">
                    {type === 'radio' ? (tr(settings.language, 'Tip: For Radio you need the direct stream link (.mp3, .aac).', 'Tipp: Für Radio brauchst du den direkten Stream-Link (.mp3, .aac).')) : (tr(settings.language, 'Tip: If you leave the icon empty, we try to find it automatically.', 'Tipp: Wenn du das Icon leer lässt, versuchen wir es automatisch zu finden.'))}
                  </p>
                  
                  <button disabled={loading} type="submit" className={`w-full sm:w-auto flex items-center justify-center gap-2 text-white px-8 py-3 rounded-xl font-bold transition-all disabled:opacity-50 ${
                    type === 'youtube' ? 'bg-red-500 hover:bg-red-600' :
                    type === 'radio' ? 'bg-blue-500 hover:bg-blue-600' :
                    type === 'podcasts' ? 'bg-purple-500 hover:bg-purple-600' :
                    type === 'webcams' ? 'bg-emerald-500 hover:bg-emerald-600' :
                    type === 'blogs' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' :
                    'bg-orange-500 hover:bg-orange-600'
                  }`}>
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    {type === 'youtube' ? (tr(settings.language, 'Save YouTube Channel', 'YouTube Kanal speichern')) : type === 'radio' ? (tr(settings.language, 'Save Radio Station', 'Radio Station speichern')) : type === 'podcasts' ? (tr(settings.language, 'Save Podcast', 'Podcast speichern')) : type === 'feeds' ? (tr(settings.language, 'Save RSS Feed', 'RSS Feed speichern')) : type === 'webcams' ? (tr(settings.language, 'Save WebCam', 'WebCam speichern')) : (tr(settings.language, 'Save Blog', 'Blog speichern'))}
                  </button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input 
                    type="checkbox" 
                    checked={sharePublicly} 
                    onChange={e => setSharePublicly(e.target.checked)} 
                    className={`w-5 h-5 rounded border-gray-300 text-orange-500 focus:ring-orange-500 ${isDark ? 'bg-black/50 border-white/20' : ''}`}
                  />
                  <span className="text-sm font-medium">Zur gemeinsamen Quellendatenbank beitragen</span>
                </label>
              </form>
            </div>
          )}
        </div>

        )}

        {category === 'feeds' && (
        <section id="feeds" className="scroll-mt-24">
          <div className="flex items-center gap-2 mb-2">
            <Rss className="w-5 h-5 text-orange-500" />
            <h2 className="text-2xl font-bold">{tr(settings.language, 'RSS to subscribe', 'RSS zum abonnieren')}</h2>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            {['Alle', ...Array.from(new Set(
                publicFeeds.filter(isFeedItem).map(item => item.category?.charAt(0).toUpperCase() + item.category?.slice(1).toLowerCase())
            )).filter(Boolean).sort()].map(cat => (
              <button
                key={cat}
                onClick={() => setDbFilterCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                  dbFilterCategory === cat
                    ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700')
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cat-' + cat, cat)}
              </button>
            ))}
          </div>
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
               {['Alle', 'de', 'en', 'fr', 'es'].map(lang => (
                 <button
                   key={lang}
                   onClick={() => setDbFilterLanguage(lang)}
                   className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                     dbFilterLanguage === lang
                       ? (isDark ? 'bg-orange-500/20 text-orange-400' : 'bg-orange-100 text-orange-700')
                       : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                   }`}
                 >
                   {lang === 'Alle' ? t('cat-Alle', 'Alle') : lang === 'de' ? '🇩🇪 DE' : lang === 'en' ? '🇬🇧 EN' : lang === 'fr' ? '🇫🇷 FR' : '🇪🇸 ES'}
                 </button>
               ))}
            </div>
            {renderSortToggle('orange')}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                {publicFeeds.filter(isFeedItem)
                  .filter(item => {
                    if (dbFilterCategory === 'Alle') return true;
                    const normalizedCat = item.category?.charAt(0).toUpperCase() + item.category?.slice(1).toLowerCase();
                    return normalizedCat === dbFilterCategory;
                  })
                  .filter(item => dbFilterLanguage === 'Alle' || item.language === dbFilterLanguage || (!item.language && dbFilterLanguage === 'de'))
                  .filter(item => !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.url?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => {
                    if (sortBy === 'subscribed') {
                      const isAlreadyAddedA = userFeeds.some(f => f.url === a.url);
                      const isAlreadyAddedB = userFeeds.some(f => f.url === b.url);
                      if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                      if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                      return (a.title || '').localeCompare(b.title || '');
                    }
                    return sortBy === 'abc' ? (a.title || '').localeCompare(b.title || '') : 0;
                  })
                  .map((item, i) => {
                  const domain = getRootDomain(item.url);
                  const fallbackImage = item.imageUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);
                  const isAlreadyAdded = userFeeds.some(f => f.url === item.url);
                  const matchingFeed = userFeeds.find(f => f.url === item.url);
                  return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSource({...item, isPublic: true, isRadio: item.type === 'radio' || item.isRadio}); }} className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePublicFeed(item.id); }} className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-md transition-colors" title={tr(settings.language, "Delete", "Löschen")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Banner background area */}
                <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500/10 via-yellow-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                  {fallbackImage && (
                    <img loading="lazy" 
                      src={fallbackImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Language badge at top left */}
                  <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                    {getFlagEmoji(item.language)}
                  </div>
                  {/* Category Tag badge at top right */}
                  <div className="absolute top-2 right-2.5 z-20 bg-orange-500/10 dark:bg-orange-500/20 text-[#FF4500] dark:text-orange-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                    {item.category ? t('cat-' + item.category, item.category) : t('cat-Feed', 'Feed')}
                  </div>
                </div>

                {/* Avatar & Card Body container */}
                <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                  {/* Avatar wrapper overlapping the banner */}
                  <div className="absolute -top-7 left-4">
                    <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                      {fallbackImage ? (
                        <img loading="lazy" 
                          src={fallbackImage} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-full bg-black/5" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { 
                            e.currentTarget.style.display = 'none';
                            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                            if (sibling) sibling.style.display = 'flex';
                          }} 
                        />
                      ) : null}
                      <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: fallbackImage ? 'none' : 'flex' }}>
                        {item.title?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="pt-7 pb-2 flex-grow min-w-0">
                    <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-orange-500 transition-colors duration-250`} title={item.title}>
                      {item.title}
                    </h3>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title={domain || item.url}>
                      {domain || item.url}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-end border-t border-gray-100 dark:border-white/5 pt-2">
                    {isAlreadyAdded ? (
                      <button 
                        onClick={() => matchingFeed && handleDeleteFeed(matchingFeed.id, false)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddFeed(item.title, item.url, item.category, 'feeds', fallbackImage)}
                        disabled={addingIds.includes(item.title)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Add / Follow", "Hinzufügen / Folgen")}
                      >
                        {addingIds.includes(item.title) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-500" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5] text-orange-500 hover:text-orange-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
                  );
                })}
          </div>
        </section>
        )}

        {category === 'podcasts' && (
        <section id="podcasts" className="scroll-mt-24">
          <div className="flex items-center gap-2 mb-2">
            <Podcast className="w-5 h-5 text-purple-500" />
            <h2 className="text-2xl font-bold">{tr(settings.language, 'Podcasts to subscribe', 'Podcasts zum abonnieren')}</h2>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            {['Alle', ...Array.from(new Set(
                publicFeeds.filter(p => p.type === 'podcasts' || p.isPodcast || p.category === 'Podcast').map(item => item.category)
            )).sort()].map(cat => (
              <button
                key={cat}
                onClick={() => setDbFilterCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                  dbFilterCategory === cat
                    ? (isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700')
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cat-' + cat, cat)}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
               {['Alle', 'de', 'en', 'fr', 'es'].map(lang => (
                 <button
                   key={lang}
                   onClick={() => setDbFilterLanguage(lang)}
                   className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                     dbFilterLanguage === lang
                       ? (isDark ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-100 text-purple-700')
                       : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                   }`}
                 >
                   {lang === 'Alle' ? t('cat-Alle', 'Alle') : lang === 'de' ? '🇩🇪 DE' : lang === 'en' ? '🇬🇧 EN' : lang === 'fr' ? '🇫🇷 FR' : '🇪🇸 ES'}
                 </button>
               ))}
            </div>
            {renderSortToggle('purple')}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {publicFeeds.filter(p => p.type === 'podcasts' || p.isPodcast || p.category === 'Podcast')
              .filter(item => dbFilterCategory === 'Alle' || item.category === dbFilterCategory)
              .filter(item => dbFilterLanguage === 'Alle' || item.language === dbFilterLanguage || (!item.language && dbFilterLanguage === 'de'))
              .filter(item => !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.url?.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => {
                if (sortBy === 'subscribed') {
                  const isAlreadyAddedA = userFeeds.some(f => f.url === a.url);
                  const isAlreadyAddedB = userFeeds.some(f => f.url === b.url);
                  if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                  if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                  return (a.title || '').localeCompare(b.title || '');
                }
                return sortBy === 'abc' ? (a.title || '').localeCompare(b.title || '') : 0;
              })
              .map((item, i) => {
                const domain = item.url ? getRootDomain(item.url) : null;
                let fallbackImage = item.imageUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);
                const lowerTitle = (item.title || '').toLowerCase();
                const lowerUrl = (item.url || '').toLowerCase();
                if (!item.imageUrl && (lowerTitle.includes('bits und so') || lowerTitle.includes('bitsundso') || lowerUrl.includes('bitsundso') || lowerUrl.includes('bits-und-so'))) {
                  fallbackImage = "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/05/8d/ca/058dcade-ba42-e1cb-47ff-43b5df5b102f/mza_11977799580453303866.jpg/600x600bb.jpg";
                }
                if (fallbackImage && !fallbackImage.startsWith('/') && !fallbackImage.startsWith('data:') && !fallbackImage.startsWith('blob:') && !fallbackImage.includes('/api/image-proxy')) {
                  const knownDirectHosts = [
                    'mzstatic.com', 'ytimg.com', 'spotifycdn.com', 'megaphone.fm', 'libsyn.com', 
                    'podigee.com', 'podigee.io', 'anchor.fm', 'acast.com', 'fireside.fm', 'blubrry.com', 
                    'podbean.com', 'art19.com', 'audioboom.com', 'radiopublic.com', 'captivate.fm', 
                    'transistor.fm', 'buzzsprout.com', 'castos.com', 'simplecast.com', 'rss.com', 
                    'spreaker.com', 'pinecast.com', 'omnycontent.com', 'omny.fm', 'podiant.co', 
                    'squarespace-cdn.com', 'wp.com', 'twimg.com', 'pbs.twimg.com', 'podcaster.de',
                    'jiggyboy.com', 'letscast.fm', 'amazonaws.com', 'cloudfront.net', 'podcasts.com'
                  ];
                  if (!knownDirectHosts.some(host => fallbackImage?.toLowerCase().includes(host))) {
                    fallbackImage = `/api/image-proxy?url=${encodeURIComponent(fallbackImage)}`;
                  }
                }
                const isAlreadyAdded = userFeeds.some(f => f.url === item.url);
                const matchingFeed = userFeeds.find(f => f.url === item.url);
                return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSource({...item, isPublic: true, isRadio: item.type === 'radio' || item.isRadio}); }} className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePublicFeed(item.id); }} className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-md transition-colors" title={tr(settings.language, "Delete", "Löschen")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Banner background area */}
                <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                  {fallbackImage && (
                    <img loading="lazy" 
                      src={fallbackImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Language badge at top left */}
                  <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                    {getFlagEmoji(item.language)}
                  </div>
                  {/* Category Tag badge at top right */}
                  <div className="absolute top-2 right-2.5 z-20 bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                    {item.category ? t('cat-' + item.category, item.category) : t('cat-Podcast', 'Podcast')}
                  </div>
                </div>

                {/* Avatar & Card Body container */}
                <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                  {/* Avatar wrapper overlapping the banner */}
                  <div className="absolute -top-7 left-4">
                    <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                      {fallbackImage ? (
                        <img loading="lazy" 
                          src={fallbackImage} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-full bg-black/5" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { 
                            e.currentTarget.style.display = 'none';
                            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                            if (sibling) sibling.style.display = 'flex';
                          }} 
                        />
                      ) : null}
                      <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: fallbackImage ? 'none' : 'flex' }}>
                        {item.title?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="pt-7 pb-2 flex-grow min-w-0">
                    <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-purple-500 transition-colors duration-250`} title={item.title}>
                      {item.title}
                    </h3>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title={item.author || domain || item.url || ''}>
                      {item.author || domain || item.url || ''}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2">
                    <button 
                      title="Letzte Folge vorhören" 
                      disabled={previewingIds.includes(item.url)} 
                      onClick={() => handlePreviewPodcast(item.url, item.title, fallbackImage)} 
                      className={`p-1.5 rounded-lg text-gray-500 hover:text-purple-500 hover:bg-purple-500/10 dark:hover:bg-purple-500/20 transition-all flex items-center justify-center`}
                      style={{ width: '32px', height: '32px' }}
                    >
                      {previewingIds.includes(item.url) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    </button>

                    {isAlreadyAdded ? (
                      <button 
                        onClick={() => matchingFeed && handleDeleteFeed(matchingFeed.id, false)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddFeed(item.title, item.url, item.category, 'podcasts', fallbackImage)}
                        disabled={addingIds.includes(item.title)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Add / Follow", "Hinzufügen / Folgen")}
                      >
                        {addingIds.includes(item.title) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-500" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5] text-purple-500 hover:text-purple-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </section>
        )}

        {category === 'youtube' && (
        <section id="youtube" className="scroll-mt-24">
          <div className="flex items-center gap-2 mb-2">
            <Youtube className="w-5 h-5 text-red-500" />
            <h2 className="text-2xl font-bold">{tr(settings.language, 'YouTube to subscribe', 'YouTube zum abonnieren')}</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            {['Alle', ...Array.from(new Set(
                publicFeeds.filter(isYouTubeItem).map(item => item.category)
            )).sort()].map(cat => (
              <button
                key={cat}
                onClick={() => setDbFilterCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                  dbFilterCategory === cat
                    ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cat-' + cat, cat)}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
               {['Alle', 'de', 'en', 'fr', 'es'].map(lang => (
                 <button
                   key={lang}
                   onClick={() => setDbFilterLanguage(lang)}
                   className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                     dbFilterLanguage === lang
                       ? (isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-700')
                       : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                   }`}
                 >
                   {lang === 'Alle' ? t('cat-Alle', 'Alle') : lang === 'de' ? '🇩🇪 DE' : lang === 'en' ? '🇬🇧 EN' : lang === 'fr' ? '🇫🇷 FR' : '🇪🇸 ES'}
                 </button>
               ))}
            </div>
            {renderSortToggle('red')}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {publicFeeds.filter(isYouTubeItem)
              .filter(item => dbFilterCategory === 'Alle' || item.category === dbFilterCategory)
              .filter(item => dbFilterLanguage === 'Alle' || item.language === dbFilterLanguage || (!item.language && dbFilterLanguage === 'de'))
              .filter(item => !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.url?.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => {
                if (sortBy === 'subscribed') {
                  const isAlreadyAddedA = userFeeds.some(f => f.url === a.url);
                  const isAlreadyAddedB = userFeeds.some(f => f.url === b.url);
                  if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                  if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                  return (a.title || '').localeCompare(b.title || '');
                }
                return sortBy === 'abc' ? (a.title || '').localeCompare(b.title || '') : 0;
              })
              .map((item: any, i) => {
              const displayImage = item.imageUrl || null;
              const isAlreadyAdded = userFeeds.some(f => f.url === item.url);
              const matchingFeed = userFeeds.find(f => f.url === item.url);
              
              return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSource({...item, isPublic: true, isRadio: item.type === 'radio' || item.isRadio}); }} className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePublicFeed(item.id); }} className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-md transition-colors" title={tr(settings.language, "Delete", "Löschen")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Banner background area */}
                <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-red-500/10 via-orange-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                  {displayImage && (
                    <img loading="lazy" 
                      src={displayImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Language badge at top left */}
                  <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                    {getFlagEmoji(item.language)}
                  </div>
                  {/* Category Tag badge at top right */}
                  <div className="absolute top-2 right-2.5 z-20 bg-red-500/10 dark:bg-red-500/20 text-[#FF4500] dark:text-red-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                    {item.category ? t('cat-' + item.category, item.category) : t('cat-YouTube', 'YouTube')}
                  </div>
                </div>

                {/* Avatar & Card Body container */}
                <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                  {/* Avatar wrapper overlapping the banner */}
                  <div className="absolute -top-7 left-4">
                    <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                      {displayImage ? (
                        <img loading="lazy" 
                          src={displayImage} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-full bg-black/5" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { 
                            const currentSrc = e.currentTarget.src;
                            if (currentSrc.includes('hqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'); }
                            else if (currentSrc.includes('mqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg'); }
                            else {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                              if (sibling) sibling.style.display = 'flex';
                            }
                          }} 
                        />
                      ) : null}
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: displayImage ? 'none' : 'flex' }}>
                        {item.title?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="pt-7 pb-2 flex-grow min-w-0">
                    <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-red-500 transition-colors duration-250`} title={item.title}>
                      {item.title}
                    </h3>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title="YouTube">
                      YouTube
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-end border-t border-gray-100 dark:border-white/5 pt-2">
                    {isAlreadyAdded ? (
                      <button 
                        onClick={() => matchingFeed && handleDeleteFeed(matchingFeed.id, false)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddFeed(item.title, item.url, item.category, 'youtube', displayImage)}
                        disabled={addingIds.includes(item.title)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Add / Follow", "Hinzufügen / Folgen")}
                      >
                        {addingIds.includes(item.title) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-red-500" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5] text-red-500 hover:text-red-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </section>
        )}

        {category === 'radio' && (
        <section id="radio" className="scroll-mt-24">
          <div className="flex items-center gap-2 mb-2">
            <Radio className="w-5 h-5 text-blue-500" />
            <h2 className="text-2xl font-bold">{tr(settings.language, 'Webradio to subscribe', 'Webradio zum abonnieren')}</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            {['Alle', ...Array.from(new Set(
                publicFeeds.filter(p => p.type === 'radio' || p.category === 'Radio').map(item => item.category)
            )).sort()].map(cat => (
              <button
                key={cat}
                onClick={() => setDbFilterCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                  dbFilterCategory === cat
                    ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cat-' + cat, cat)}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-wrap gap-2">
               {['Alle', 'de', 'en', 'fr', 'es'].map(lang => (
                 <button
                   key={lang}
                   onClick={() => setDbFilterLanguage(lang)}
                   className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                     dbFilterLanguage === lang
                       ? (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-700')
                       : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                   }`}
                 >
                   {lang === 'Alle' ? t('cat-Alle', 'Alle') : lang === 'de' ? '🇩🇪 DE' : lang === 'en' ? '🇬🇧 EN' : lang === 'fr' ? '🇫🇷 FR' : '🇪🇸 ES'}
                 </button>
               ))}
            </div>
            {renderSortToggle('blue')}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {publicFeeds.filter(p => p.type === 'radio' || p.category === 'Radio')
              .filter(item => dbFilterCategory === 'Alle' || item.category === dbFilterCategory)
              .filter(item => dbFilterLanguage === 'Alle' || item.language === dbFilterLanguage || (!item.language && dbFilterLanguage === 'de'))
              .filter(item => !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.url?.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => {
                if (sortBy === 'subscribed') {
                  const isAlreadyAddedA = userRadio.some(r => r.url === a.url);
                  const isAlreadyAddedB = userRadio.some(r => r.url === b.url);
                  if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                  if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                  return (a.title || '').localeCompare(b.title || '');
                }
                return sortBy === 'abc' ? (a.title || '').localeCompare(b.title || '') : 0;
              })
              .map((item, i) => {
              const domain = getRootDomain(item.url);
              const fallbackImage = item.imageUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);
              const isAlreadyAdded = userRadio.some(r => r.url === item.url);
              const matchingRadio = userRadio.find(r => r.url === item.url);
              return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSource({...item, isPublic: true, isRadio: item.type === 'radio' || item.isRadio}); }} className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePublicFeed(item.id); }} className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-md transition-colors" title={tr(settings.language, "Delete", "Löschen")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Banner background area */}
                <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                  {fallbackImage && (
                    <img loading="lazy" 
                      src={fallbackImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Language badge at top left */}
                  <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                    {getFlagEmoji(item.language)}
                  </div>
                  {/* Category Tag badge at top right */}
                  <div className="absolute top-2 right-2.5 z-20 bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                    {item.category ? t('cat-' + item.category, item.category) : t('cat-Radio', 'Radio')}
                  </div>
                </div>

                {/* Avatar & Card Body container */}
                <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                  {/* Avatar wrapper overlapping the banner */}
                  <div className="absolute -top-7 left-4">
                    <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                      {fallbackImage ? (
                        <img loading="lazy" 
                          src={fallbackImage} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-full bg-black/5" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { 
                            e.currentTarget.style.display = 'none';
                            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                            if (sibling) sibling.style.display = 'flex';
                          }} 
                        />
                      ) : null}
                      <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: fallbackImage ? 'none' : 'flex' }}>
                        {item.title?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="pt-7 pb-2 flex-grow min-w-0">
                    <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-blue-500 transition-colors duration-250`} title={item.title}>
                      {item.title}
                    </h3>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title={domain || item.url}>
                      {domain || item.url}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/5 pt-2">
                    <button 
                      title="Radio streamen" 
                      onClick={() => handlePreviewRadio(item.url, item.title, fallbackImage)} 
                      className={`p-1.5 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all flex items-center justify-center`}
                      style={{ width: '32px', height: '32px' }}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>

                    {isAlreadyAdded ? (
                      <button 
                        onClick={() => matchingRadio && handleDeleteFeed(matchingRadio.id, true)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddRadio(item.title, item.url, item.imageUrl || fallbackImage, item.category)}
                        disabled={addingIds.includes(item.title)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Add / Follow", "Hinzufügen / Folgen")}
                      >
                        {addingIds.includes(item.title) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5] text-blue-500 hover:text-blue-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </section>
        )}

        {category === 'webcams' && (
        <section id="webcams" className="scroll-mt-24">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-5 h-5 text-emerald-500" />
            <h2 className="text-2xl font-bold">{tr(settings.language, 'WebCams to subscribe', 'WebCams zum abonnieren')}</h2>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-4 mb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
            {['Alle', ...Array.from(new Set(
                publicFeeds.filter(isWebCamItem).map(item => item.category)
            )).sort()].map(cat => (
              <button
                key={cat}
                onClick={() => setDbFilterCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-semibold transition-all ${
                  dbFilterCategory === cat
                    ? (isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-100 text-emerald-700')
                    : isDark ? 'bg-white/10 hover:bg-white/20 text-white/80' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                }`}
              >
                {t('cat-' + cat, cat)}
              </button>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4 mb-6">
            {renderSortToggle('emerald')}
          </div>

          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {publicFeeds.filter(isWebCamItem)
              .filter(item => dbFilterCategory === 'Alle' || item.category === dbFilterCategory)
              .filter(item => !searchQuery || item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || item.url?.toLowerCase().includes(searchQuery.toLowerCase()))
              .sort((a, b) => {
                if (sortBy === 'subscribed') {
                  const isAlreadyAddedA = userFeeds.some(f => f.url === a.url);
                  const isAlreadyAddedB = userFeeds.some(f => f.url === b.url);
                  if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                  if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                  return (a.title || '').localeCompare(b.title || '');
                }
                return sortBy === 'abc' ? (a.title || '').localeCompare(b.title || '') : 0;
              })
              .map((item: any, i) => {
              let ytThumbnail = null;
              if (item.url) {
                const match = item.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
              }
              const fallbackImage = item.imageUrl || ytThumbnail || null;
              const isAlreadyAdded = userFeeds.some(f => f.url === item.url);
              const matchingFeed = userFeeds.find(f => f.url === item.url);
              return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {isAdmin && (
                  <div className="absolute top-2 right-2 flex gap-1 z-40 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingSource({...item, isPublic: true, isRadio: item.type === 'radio' || item.isRadio}); }} className="w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition-colors" title="Bearbeiten">
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeletePublicFeed(item.id); }} className="w-8 h-8 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center justify-center backdrop-blur-md transition-colors" title={tr(settings.language, "Delete", "Löschen")}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {/* Banner background area */}
                <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                  {fallbackImage && (
                    <img loading="lazy" 
                      src={fallbackImage} 
                      alt="" 
                      className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  {/* Category Tag badge at top right */}
                  <div className="absolute top-2 right-2.5 z-20 bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                    {item.category ? t('cat-' + item.category, item.category) : t('cat-Webcam', 'Webcam')}
                  </div>
                </div>

                {/* Avatar & Card Body container */}
                <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                  {/* Avatar wrapper overlapping the banner */}
                  <div className="absolute -top-7 left-4">
                    <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                      {fallbackImage ? (
                        <img loading="lazy" 
                          src={fallbackImage} 
                          alt="" 
                          className="w-12 h-12 object-cover rounded-full bg-black/5" 
                          referrerPolicy="no-referrer" 
                          onError={(e) => { 
                            const currentSrc = e.currentTarget.src;
                            if (currentSrc.includes('hqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'); }
                            else if (currentSrc.includes('mqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg'); }
                            else {
                              e.currentTarget.style.display = 'none';
                              const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                              if (sibling) sibling.style.display = 'flex';
                            }
                          }} 
                        />
                      ) : null}
                      <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: fallbackImage ? 'none' : 'flex' }}>
                        {item.title?.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Info area */}
                  <div className="pt-7 pb-2 flex-grow min-w-0">
                    <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-emerald-500 transition-colors duration-250`} title={item.title}>
                      {item.title}
                    </h3>
                    <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title="WebCam">
                      WebCam
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-end border-t border-gray-100 dark:border-white/5 pt-2">
                    {isAlreadyAdded ? (
                      <button 
                        onClick={() => matchingFeed && handleDeleteFeed(matchingFeed.id, false)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={() => handleAddFeed(item.title, item.url, item.category, 'webcams', fallbackImage)}
                        disabled={addingIds.includes(item.title)}
                        className="p-1.5 rounded-lg transition-all flex items-center justify-center"
                        style={{ width: '32px', height: '32px' }}
                        title={tr(settings.language, "Add / Follow", "Hinzufügen / Folgen")}
                      >
                        {addingIds.includes(item.title) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        ) : (
                          <Plus className="w-4 h-4 stroke-[2.5] text-emerald-500 hover:text-emerald-600" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </section>
        )}

        {category === 'blogs' && (
        <section id="blogs" className="scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-yellow-500" />
                <h2 className={`text-4xl font-black tracking-tight ${isDark ? 'text-white' : 'text-black'}`}>{tr(settings.language, 'Blogs to subscribe', 'Blogs zum abonnieren')}</h2>
              </div>
              <p className={`text-sm font-medium ${isDark ? 'text-white/40' : 'text-gray-500'}`}>{tr(settings.language, 'The pulse of our community', 'Der Puls unserer Community')}</p>
            </div>
            {renderSortToggle('yellow')}
          </div>
          
          <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
            {publicFeeds.filter(item => item.type === 'blogs' && item.addedBy)
              .filter(item => !searchQuery || 
                item.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                item.authorName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                item.authorBio?.toLowerCase().includes(searchQuery.toLowerCase())
              )
              .filter((item, index, self) => {
                if (!item.addedBy) return true;
                return index === self.findIndex((t) => t.addedBy === item.addedBy);
              })
              .sort((a, b) => {
                if (sortBy === 'subscribed') {
                  const isAlreadyAddedA = userFeeds.some(f => f.url === a.url);
                  const isAlreadyAddedB = userFeeds.some(f => f.url === b.url);
                  if (isAlreadyAddedA && !isAlreadyAddedB) return -1;
                  if (!isAlreadyAddedA && isAlreadyAddedB) return 1;
                  const nameA = a.authorName || a.title || '';
                  const nameB = b.authorName || b.title || '';
                  return nameA.localeCompare(nameB);
                }
                if (sortBy !== 'abc') return 0;
                const nameA = a.authorName || a.title || '';
                const nameB = b.authorName || b.title || '';
                return nameA.localeCompare(nameB);
              })
              .map((item: any, i) => {
              const isAlreadyAdded = userFeeds.some(f => f.url === item.url);
              const matchingFeed = userFeeds.find(f => f.url === item.url);
              return (
              <div 
                key={i} 
                onClick={(e) => handleDiscoverCardClick(e, item, isAlreadyAdded)}
                className={`content-visibility-auto group flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${isAlreadyAdded ? 'cursor-pointer' : ''} ${
                  isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'
                }`}
              >
                {/* Clickable Area for Profile View */}
                <div 
                  className="cursor-pointer flex-1 flex flex-col"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (item.addedBy) {
                      navigate(`/blogs/author/${item.addedBy}`, { state: { internal: true } });
                    }
                  }}
                >
                  {/* Language Indicator */}
                  {item.language && (
                    <div className="absolute top-2 left-2 z-40">
                        <span className="text-xl select-none filter grayscale-0 antialiased" title={item.language}>
                          {getFlagEmoji(item.language)}
                        </span>
                    </div>
                  )}

                  {/* Banner */}
                  <div className="relative h-20 sm:h-24 w-full bg-gray-100 dark:bg-neutral-800 overflow-hidden shrink-0 glanz-image-container">
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 z-0" />
                    {item.authorBanner ? (
                      <img loading="lazy" 
                        src={item.authorBanner} 
                        alt="" 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                        referrerPolicy="no-referrer" 
                        style={{ objectPosition: `50% ${item.authorBannerOffset !== undefined ? item.authorBannerOffset : 50}%` }}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-r from-orange-400 via-yellow-400 to-orange-500 opacity-20" />
                    )}
                  </div>

                  {/* Avatar overlapping center */}
                  <div className="absolute top-14 sm:top-18 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full border-[3px] border-white dark:border-neutral-900 bg-gray-200 dark:bg-neutral-800 overflow-hidden shrink-0 z-50 transition-transform hover:scale-105">
                    {item.authorAvatar ? (
                      <img loading="lazy" src={item.authorAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <User className="w-7 h-7 opacity-20" />
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="px-3 pt-5 pb-2 flex flex-col flex-1 relative">
                      <div className="flex items-center gap-1 mb-1">
                        <FileText className="w-2.5 h-2.5 text-orange-500" />
                        <span className="text-[7.5px] font-black uppercase tracking-tight text-orange-500">{tr(settings.language, 'Author', 'Autor')}</span>
                      </div>
                      
                      <div className="min-w-0 mb-1.5">
                        <h4 className="font-black text-xs lg:text-sm truncate tracking-tight uppercase text-left leading-tight" title={item.authorName}>{item.authorName || 'Unknown'}</h4>
                      </div>

                      <div className="flex-1 mb-1">
                        <p className={`line-clamp-4 font-normal text-[11px] leading-snug text-left opacity-90 ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
                          "{item.authorBio || tr(settings.language, 'No bio available yet.', 'Noch keine Bio verfügbar.')}"
                        </p>
                      </div>
                  </div>
                </div>

                {/* Footer Section (Always accessible) */}
                <div className={`mt-auto px-4 py-1 flex items-center justify-between border-t ${isDark ? 'bg-black/10 border-white/5' : 'bg-gray-50/30 border-gray-100'}`}>
                    <div className="flex-1" />
                    {isAlreadyAdded ? (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (matchingFeed) handleDeleteFeed(matchingFeed.id, false);
                        }}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-all text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/20"
                        title={tr(settings.language, "Unfollow", "Entfolgen")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddFeed(item.title, item.url, 'Blogs', 'blogs', item.imageUrl, {
                            name: item.authorName || 'Unknown',
                            bio: item.authorBio,
                            avatar: item.authorAvatar,
                            banner: item.authorBanner,
                            bannerOffset: item.authorBannerOffset
                          });
                        }}
                        disabled={addingIds.includes(item.title)}
                        className="w-6 h-6 rounded-md flex items-center justify-center transition-all bg-yellow-500 text-black hover:bg-yellow-400 active:scale-95 font-bold"
                        title={tr(settings.language, "Follow", "Folgen")}
                      >
                        {addingIds.includes(item.title) ? <Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-600" /> : <Plus className="w-4 h-4 stroke-[3]" />}
                      </button>
                    )}
                </div>
              </div>
            )})}
          </div>
        </section>
        )}

        {(() => {
          return null;
          let filteredUserFeeds = userFeeds.filter(feed => {
            const isYouTube = feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be');
            const isWebCam = feed.category === 'WebCam' || feed.type === 'webcams';
            if (category === 'webcams') return isWebCam;
            if (category === 'podcasts') return (feed.category === 'Podcast' || feed.isPodcast) && !isWebCam;
            if (category === 'youtube') return (feed.category === 'YouTube' || isYouTube) && !isWebCam;
            if (category === 'blogs') return feed.type === 'blogs';
            if (category === 'feeds') return feed.category !== 'YouTube' && feed.category !== 'Podcast' && feed.type !== 'blogs' && !feed.isPodcast && !isYouTube && !isWebCam;
            return false;
          });
          
          let filteredUserRadio = category === 'radio' ? userRadio : [];

          // Apply Discovery Filters to User Lists
          if (dbFilterCategory !== 'Alle') {
            filteredUserFeeds = filteredUserFeeds.filter(f => {
               const normalizedCat = f.category?.charAt(0).toUpperCase() + f.category?.slice(1).toLowerCase();
               return normalizedCat === dbFilterCategory;
            });
            filteredUserRadio = filteredUserRadio.filter(f => {
               const normalizedCat = f.category?.charAt(0).toUpperCase() + f.category?.slice(1).toLowerCase();
               return normalizedCat === dbFilterCategory;
            });
          }
          if (dbFilterLanguage !== 'Alle') {
            const l = dbFilterLanguage;
            filteredUserFeeds = filteredUserFeeds.filter(f => f.language === l || (!f.language && l === 'de'));
            filteredUserRadio = filteredUserRadio.filter(f => f.language === l || (!f.language && l === 'de'));
          }

          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filteredUserFeeds = filteredUserFeeds.filter(f => {
              const matchedTitle = f.title?.toLowerCase().includes(q);
              const matchedUrl = f.url?.toLowerCase().includes(q);
              const matchedCat = f.category?.toLowerCase().includes(q);
              // Also match translated category
              const translatedCat = f.category ? t('cat-' + f.category, f.category).toLowerCase() : '';
              const matchedTranslatedCat = translatedCat.includes(q);
              return matchedTitle || matchedUrl || matchedCat || matchedTranslatedCat;
            });
            filteredUserRadio = filteredUserRadio.filter(f => {
              const matchedTitle = f.title?.toLowerCase().includes(q);
              const matchedCat = f.category?.toLowerCase().includes(q);
              const translatedCat = f.category ? t('cat-' + f.category, f.category).toLowerCase() : '';
              const matchedTranslatedCat = translatedCat.includes(q);
              return matchedTitle || matchedCat || matchedTranslatedCat;
            });
          }

          return (
            <div className="pt-12 border-t mt-12 mb-8 border-gray-200 dark:border-white/10 hidden">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-6">
                <div className="space-y-1">
                  <h2 className="text-3xl font-black tracking-tight">
                    {category === 'youtube' ? (tr(settings.language, 'Manage My YouTube Channels', 'Meine YouTube Kanäle verwalten')) : 
                     category === 'radio' ? (tr(settings.language, 'Manage My Radio Stations', 'Meine Radiosender verwalten')) : 
                     category === 'podcasts' ? (tr(settings.language, 'Manage My Podcasts', 'Meine Podcasts verwalten')) : 
                     category === 'feeds' ? (tr(settings.language, 'Manage My RSS', 'Meine RSS verwalten')) : 
                     category === 'webcams' ? (tr(settings.language, 'Manage My WebCams', 'Meine WebCams verwalten')) : 
                     category === 'blogs' ? (tr(settings.language, 'Manage My Blogs', 'Meine Blogs verwalten')) :
                     (tr(settings.language, 'Manage All Sources', 'Alle Quellen verwalten'))}
                  </h2>
                  <div className="h-1.5 w-24 bg-orange-500 rounded-full" />
                </div>
              </div>
              
              {filteredUserFeeds.length === 0 && filteredUserRadio.length === 0 ? (
                <p className={`text-sm ${isDark ? 'text-white/50' : 'text-gray-500'}`}>Keine eigenen Einträge in diesem Bereich vorhanden.</p>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                  {filteredUserFeeds.map(feed => {
                    const domain = getRootDomain(feed.url);
                    let ytThumbnail = null;
                    if (feed.url) {
                      const match = feed.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                      if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
                    }
                    const fallbackImage = ytThumbnail || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);
                    
                    const isBlogSource = feed.type === 'blogs' || feed.category === 'Blogs' || feed.category === 'blogs' || !!feed.authorName || (feed.url && (feed.url.includes('run.app') || feed.url.includes('rsser.news')));
                    
                    const publicSource = feed.type === 'blogs' ? publicFeeds.find(p => p.url === feed.url || (p.addedBy && p.addedBy === feed.userId)) : null;
                    const blogAvatar = publicSource?.authorAvatar || feed.authorAvatar || feed.imageUrl;
                    const cleanBlogAvatar = (blogAvatar && blogAvatar !== 'null' && blogAvatar !== 'undefined' && blogAvatar.trim() !== '') ? blogAvatar : null;
                    const blogAuthorName = publicSource?.authorName || feed.authorName || feed.title || 'Unknown';
                    
                    return (
                      <div 
                        key={feed.id} 
                        onClick={(e) => handleDiscoverCardClick(e, feed, false)}
                        className={`content-visibility-auto group/card group cursor-pointer flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'}`}
                      >
                        {/* Banner background area */}
                        <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-orange-500/10 via-yellow-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                          {/* If the feed has an image, we can show a zoomed-in blurred image as the banner to make it look super customized! */}
                          {(feed.imageUrl || cleanBlogAvatar) && (
                            <img loading="lazy" 
                              src={feed.imageUrl || cleanBlogAvatar} 
                              alt="" 
                              className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          
                          {/* Language badge at top left */}
                          {!(feed.type === 'webcams' || feed.category === 'webcams' || feed.category === 'Webcam' || feed.category === 'WebCam') && (
                            <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                              {getFlagEmoji(feed.language)}
                            </div>
                          )}
                          
                          {/* Category Tag badge at top right */}
                          <div className="absolute top-2 right-2.5 z-20 bg-orange-500/10 dark:bg-orange-500/20 text-[#FF4500] dark:text-orange-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                            {feed.category ? t('cat-' + feed.category, feed.category) : t('cat-' + (category === 'youtube' ? 'YouTube' : category === 'podcasts' ? 'Podcast' : category === 'webcams' ? 'WebCam' : category === 'blogs' ? 'Blog' : 'Feed'), (category === 'youtube' ? 'YouTube' : category === 'podcasts' ? 'Podcast' : category === 'webcams' ? 'WebCam' : category === 'blogs' ? 'Blog' : 'Feed'))}
                          </div>
                        </div>

                        {/* Avatar & Card Body container */}
                        <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                          {/* Avatar wrapper overlapping the banner */}
                          <div className="absolute -top-7 left-4">
                            {isBlogSource ? (
                              cleanBlogAvatar ? (
                                <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                                  <img loading="lazy" 
                                    src={cleanBlogAvatar} 
                                    alt="" 
                                    className="w-12 h-12 object-cover rounded-full bg-black/5" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const parent = e.currentTarget.parentElement;
                                      if (parent) {
                                        const oldFallback = parent.querySelector('.avatar-fallback');
                                        if (!oldFallback) {
                                          const fallback = document.createElement('div');
                                          fallback.className = "avatar-fallback w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-base uppercase select-none";
                                          fallback.innerText = blogAuthorName.charAt(0).toUpperCase();
                                          parent.appendChild(fallback);
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              ) : (
                                <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                                  <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-base uppercase select-none">
                                    {blogAuthorName.charAt(0).toUpperCase()}
                                  </div>
                                </div>
                              )
                            ) : (
                              <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                                {feed.imageUrl ? (
                                  <img loading="lazy" 
                                    src={feed.imageUrl} 
                                    alt="" 
                                    className="w-12 h-12 object-cover rounded-full bg-black/5" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => { 
                                      const currentSrc = e.currentTarget.src;
                                      if (currentSrc.includes('hqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'); }
                                      else if (currentSrc.includes('mqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg'); }
                                      else {
                                        e.currentTarget.style.display = 'none';
                                        const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (sibling) sibling.style.display = 'flex';
                                      }
                                    }} 
                                  />
                                ) : fallbackImage ? (
                                  <img loading="lazy" 
                                    src={fallbackImage} 
                                    alt="" 
                                    className="w-12 h-12 object-cover rounded-full bg-black/5" 
                                    referrerPolicy="no-referrer" 
                                    onError={(e) => { 
                                      const currentSrc = e.currentTarget.src;
                                      if (currentSrc.includes('hqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg'); }
                                      else if (currentSrc.includes('mqdefault.jpg')) { e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg'); }
                                      else {
                                        e.currentTarget.style.display = 'none';
                                        const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                        if (sibling) sibling.style.display = 'flex';
                                      }
                                    }} 
                                  />
                                ) : null}
                                <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: (feed.imageUrl || fallbackImage) ? 'none' : 'flex' }}>
                                  {feed.title?.charAt(0).toUpperCase()}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Info area */}
                          <div className="pt-7 pb-2 flex-grow min-w-0">
                            <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-orange-500 transition-colors duration-250`} title={isBlogSource ? (feed.authorName || feed.title) : feed.title}>
                              {isBlogSource ? (feed.authorName || feed.title) : feed.title}
                            </h3>
                            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title={domain || feed.url}>
                              {domain || feed.url}
                            </p>
                          </div>

                          {/* Action footer */}
                          <div className="flex items-center justify-end gap-1.5 border-t border-gray-100 dark:border-white/5 pt-2">
                            {!isBlogSource && (
                              <button 
                                onClick={() => setEditingSource({...feed, isRadio: false})} 
                                className={`p-1.5 rounded-lg text-gray-500 hover:text-orange-500 hover:bg-orange-500/10 dark:hover:bg-orange-500/20 transition-all`} 
                                style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button 
                              onClick={() => handleDeleteFeed(feed.id, false)} 
                              className={`p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all`} 
                              title={tr(settings.language, 'Remove / Unfollow', 'Entfernen / Entfolgen')} 
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  
                  {filteredUserRadio.map(radio => {
                    const domain = getRootDomain(radio.url);
                    const fallbackImage = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
                    const displayIcon = radio.imageUrl || radio.faviconUrl;

                    return (
                      <div key={radio.id} className={`content-visibility-auto group/card group flex flex-col rounded-2xl border relative overflow-hidden h-full transition-all duration-300 hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 hover:border-slate-300 shadow-sm backdrop-blur-sm'}`}>
                        {/* Banner background area */}
                        <div className="h-16 w-full relative overflow-hidden flex-shrink-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent border-b border-gray-100 dark:border-white/5 glanz-image-container">
                          {displayIcon && (
                            <img loading="lazy" 
                              src={displayIcon} 
                              alt="" 
                              className="absolute inset-0 w-full h-full object-cover blur-md saturate-125 scale-110 opacity-45 dark:opacity-25 transition-transform duration-500 group-hover/card:scale-115"
                              referrerPolicy="no-referrer"
                            />
                          )}
                          
                          {/* Language badge at top left */}
                          <div className="absolute top-2 left-2.5 z-20 bg-white/70 dark:bg-black/40 backdrop-blur-md px-1.5 py-0.5 rounded-full text-xs flex items-center justify-center leading-none shadow-sm dark:shadow-none">
                            {getFlagEmoji(radio.language)}
                          </div>
                          
                          {/* Category Tag badge at top right */}
                          <div className="absolute top-2 right-2.5 z-20 bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md text-[9px] uppercase tracking-wider">
                            {radio.category ? t('cat-' + radio.category, radio.category) : t('cat-Radio', 'Radio')}
                          </div>
                        </div>

                        {/* Avatar & Card Body container */}
                        <div className="px-4 pb-4 pt-1 flex flex-col flex-1 relative min-h-[110px] justify-between">
                          {/* Avatar wrapper overlapping the banner */}
                          <div className="absolute -top-7 left-4">
                            <div className="p-1 bg-white dark:bg-neutral-900 rounded-full shadow-md">
                              {displayIcon ? (
                                <img loading="lazy" 
                                  src={displayIcon} 
                                  alt="" 
                                  className="w-12 h-12 object-cover rounded-full bg-black/5" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (sibling) sibling.style.display = 'flex';
                                  }}
                                />
                              ) : fallbackImage ? (
                                <img loading="lazy" 
                                  src={fallbackImage} 
                                  alt="" 
                                  className="w-12 h-12 object-cover rounded-full bg-black/5" 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                    if (sibling) sibling.style.display = 'flex';
                                  }}
                                />
                              ) : null}
                              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-base uppercase select-none" style={{ display: (displayIcon || fallbackImage) ? 'none' : 'flex' }}>
                                {radio.title?.charAt(0).toUpperCase()}
                              </div>
                            </div>
                          </div>

                          {/* Info area */}
                          <div className="pt-7 pb-2 flex-grow min-w-0">
                            <h3 className={`font-bold text-sm tracking-tight line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} group-hover/card:text-blue-500 transition-colors duration-250`} title={radio.title}>
                              {radio.title}
                            </h3>
                            <p className={`text-[11px] truncate mt-0.5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} title={domain || radio.url}>
                              {domain || radio.url}
                            </p>
                          </div>

                          {/* Action footer */}
                          <div className="flex items-center justify-end gap-1.5 border-t border-gray-100 dark:border-white/5 pt-2">
                            <button 
                              onClick={() => setEditingSource({...radio, isRadio: true})} 
                              className={`p-1.5 rounded-lg text-gray-500 hover:text-blue-500 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 transition-all`} 
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => handleDeleteFeed(radio.id, true)} 
                              className={`p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition-all`} 
                              style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {editingSource && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-md flex items-center justify-center p-4" onClick={() => { setEditingSource(null); setEditFile(null); }}>
          <div 
            onClick={e => e.stopPropagation()} 
            className={`relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl ${isDark ? 'bg-neutral-900 border border-white/10 text-white' : 'bg-white text-gray-900'} my-auto`}
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">{editingSource.isRadio ? (tr(settings.language, 'Edit Radio Station', 'Radiosender bearbeiten')) : editingSource.isPodcast ? (tr(settings.language, 'Edit Podcast', 'Podcast bearbeiten')) : editingSource.type === 'youtube' ? (tr(settings.language, 'Edit YouTube Channel', 'YouTube Kanal bearbeiten')) : (tr(settings.language, 'Edit RSS', 'RSS bearbeiten'))}</h2>
              <button onClick={() => { setEditingSource(null); setEditFile(null); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Titel</label>
                <input 
                  type="text" 
                  value={editingSource.title || ''} 
                  onChange={e => setEditingSource({...editingSource, title: e.target.value})}
                  className={`w-full p-3 rounded-xl border ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">URL</label>
                <input 
                  type="url" 
                  value={editingSource.url || ''} 
                  onChange={e => setEditingSource({...editingSource, url: e.target.value})}
                  className={`w-full p-3 rounded-xl border ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  required
                />
              </div>

              <div className="pt-2">
                <label className="block text-sm font-medium mb-1">
                  {editingSource.isRadio ? 'Genre' : (tr(settings.language, 'Category', 'Kategorie'))}
                </label>
                {editingSource.isRadio ? (
                  <select
                    value={editingSource.category || ''}
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  >
                    <option value="">{tr(settings.language, 'Please select...', 'Auswählen...')}</option>
                    <option value="Pop">Pop</option>
                    <option value="60s">60s</option>
                    <option value="70s">70s</option>
                    <option value="80s">80s</option>
                    <option value="90s">90s</option>
                    <option value="Game Music">Game Music</option>
                    <option value="Black">Black</option>
                    <option value="Rock">Rock</option>
                    <option value="Heavy Metal">Heavy Metal</option>
                    <option value="Relax">Relax</option>
                    <option value="KPop">KPop</option>
                    <option value="Nachrichten">{t('cat-Nachrichten', 'Nachrichten')}</option>
                    <option value="Klassik">{t('cat-Klassik', 'Klassik')}</option>
                    <option value="Dance / Electronic">Dance / Electronic</option>
                    <option value="Hip Hop">Hip Hop</option>
                    <option value="Jazz">Jazz</option>
                    <option value="Country">Country</option>
                    <option value="Volksmusik">{t('cat-Volksmusik', 'Volksmusik')}</option>
                    <option value="Rap">Rap</option>
                    <option value="Schlager">{t('cat-Schlager', 'Schlager')}</option>
                    <option value="Techno">Techno</option>
                  </select>
                ) : editingSource.type === 'webcams' ? (
                  <select
                    value={editingSource.category || ''}
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  >
                    <option value="WebCam">{t('cat-Allgemein', 'Allgemein')}</option>
                    <option value="Tiere">{t('cat-Tiere', 'Tiere')}</option>
                    <option value="Reisen">{t('cat-Reisen', 'Reisen')}</option>
                    <option value="Weltraum">{t('cat-Weltraum', 'Weltraum')}</option>
                    <option value="Natur">{t('cat-Natur', 'Natur')}</option>
                    <option value="Stadt">{t('cat-Stadt', 'Stadt')}</option>
                  </select>
                ) : (
                  <select 
                    value={editingSource.category || ''} 
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  >
                    <option value="" disabled>{tr(settings.language, 'Please select...', 'Bitte wählen...')}</option>
                    {FEED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {tr(settings.language, 'Language', 'Sprache')}
                </label>
                <select
                  value={editingSource.language || 'none'}
                  onChange={e => setEditingSource({...editingSource, language: e.target.value === 'none' ? '' : e.target.value})}
                  className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                >
                  <option value="none">🌐 {tr(settings.language, 'Other / None', 'Andere / Keine')}</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Icon / Logo</label>
                <div className="flex items-center gap-4">
                  {(editFile || editingSource.imageUrl || editingSource.faviconUrl) && (
                    <img loading="lazy" src={editFile ? URL.createObjectURL(editFile) : (editingSource.imageUrl || editingSource.faviconUrl)} 
                      alt="" 
                      className="w-12 h-12 rounded-lg object-cover bg-black/5" referrerPolicy="no-referrer" />
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    id="edit-upload"
                    className="hidden"
                    onChange={e => e.target.files && setEditFile(e.target.files[0])}
                  />
                  <label 
                    htmlFor="edit-upload"
                    className={`px-4 py-2 cursor-pointer flex items-center gap-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
                  >
                    <Upload className="w-4 h-4" />
                    Neues Bild hochladen
                  </label>
                </div>
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={editUploading}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <LimitReachedModal 
        isOpen={limitModal.isOpen} 
        onClose={() => setLimitModal({ ...limitModal, isOpen: false })} 
        type={limitModal.type} 
      />
    </div>
  );
}
