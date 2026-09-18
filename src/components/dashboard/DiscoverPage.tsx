import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { useMedia } from '../../context/MediaContext';
import { 
  Rss, Podcast, Youtube, Radio, Plus, Camera, Loader2, Upload, 
  Edit3, X, FileText, ChevronDown, Sparkles, ArrowRight,
  Image as ImageIcon, AlertTriangle, Trash2
} from 'lucide-react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { addDoc, collection, doc, deleteDoc, updateDoc, setDoc, onSnapshot, query, getDoc, getDocs, where } from 'firebase/firestore';
import { FEED_CATEGORIES } from '../../lib/constants';
import { useCustomModal } from '../../context/ModalContext';
import { isAdminEmail } from '../../lib/admin';
import { tr } from '../../lib/t';
import { DiscoverCard } from './DiscoverCard';
import { DiscoverFilterBar } from './DiscoverFilterBar';
import { processImageFile } from '../../lib/imageUtils';

const normalizeUrl = (url?: string) => {
  if (!url) return '';
  return url.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
};

const deduplicateSources = (sources: any[]): any[] => {
  const map = new Map<string, any>();
  for (const item of sources) {
    if (!item || item.deleted) continue;
    const normUrl = normalizeUrl(item.url);
    const cleanTitle = (item.title || '').trim().toLowerCase();
    const key = normUrl || `${cleanTitle}::${item.type || 'feeds'}`;
    if (!map.has(key)) {
      map.set(key, item);
    } else {
      const existing = map.get(key);
      const chosen = (item.customImageUrl || item.imageUrl) ? item : existing;
      map.set(key, { ...existing, ...chosen });
    }
  }
  return Array.from(map.values()).sort((a, b) => (a.title || '').localeCompare(b.title || ''));
};

const getInitialPublicSources = (): any[] => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('rsser_public_sources_cache') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (_) {}
  return [];
};

export function DiscoverPage() {
  const { t } = useTranslation();
  const { showConfirm } = useCustomModal();
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
  
  const [editingSource, setEditingSource] = useState<any>(null);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editUploading, setEditUploading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [addingIds, setAddingIds] = useState<string[]>([]);
  const [previewingIds, setPreviewingIds] = useState<string[]>([]);
  const [publicFeeds, setPublicFeeds] = useState<any[]>(getInitialPublicSources);
  const [userFeeds, setUserFeeds] = useState<any[]>([]);
  const [userRadio, setUserRadio] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const categoryName = category.charAt(0).toUpperCase() + category.slice(1);
    document.title = isEn ? `${categoryName} Organize | RSSer News` : `${categoryName} organisieren | RSSer News`;
  }, [category, isEn]);

  useEffect(() => {
    if (category === 'feeds' || category === 'podcasts' || category === 'youtube' || category === 'radio') {
      setType(category);
      setDbFilterCategory('Alle');
      setDbFilterLanguage('Alle');
    }
  }, [category]);

  useEffect(() => {
    if (window.location.pathname === '/discover') {
      navigate('/discover/feeds', { replace: true });
    }
  }, [navigate]);

  const showToast = (msg: string) => {
    const el = document.createElement('div');
    el.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 px-5 py-3 rounded-full z-[1000000] font-semibold text-xs shadow-2xl transition-opacity duration-300 pointer-events-none border border-white/20 dark:border-black/20';
    el.innerText = msg;
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !editingSource) return;
    setEditUploading(true);
    setEditError(null);
    try {
      let finalImageUrl = (editingSource.imageUrl || editingSource.faviconUrl || '').trim();
      
      if (editFile) {
        finalImageUrl = await processImageFile(editFile, 512);
      }
      
      const updateData: any = {
        title: (editingSource.title || '').trim(),
        url: (editingSource.url || '').trim(),
        imageUrl: finalImageUrl,
        customImageUrl: finalImageUrl
      };
      
      if (editingSource.language !== undefined) {
        updateData.language = editingSource.language;
      }
      
      if (editingSource.category) {
        updateData.category = editingSource.category;
      }
      
      if (editingSource.isRadio) {
        updateData.faviconUrl = finalImageUrl;
      }
      
      if (editingSource.isPublic) {
        let existingDocId: string | null = null;
        
        // 1. If it's a real Firestore ID (not an in-memory default ID), check if it exists in Firestore
        if (editingSource.id && !editingSource.id.startsWith('default-')) {
          try {
            const checkSnap = await getDoc(doc(db, 'publicSources', editingSource.id));
            if (checkSnap.exists()) {
              existingDocId = editingSource.id;
            }
          } catch (e) {
            console.warn('Check doc existence error:', e);
          }
        }
        
        // 2. If not found yet, check if there is an existing document by URL
        if (!existingDocId && editingSource.url) {
          try {
            const qUrl = query(collection(db, 'publicSources'), where('url', '==', editingSource.url));
            const snap = await getDocs(qUrl);
            if (!snap.empty) {
              existingDocId = snap.docs[0].id;
            }
          } catch (e) {
            console.warn('Query publicSources by URL error:', e);
          }
        }

        const fullDocData: any = {
          title: updateData.title || editingSource.title || '',
          url: updateData.url || editingSource.url || '',
          category: updateData.category || editingSource.category || (editingSource.isRadio ? 'Radio' : 'Allgemein'),
          language: updateData.language || editingSource.language || 'de',
          type: editingSource.type || (editingSource.isRadio ? 'radio' : category || 'feeds'),
          imageUrl: finalImageUrl,
          customImageUrl: finalImageUrl,
          addedBy: auth.currentUser.uid,
          addedAt: editingSource.addedAt || new Date().toISOString()
        };
        if (editingSource.isRadio) {
          fullDocData.faviconUrl = finalImageUrl;
        }

        let targetDocId = existingDocId;
        if (!targetDocId && editingSource.id && !editingSource.id.startsWith('default-')) {
          targetDocId = editingSource.id;
        }

        if (targetDocId) {
          await setDoc(doc(db, 'publicSources', targetDocId), fullDocData, { merge: true });
        } else {
          const newDocRef = await addDoc(collection(db, 'publicSources'), fullDocData);
          targetDocId = newDocRef.id;
        }

        // Immediately update local publicFeeds state so UI reflects changes
        const updatedItem = {
          ...editingSource,
          ...updateData,
          ...fullDocData,
          id: targetDocId
        };

        setPublicFeeds(prev => {
          const normTarget = normalizeUrl(updatedItem.url);
          const targetTitle = `${(updatedItem.title || '').trim().toLowerCase()}::${updatedItem.type || 'feeds'}`;
          return prev.map(item => {
            const itemNorm = normalizeUrl(item.url);
            const itemTitle = `${(item.title || '').trim().toLowerCase()}::${item.type || 'feeds'}`;
            if (item.id === editingSource.id || item.id === targetDocId || (normTarget && itemNorm === normTarget) || itemTitle === targetTitle) {
              return { ...item, ...updatedItem };
            }
            return item;
          });
        });
      } else {
        const collectionName = editingSource.isRadio ? 'radioStations' : 'feeds';
        const docRef = doc(db, 'users', auth.currentUser.uid, collectionName, editingSource.id);
        await setDoc(docRef, updateData, { merge: true });
      }

      // Also sync updates to the user's subscribed feeds/stations if they have already added it
      if (editingSource.url) {
        const matchingUserFeed = userFeeds.find(f => normalizeUrl(f.url) === normalizeUrl(editingSource.url));
        if (matchingUserFeed) {
          try {
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'feeds', matchingUserFeed.id), {
              imageUrl: finalImageUrl,
              customImageUrl: finalImageUrl,
              title: updateData.title || matchingUserFeed.title
            }, { merge: true });
          } catch (e) {
            console.warn('Could not update user feed copy:', e);
          }
        }
        const matchingUserRadio = userRadio.find(r => normalizeUrl(r.url) === normalizeUrl(editingSource.url));
        if (matchingUserRadio) {
          try {
            await setDoc(doc(db, 'users', auth.currentUser.uid, 'radioStations', matchingUserRadio.id), {
              faviconUrl: finalImageUrl,
              imageUrl: finalImageUrl,
              customImageUrl: finalImageUrl,
              title: updateData.title || matchingUserRadio.title
            }, { merge: true });
          } catch (e) {
            console.warn('Could not update user radio copy:', e);
          }
        }
      }
      
      setEditingSource(null);
      setEditFile(null);
      showToast('Erfolgreich gespeichert');
    } catch (err: any) {
      console.error('Error saving source:', err);
      const msg = err.message || 'Fehler beim Speichern der Quelle.';
      setEditError(msg);
      showToast(msg);
    } finally {
      setEditUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 8 * 1024 * 1024) {
        showToast("Bild ist zu gross (max. 8 MB). Bitte ein kleineres Bild wählen.");
        return;
      }
      try {
        const dataUrl = await processImageFile(file, 512);
        setIcon(dataUrl);
      } catch (err: any) {
        console.error('File conversion error:', err);
        showToast(err.message || 'Fehler beim Laden des Bildes.');
      }
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
          type: type,
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

  const handlePreviewPodcast = async (feedUrl: string, itemTitle: string, imageUrl?: string | null) => {
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
            title: firstAudioItem.title || itemTitle,
            url: firstAudioItem.enclosure.url,
            feedTitle: itemTitle,
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
      setPreviewingIds(prev => prev.filter(u => u !== feedUrl));
    }
  };

  const handlePreviewRadio = (streamUrl: string, radioTitle: string, imageUrl?: string | null) => {
    setPlayingAudio({
      title: radioTitle,
      url: streamUrl,
      feedTitle: "Live Radio",
      imageUrl: imageUrl || null
    });
  };

  useEffect(() => {
    const fetchPublicSources = async () => {
      try {
        const res = await fetch('/api/public-sources');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const deduped = deduplicateSources(data);
            setPublicFeeds(deduped);
            try {
              localStorage.setItem('rsser_public_sources_cache', JSON.stringify(deduped));
            } catch (_) {}
          }
        }
      } catch (e) {
        // Silently continue
      }
    };
    fetchPublicSources();

    let publicUnsub: (() => void) | undefined;
    try {
      publicUnsub = onSnapshot(collection(db, 'publicSources'), (snapshot) => {
        if (!snapshot.empty) {
          const dbItems = snapshot.docs
            .filter(d => !d.data().deleted)
            .map(d => ({ id: d.id, ...d.data() }));
          const deduped = deduplicateSources(dbItems);
          setPublicFeeds(deduped);
          try {
            localStorage.setItem('rsser_public_sources_cache', JSON.stringify(deduped));
          } catch (_) {}
        }
      }, () => {
        // Silently catch permission or network error
      });
    } catch (e) {}

    let feedsUnsub: (() => void) | undefined;
    let radioUnsub: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, user => {
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
      if (publicUnsub) publicUnsub();
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
      const targetFeed = userFeeds.find(f => f.id === id);
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, isRadio ? 'radioStations' : 'feeds', id));
      ['podcasts', 'youtube', 'rss', 'feeds', 'webcams', 'blogs', 'all'].forEach(t => {
        try {
          const raw = localStorage.getItem(`cached_feeds_${t}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            const filtered = parsed.filter((f: any) => f.id !== id && (!targetFeed?.url || f.url !== targetFeed.url));
            localStorage.setItem(`cached_feeds_${t}`, JSON.stringify(filtered));
          }
        } catch (_) {}
      });
      if (targetFeed?.url) {
        const cacheId = encodeURIComponent(targetFeed.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
        try {
          localStorage.removeItem('rss_v5_' + cacheId);
        } catch (_) {}
      }
    }
  };

  const handleDeletePublicFeed = async (id: string, feedUrl?: string, feedTitle?: string) => {
    if (!isAdmin) return;
    const confirmed = await showConfirm(
      settings.language === 'en' ? 'Are you sure you want to delete this public entry?' : 'Diesen öffentlichen Eintrag wirklich löschen?',
      settings.language === 'en' ? 'Delete public entry' : 'Öffentlichen Eintrag löschen'
    );
    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'publicSources', id));
        if (feedUrl) {
          try {
            const qUrl = query(collection(db, 'publicSources'), where('url', '==', feedUrl));
            const snap = await getDocs(qUrl);
            for (const d of snap.docs) {
              await deleteDoc(d.ref);
            }
          } catch (e) {}
        }

        setPublicFeeds(prev => {
          const next = prev.filter(f => 
            f.id !== id && 
            (!feedUrl || normalizeUrl(f.url) !== normalizeUrl(feedUrl)) &&
            (!feedTitle || f.title?.trim().toLowerCase() !== feedTitle?.trim().toLowerCase())
          );
          try {
            localStorage.setItem('rsser_public_sources_cache', JSON.stringify(next));
          } catch (_) {}
          return next;
        });
        showToast('Erfolgreich gelöscht');
      } catch (err: any) {
        console.error("Failed to delete public source:", err);
        showToast(err.message || 'Fehler beim Löschen');
      }
    }
  };

  const handleOpenFeedChannel = (feed: any) => {
    if (!feed) return;
    const isYouTube = feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be') || feed.category === 'YouTube' || feed.type === 'youtube';
    const isWebCam = feed.category === 'WebCam' || feed.type === 'webcams';
    const isPodcast = feed.category === 'Podcast' || feed.isPodcast || feed.type === 'podcasts';
    const isRadio = feed.category === 'Radio' || feed.type === 'radio' || feed.isRadio;

    let targetPath = '/rss-feeds';
    if (isYouTube) targetPath = '/youtube';
    else if (isPodcast) targetPath = '/podcasts';
    else if (isWebCam) targetPath = '/webcam';
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

  const handleAddFeed = async (itemTitle: string, itemUrl: string, cat: string, itemType?: string, customImageUrl?: string | null, authorInfo?: { name: string, bio?: string, avatar?: string, banner?: string, bannerOffset?: number }) => {
    if (!auth.currentUser || !itemUrl) {
      showToast("Feed URL fehlt");
      return;
    }

    setAddingIds(prev => [...prev, itemTitle]);
    try {
      let imageUrl = customImageUrl || null;
      let bannerUrl = authorInfo?.banner || authorInfo?.avatar || null;

      if (!imageUrl && !authorInfo) {
        if (itemType === 'webcams') {
          const match = itemUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
          if (match && match[1]) {
            imageUrl = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
          }
        } else {
          const res = await fetch('/api/rss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: itemUrl })
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
        title: itemTitle,
        url: itemUrl,
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
      showToast(`"${itemTitle}" wurde hinzugefügt!`);
    } catch (error) {
      console.error(error);
      showToast('Fehler beim Hinzufügen');
    } finally {
      setAddingIds(prev => prev.filter(id => id !== itemTitle));
    }
  };

  const handleAddRadio = async (itemTitle: string, itemUrl: string, imageUrl?: string, radioCat?: string) => {
    if (!auth.currentUser || !itemUrl) {
      showToast("Stream URL fehlt");
      return;
    }
    
    setAddingIds(prev => [...prev, itemTitle]);
    try {
      await addDoc(collection(db, 'users', auth.currentUser.uid, 'radioStations'), {
        title: itemTitle,
        url: itemUrl,
        imageUrl: imageUrl || null,
        category: radioCat || 'Pop',
        addedAt: Date.now()
      });
      showToast(`"${itemTitle}" wurde hinzugefügt!`);
    } catch (error) {
      console.error(error);
      showToast('Fehler beim Hinzufügen');
    } finally {
      setAddingIds(prev => prev.filter(id => id !== itemTitle));
    }
  };

  const isWebCamItem = (p: any) => p.type === 'webcams' || p.category === 'WebCam' || (p.url && (p.url.includes('/watch') || p.url.includes('youtu.be/')));
  const isYouTubeItem = (p: any) => (p.type === 'youtube' || p.category === 'YouTube' || (p.url && (p.url.includes('/@') || p.url.includes('/channel/') || p.url.includes('/c/') || p.url.includes('feeds/videos.xml')))) && !isWebCamItem(p);
  const isFeedItem = (p: any) => p.type === 'feeds' || (!p.type && !p.isPodcast && p.category !== 'YouTube' && p.category !== 'Podcast' && p.category !== 'Radio' && !isYouTubeItem(p) && !isWebCamItem(p));

  // Filtered & Sorted items computation
  const currentCategoryData = useMemo(() => {
    let rawList: any[] = [];

    if (category === 'feeds') {
      rawList = publicFeeds.filter(isFeedItem);
    } else if (category === 'podcasts') {
      rawList = publicFeeds.filter(p => p.type === 'podcasts' || p.isPodcast || p.category === 'Podcast');
    } else if (category === 'youtube') {
      rawList = publicFeeds.filter(isYouTubeItem);
    } else if (category === 'radio') {
      rawList = publicFeeds.filter(p => p.type === 'radio' || p.category === 'Radio');
    } else if (category === 'webcams') {
      rawList = publicFeeds.filter(isWebCamItem);
    } else if (category === 'blogs') {
      rawList = publicFeeds.filter(item => item.type === 'blogs' && item.addedBy)
        .filter((item, index, self) => {
          if (!item.addedBy) return true;
          return index === self.findIndex((t) => t.addedBy === item.addedBy);
        });
    }

    // Extract unique categories
    const uniqueCats = ['Alle', ...Array.from(new Set(
      rawList.map(item => {
        if (!item.category) return null;
        return item.category.charAt(0).toUpperCase() + item.category.slice(1).toLowerCase();
      }).filter(Boolean)
    )).sort() as string[]];

    // Apply category, language and search filters
    let filtered = rawList.filter(item => {
      if (dbFilterCategory !== 'Alle') {
        const itemCat = item.category?.charAt(0).toUpperCase() + item.category?.slice(1).toLowerCase();
        if (itemCat !== dbFilterCategory) return false;
      }

      if (dbFilterLanguage !== 'Alle') {
        const itemLang = item.language || 'de';
        if (itemLang !== dbFilterLanguage) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const urlMatch = item.url?.toLowerCase().includes(q);
        const authorMatch = item.authorName?.toLowerCase().includes(q) || item.authorBio?.toLowerCase().includes(q);
        if (!titleMatch && !urlMatch && !authorMatch) return false;
      }

      return true;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'subscribed') {
        const isAddedA = category === 'radio' 
          ? userRadio.some(r => r.url === a.url)
          : userFeeds.some(f => f.url === a.url);
        const isAddedB = category === 'radio' 
          ? userRadio.some(r => r.url === b.url)
          : userFeeds.some(f => f.url === b.url);

        if (isAddedA && !isAddedB) return -1;
        if (!isAddedA && isAddedB) return 1;
      }
      
      if (sortBy === 'abc' || sortBy === 'subscribed') {
        const nameA = a.authorName || a.title || '';
        const nameB = b.authorName || b.title || '';
        return nameA.localeCompare(nameB);
      }

      return 0;
    });

    return {
      items: filtered,
      categories: uniqueCats,
      totalCount: filtered.length
    };
  }, [category, publicFeeds, dbFilterCategory, dbFilterLanguage, searchQuery, sortBy, userFeeds, userRadio]);

  const activeThemeColor: 'orange' | 'purple' | 'red' | 'blue' = 
    category === 'podcasts' ? 'purple' :
    category === 'youtube' ? 'red' :
    category === 'radio' ? 'blue' : 'orange';

  const categoryTitles = {
    feeds: { title: tr(settings.language, 'RSS to subscribe', 'RSS zum Abonnieren'), icon: Rss },
    podcasts: { title: tr(settings.language, 'Podcasts to subscribe', 'Podcasts zum Abonnieren'), icon: Podcast },
    youtube: { title: tr(settings.language, 'YouTube to subscribe', 'YouTube Kanäle zum Abonnieren'), icon: Youtube },
    radio: { title: tr(settings.language, 'Webradio to subscribe', 'Webradio zum Abonnieren'), icon: Radio }
  }[category] || { title: 'Quellen entdecken', icon: Rss };

  const HeaderIcon = categoryTitles.icon;

  return (
    <div className="max-w-[2000px] mx-auto pt-4 sm:pt-6 pb-16 px-4 md:px-8 space-y-6">
      
      {/* Top Banner / Add Source Action */}
      <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${
        isDark 
          ? 'bg-neutral-900/80 border-neutral-800' 
          : 'bg-white border-slate-200/90 shadow-2xs'
      }`}>
        <div 
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between p-4 sm:p-5 cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
        >
          <div className="flex items-center gap-3.5">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
              activeThemeColor === 'orange' ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
              activeThemeColor === 'purple' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
              activeThemeColor === 'red' ? 'bg-red-500/10 text-red-600 dark:text-red-400' :
              'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            }`}>
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-semibold text-sm sm:text-base text-neutral-900 dark:text-neutral-100">
                {type === 'youtube' ? tr(settings.language, 'Add YouTube Channel', 'YouTube Kanal hinzufügen') :
                 type === 'radio' ? tr(settings.language, 'Add Radio Station', 'Radio Station hinzufügen') :
                 type === 'podcasts' ? tr(settings.language, 'Add Podcast', 'Podcast hinzufügen') :
                 tr(settings.language, 'Add RSS Feed', 'RSS-Feed hinzufügen')}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {tr(settings.language, 'Add your own custom source via URL', 'Eigene Quelle per URL erfassen und verwalten')}
              </p>
            </div>
          </div>

            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors hidden sm:inline-block ${
                isOpen 
                  ? 'bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200' 
                  : 'bg-neutral-100 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-400'
              }`}>
                {isOpen ? tr(settings.language, 'Close', 'Schließen') : tr(settings.language, 'Enter URL', 'Erfassen')}
              </span>
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
          </div>

          {/* Collapsible Form */}
          {isOpen && (
            <div className="px-4 pb-5 pt-1 border-t border-neutral-100 dark:border-neutral-800/80 sm:px-6">
              <form onSubmit={handleManualSubmit} className="space-y-4 mt-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      URL {type === 'radio' && <span className="text-orange-500">*</span>}
                    </span>
                    <input 
                      required 
                      type="url" 
                      placeholder={
                        type === 'radio' ? 'http://stream.example.com/live.mp3' :
                        type === 'youtube' ? 'https://www.youtube.com/@channel' :
                        type === 'webcams' ? 'https://www.youtube.com/watch?v=...' :
                        'https://example.com/rss.xml'
                      } 
                      value={url} 
                      onChange={e => setUrl(e.target.value)} 
                      className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${
                        isDark 
                          ? 'bg-neutral-850 border-neutral-700 focus:border-neutral-400 text-white' 
                          : 'bg-slate-50 border-slate-300 focus:border-slate-500 text-neutral-900'
                      }`} 
                    />
                  </label>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {tr(settings.language, 'Title', 'Titel')} {type === 'radio' ? <span className="text-orange-500">*</span> : <span className="text-neutral-400">(Optional)</span>}
                    </span>
                    <input 
                      required={type === 'radio'} 
                      type="text" 
                      placeholder={tr(settings.language, "My Station / Feed", "Mein Sender / Feed")} 
                      value={title} 
                      onChange={e => setTitle(e.target.value)} 
                      className={`px-3 py-2 text-sm rounded-lg border outline-none transition-colors ${
                        isDark 
                          ? 'bg-neutral-850 border-neutral-700 focus:border-neutral-400 text-white' 
                          : 'bg-slate-50 border-slate-300 focus:border-slate-500 text-neutral-900'
                      }`} 
                    />
                  </label>

                  {/* Category / Genre Dropdown */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {type === 'radio' ? 'Genre' : tr(settings.language, 'Category', 'Kategorie')}
                    </span>
                    {type === 'radio' ? (
                      <select 
                        value={radioGenre} 
                        onChange={e => setRadioGenre(e.target.value)} 
                        className={`px-3 py-2 text-sm rounded-lg border outline-none ${
                          isDark ? 'bg-neutral-850 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-neutral-900'
                        }`}
                      >
                        {['Pop', '60s', '70s', '80s', '90s', 'Game Music', 'Black', 'Rock', 'Heavy Metal', 'Relax', 'KPop', 'Nachrichten', 'Klassik', 'Dance / Electronic', 'Hip Hop', 'Jazz', 'Country', 'Volksmusik', 'Rap', 'Schlager', 'Techno'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                    ) : type === 'webcams' ? (
                      <select 
                        value={feedCategory} 
                        onChange={e => setFeedCategory(e.target.value)} 
                        className={`px-3 py-2 text-sm rounded-lg border outline-none ${
                          isDark ? 'bg-neutral-850 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-neutral-900'
                        }`}
                      >
                        {['WebCam', 'Tiere', 'Reisen', 'Weltraum', 'Natur', 'Stadt'].map(c => (
                          <option key={c} value={c}>{t('cat-' + c, c)}</option>
                        ))}
                      </select>
                    ) : (
                      <select 
                        value={feedCategory} 
                        onChange={e => setFeedCategory(e.target.value)} 
                        className={`px-3 py-2 text-sm rounded-lg border outline-none ${
                          isDark ? 'bg-neutral-850 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-neutral-900'
                        }`}
                      >
                        {FEED_CATEGORIES.map(cat => (
                          <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                        ))}
                      </select>
                    )}
                  </label>

                  {/* Language Selector */}
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      {tr(settings.language, 'Language', 'Sprache')}
                    </span>
                    <select 
                      value={sourceLanguage} 
                      onChange={e => setSourceLanguage(e.target.value)} 
                      className={`px-3 py-2 text-sm rounded-lg border outline-none ${
                        isDark ? 'bg-neutral-850 border-neutral-700 text-white' : 'bg-slate-50 border-slate-300 text-neutral-900'
                      }`}
                    >
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="es">🇪🇸 Español</option>
                      <option value="none">🌐 {tr(settings.language, 'Other / None', 'Andere / Keine')}</option>
                    </select>
                  </label>
                </div>

                {/* Optional Icon / Favicon & Public share */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-neutral-100 dark:border-neutral-800/80">
                  <div className="flex items-center gap-3">
                    {icon ? (
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
                        <img loading="lazy" src={icon} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        <button type="button" onClick={() => setIcon(null)} className="absolute inset-0 bg-black/60 text-white flex items-center justify-center text-xs opacity-0 hover:opacity-100 transition-opacity">✕</button>
                      </div>
                    ) : (
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:border-neutral-400 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>Eigenes Icon (opt.)</span>
                        <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                      </label>
                    )}

                    <label className="inline-flex items-center gap-2 cursor-pointer ml-2">
                      <input 
                        type="checkbox" 
                        checked={sharePublicly} 
                        onChange={e => setSharePublicly(e.target.checked)} 
                        className="w-4 h-4 rounded text-neutral-900 border-neutral-300 dark:border-neutral-700 focus:ring-0"
                      />
                      <span className="text-xs text-neutral-600 dark:text-neutral-400">Zur gemeinsamen Datenbank beitragen</span>
                    </label>
                  </div>

                  <button 
                    disabled={loading} 
                    type="submit" 
                    className={`inline-flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 ${
                      activeThemeColor === 'orange' ? 'bg-orange-600 hover:bg-orange-700 text-white' :
                      activeThemeColor === 'purple' ? 'bg-purple-600 hover:bg-purple-700 text-white' :
                      activeThemeColor === 'red' ? 'bg-red-600 hover:bg-red-700 text-white' :
                      'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    <span>{tr(settings.language, 'Save Source', 'Quelle speichern')}</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

      {/* Main Section Header */}
      <div className="pt-2">
        <div className="flex items-center gap-2.5 mb-4">
          <HeaderIcon className={`w-5 h-5 ${
            activeThemeColor === 'orange' ? 'text-orange-500' :
            activeThemeColor === 'purple' ? 'text-purple-500' :
            activeThemeColor === 'red' ? 'text-red-500' :
            'text-blue-500'
          }`} />
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            {categoryTitles.title}
          </h2>
        </div>

        {/* Filter Bar */}
        <DiscoverFilterBar 
          categories={currentCategoryData.categories}
          selectedCategory={dbFilterCategory}
          onSelectCategory={setDbFilterCategory}
          selectedLanguage={dbFilterLanguage}
          onSelectLanguage={setDbFilterLanguage}
          sortBy={sortBy}
          onSelectSort={setSortBy}
          colorTheme={activeThemeColor}
          totalCount={currentCategoryData.totalCount}
          hideLanguage={category === 'webcams'}
        />

        {/* Card Grid */}
        {currentCategoryData.items.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800">
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              {tr(settings.language, 'No sources found for this filter.', 'Keine Quellen für diese Filterauswahl gefunden.')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {currentCategoryData.items.map((item, idx) => {
              const isAlreadyAdded = category === 'radio'
                ? userRadio.some(r => r.url === item.url)
                : userFeeds.some(f => f.url === item.url);

              const matchingItem = category === 'radio'
                ? userRadio.find(r => r.url === item.url)
                : userFeeds.find(f => f.url === item.url);

              return (
                <DiscoverCard 
                  key={`discover-${category}-${typeof item.id === 'string' ? item.id : ''}-${item.url || ''}-${idx}`}
                  item={item}
                  category={category}
                  isAlreadyAdded={isAlreadyAdded}
                  matchingItem={matchingItem}
                  isAdding={addingIds.includes(item.title)}
                  isPreviewing={previewingIds.includes(item.url)}
                  isAdmin={isAdmin}
                  onAdd={(targetItem, fallbackImg) => {
                    if (category === 'radio') {
                      handleAddRadio(targetItem.title, targetItem.url, targetItem.imageUrl || fallbackImg, targetItem.category);
                    } else if (category === 'blogs') {
                      handleAddFeed(targetItem.title, targetItem.url, 'Blogs', 'blogs', targetItem.imageUrl, {
                        name: targetItem.authorName || 'Unknown',
                        bio: targetItem.authorBio,
                        avatar: targetItem.authorAvatar,
                        banner: targetItem.authorBanner,
                        bannerOffset: targetItem.authorBannerOffset
                      });
                    } else {
                      handleAddFeed(targetItem.title, targetItem.url, targetItem.category || 'Allgemein', category, fallbackImg);
                    }
                  }}
                  onDeleteUserSource={(id, isRad) => handleDeleteFeed(id, isRad)}
                  onCardClick={handleDiscoverCardClick}
                  onEdit={(targetItem) => setEditingSource(targetItem)}
                  onDeletePublic={(id) => handleDeletePublicFeed(id, item.url)}
                  onPreviewPodcast={handlePreviewPodcast}
                  onPreviewRadio={handlePreviewRadio}
                  onAuthorClick={(authorId) => navigate(`/blogs/author/${authorId}`, { state: { internal: true } })}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Admin / Edit Source Modal */}
      {editingSource && createPortal(
        <div className="fixed inset-0 z-[99999] overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => { setEditingSource(null); setEditFile(null); setEditError(null); }}>
          <div 
            onClick={e => e.stopPropagation()} 
            className={`relative w-full max-w-md rounded-2xl p-6 shadow-xl ${isDark ? 'bg-neutral-900 border border-neutral-800 text-white' : 'bg-white text-gray-900'} my-auto`}
          >
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-lg font-bold">
                {editingSource.isRadio ? tr(settings.language, 'Edit Radio Station', 'Radiosender bearbeiten') : 
                 (editingSource.isPodcast || editingSource.type === 'podcasts') ? tr(settings.language, 'Edit Podcast', 'Podcast bearbeiten') : 
                 editingSource.type === 'youtube' ? tr(settings.language, 'Edit YouTube Channel', 'YouTube Kanal bearbeiten') : 
                 tr(settings.language, 'Edit RSS', 'RSS bearbeiten')}
              </h2>
              <button onClick={() => { setEditingSource(null); setEditFile(null); setEditError(null); }} className="p-1 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
                <X className="w-5 h-5 text-neutral-400" />
              </button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1 text-neutral-700 dark:text-neutral-300">Titel</label>
                <input 
                  type="text" 
                  value={editingSource.title || ''} 
                  onChange={e => setEditingSource({...editingSource, title: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-neutral-700 dark:text-neutral-300">URL</label>
                <input 
                  type="url" 
                  value={editingSource.url || ''} 
                  onChange={e => setEditingSource({...editingSource, url: e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                  {editingSource.isRadio ? 'Genre' : tr(settings.language, 'Category', 'Kategorie')}
                </label>
                {editingSource.isRadio ? (
                  <select
                    value={editingSource.category || ''}
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  >
                    <option value="">{tr(settings.language, 'Please select...', 'Auswählen...')}</option>
                    {['Pop', '60s', '70s', '80s', '90s', 'Game Music', 'Black', 'Rock', 'Heavy Metal', 'Relax', 'KPop', 'Nachrichten', 'Klassik', 'Dance / Electronic', 'Hip Hop', 'Jazz', 'Country', 'Volksmusik', 'Rap', 'Schlager', 'Techno'].map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                ) : editingSource.type === 'webcams' ? (
                  <select
                    value={editingSource.category || ''}
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  >
                    {['WebCam', 'Tiere', 'Reisen', 'Weltraum', 'Natur', 'Stadt'].map(c => (
                      <option key={c} value={c}>{t('cat-' + c, c)}</option>
                    ))}
                  </select>
                ) : (editingSource.isPodcast || editingSource.type === 'podcasts') ? (
                  <select 
                    value={editingSource.category || ''} 
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  >
                    <option value="" disabled>{tr(settings.language, 'Please select...', 'Bitte wählen...')}</option>
                    {['Nachrichten', 'Politik', 'Wirtschaft', 'Wissen', 'True Crime', 'Comedy', 'Unterhaltung', 'Gaming', 'Gesellschaft', 'Kultur', 'Interview', 'Tech', 'Allgemein'].map(cat => (
                      <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                    ))}
                  </select>
                ) : (
                  <select 
                    value={editingSource.category || ''} 
                    onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                    className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                  >
                    <option value="" disabled>{tr(settings.language, 'Please select...', 'Bitte wählen...')}</option>
                    {FEED_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                  {tr(settings.language, 'Language', 'Sprache')}
                </label>
                <select
                  value={editingSource.language || 'none'}
                  onChange={e => setEditingSource({...editingSource, language: e.target.value === 'none' ? '' : e.target.value})}
                  className={`w-full px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700' : 'bg-gray-50 border-gray-200'} outline-none`}
                >
                  <option value="none">🌐 {tr(settings.language, 'Other / None', 'Andere / Keine')}</option>
                  <option value="de">🇩🇪 Deutsch</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="fr">🇫🇷 Français</option>
                  <option value="es">🇪🇸 Español</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300">
                    {(editingSource.isPodcast || editingSource.type === 'podcasts') ? 'Podcast Cover / Artwork' : 'Icon / Logo'}
                  </label>
                  {(editFile || editingSource.imageUrl || editingSource.faviconUrl) && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditFile(null);
                        setEditingSource({ ...editingSource, imageUrl: '', faviconUrl: '' });
                      }}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 font-semibold"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Cover entfernen
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3.5">
                  {(editFile || editingSource.imageUrl || editingSource.faviconUrl) ? (
                    <img 
                      loading="lazy" 
                      src={editFile ? URL.createObjectURL(editFile) : (editingSource.imageUrl || editingSource.faviconUrl)} 
                      alt="" 
                      className="w-14 h-14 rounded-xl object-cover border border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800 shadow-xs shrink-0" 
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        (e.target as HTMLElement).style.opacity = '0.3';
                      }}
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 flex items-center justify-center text-neutral-400 bg-neutral-50 dark:bg-neutral-800/50 shrink-0">
                      <ImageIcon className="w-6 h-6 opacity-60" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 flex-1 min-w-0">
                    <input 
                      type="url"
                      value={editingSource.imageUrl || editingSource.faviconUrl || ''}
                      onChange={e => {
                        setEditFile(null);
                        setEditingSource({
                          ...editingSource,
                          imageUrl: e.target.value,
                          faviconUrl: editingSource.isRadio ? e.target.value : editingSource.faviconUrl
                        });
                      }}
                      placeholder="https://... Bild-URL einfügen"
                      className={`w-full px-3 py-1.5 text-xs rounded-lg border ${isDark ? 'bg-neutral-800 border-neutral-700 text-white' : 'bg-gray-50 border-gray-200 text-gray-800'} outline-none`}
                    />
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        accept="image/*"
                        id="edit-upload"
                        className="hidden"
                        onChange={e => {
                          if (e.target.files && e.target.files[0]) {
                            setEditFile(e.target.files[0]);
                            setEditError(null);
                          }
                        }}
                      />
                      <label 
                        htmlFor="edit-upload"
                        className={`px-3 py-1.5 cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition-colors w-fit ${
                          isDark ? 'bg-neutral-800 hover:bg-neutral-700 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {editFile ? 'Anderes Bild wählen' : 'Datei hochladen'}
                      </label>
                      <span className="text-[10px] text-neutral-400">JPG, PNG, WebP (max 512px)</span>
                    </div>
                  </div>
                </div>
              </div>

              {editError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="flex-1">{editError}</span>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={editUploading}
                  className="w-full bg-neutral-900 hover:bg-black dark:bg-white dark:hover:bg-neutral-200 text-white dark:text-black font-semibold py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm shadow-sm"
                >
                  {editUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
