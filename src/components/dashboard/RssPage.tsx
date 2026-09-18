import { tr } from '../../lib/t';
import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useMedia } from '../../context/MediaContext';
import { useTranslation } from '../../hooks/useTranslation';
import { HeroBanner } from './HeroBanner';
import { FileText, Loader2, Bookmark, Star, LayoutDashboard, X, ArrowLeft, Headphones, Youtube, Rss, Play, Pause, ChevronLeft, ChevronRight, Maximize, Minimize, Camera, CheckCheck, AlertTriangle, Square, Video, Radio, Trash2, Sparkles, Compass, Plus, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db, OperationType, handleFirestoreError } from '../../lib/firebase';
import { getCanonicalOrigin, handleInternalLinkClick, isInternalBlogLink, getInternalBlogPath, normalizeLinks } from '../../lib/utils';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc, getDoc, where, orderBy, getDocs, limit, addDoc } from 'firebase/firestore';
import { FEED_CATEGORIES } from '../../lib/constants';
import { exportToOPML, importFromOPML } from '../../lib/opml';
import { DEFAULT_SOURCES } from '../../lib/defaultSources';
import { useCustomModal } from '../../context/ModalContext';
import { 
  getCachedCategoryItems, 
  setCachedCategoryItems, 
  getCachedCategoryFeeds, 
  setCachedCategoryFeeds, 
  getCachedFeed, 
  setCachedFeed 
} from '../../lib/storage';

interface Feed {
  id: string;
  url: string;
  title: string;
  type?: string;
  category?: string;
  imageUrl?: string;
  customImageUrl?: string;
  originalImageUrl?: string;
  bannerUrl?: string;
  isPodcast?: boolean;
  lastReadAt?: number;
  isStarred?: boolean;
  isReadLater?: boolean;
}

interface RssItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  contentSnippet?: string;
  feedTitle: string;
  feedId?: string;
  feedUrl?: string;
  feedImageUrl?: string;
  timestamp: number;
  imageUrl?: string;
  faviconUrl?: string;
  category?: string;
  language?: string;
  authorId?: string;
  enclosure?: { url: string; type?: string; length?: string };
}

type ViewMode = 'list' | 'grid' | 'magazine';

function getFavicon(url: string) {
  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname;
    
    // Custom overrides for better quality favicons
    if (domain.includes('20min.ch')) return 'https://www.20min.ch/favicon.ico';
    if (domain.includes('blick.ch')) return 'https://www.blick.ch/favicon.ico';
    if (domain.includes('nzz.ch')) return 'https://www.nzz.ch/favicon.ico';
    if (domain.includes('tagesanzeiger.ch')) return 'https://www.tagesanzeiger.ch/favicon.ico';
    if (domain.includes('srf.ch')) return 'https://www.srf.ch/favicon.ico';
    if (domain.includes('youtube.com')) return 'https://www.youtube.com/favicon.ico';
    if (domain.includes('wikipedia.org')) return 'https://en.wikipedia.org/favicon.ico';

    return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  } catch (e) {
    return undefined;
  }
}

function formatDate(dateStr: any) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  } catch (e) {
    return '';
  }
}

function formatTime(dateStr: any) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function formatDateTime(dateStr: any) {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch (e) {
    return '';
  }
}

const authorProfileCache = new Map<string, { displayName?: string, avatarUrl?: string }>();

interface AuthorAvatarProps {
  userId: string;
  fallbackFavicon?: string;
  className?: string;
}

const AuthorAvatar: React.FC<AuthorAvatarProps> = ({ userId, fallbackFavicon, className }) => {
  const [avatar, setAvatar] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let active = true;
    const cached = authorProfileCache.get(userId);
    if (cached) {
      setAvatar(cached.avatarUrl || null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          const avatarUrl = data?.avatarUrl || data?.avatar || null;
          if (active) {
            authorProfileCache.set(userId, { 
              displayName: data?.displayName || data?.name, 
              avatarUrl 
            });
            setAvatar(avatarUrl);
          }
        }
      } catch (err) {
        console.error("Error fetching author avatar:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      active = false;
    };
  }, [userId]);

  if (loading) {
    return (
      <div className={`animate-pulse bg-gray-200 dark:bg-neutral-800 shrink-0 ${className}`} />
    );
  }

  if (avatar) {
    return (
      <img loading="lazy" 
        src={avatar} 
        alt="" 
        className={`object-cover shrink-0 ${className}`} 
        referrerPolicy="no-referrer" 
      />
    );
  }

  if (fallbackFavicon) {
    return (
      <img loading="lazy" 
        src={fallbackFavicon} 
        alt="" 
        className={`object-cover shrink-0 ${className}`} 
        referrerPolicy="no-referrer" 
      />
    );
  }

  return (
    <div className={`bg-yellow-500/20 text-yellow-500 flex items-center justify-center text-[8px] font-bold shrink-0 ${className}`}>
      A
    </div>
  );
};

let isLocalStorageQuotaExceeded = false;

function safeLocalStorageSetItem(key: string, value: string) {
  if (isLocalStorageQuotaExceeded && (key.startsWith('rss_v5_') || key.startsWith('cached_items_') || key.startsWith('cached_feeds_'))) {
    return;
  }
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (key.startsWith('rss_v5_')) {
      // Just ignore caching for this individual feed if quota exceeded, no big deal
      isLocalStorageQuotaExceeded = true;
      console.log("[Storage] LocalStorage quota exceeded. Skipping individual feed cache.");
    } else {
      // For important caches (cached_items_ or cached_feeds_), try to make room by removing old rss_v5_ items
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('rss_v5_')) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        localStorage.setItem(key, value);
      } catch (retryError: any) {
        isLocalStorageQuotaExceeded = true;
        console.log("[Storage] LocalStorage cache quota exceeded, caching disabled for session.");
      }
    }
  }
}

function extractHtmlImage(htmlContent: string | undefined | null): string | undefined {
  if (!htmlContent || typeof htmlContent !== 'string') return undefined;
  const match = htmlContent.match(/<img\s+[^>]*?(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/i);
  if (match && match[1]) {
    const src = match[1].replace(/&amp;/g, '&').trim();
    if (!src.includes('pixel') && !src.includes('spacer') && !src.includes('1x1') && !src.includes('favicon') && src.length > 8) {
      return src;
    }
  }
  const srcsetMatch = htmlContent.match(/<img\s+[^>]*?(?:srcset|data-srcset)=["']([^"'\s,]+)/i);
  if (srcsetMatch && srcsetMatch[1]) {
    const src = srcsetMatch[1].replace(/&amp;/g, '&').trim();
    if (src.length > 8 && !src.includes('pixel')) return src;
  }
  return undefined;
}

function slimRssItemForCache(item: RssItem): any {
  return {
    id: item.id,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    contentSnippet: item.contentSnippet ? item.contentSnippet.substring(0, 120) : undefined,
    feedTitle: item.feedTitle,
    feedId: item.feedId,
    feedUrl: item.feedUrl,
    feedImageUrl: item.feedImageUrl,
    timestamp: item.timestamp,
    imageUrl: item.imageUrl,
    faviconUrl: item.faviconUrl,
    category: item.category,
    enclosure: item.enclosure ? {
      url: item.enclosure.url,
      type: item.enclosure.type
    } : undefined
  };
}

function slimFeedResponse(data: any): any {
  if (!data) return data;
  return {
    title: data.title,
    link: data.link,
    description: data.description,
    image: data.image,
    bannerUrl: data.bannerUrl,
    isPodcast: data.isPodcast,
    items: (data.items || [])
      .filter((item: any) => item && item.title && typeof item.title === 'string' && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'ohne titel')
      .slice(0, 15)
      .map((item: any) => {
        let parsedImageUrl = item.imageUrl || item.image?.url;
        if (!parsedImageUrl) {
          const htmlContent = item.content || item['content:encoded'] || item.contentEncoded || item.description || item.summary || '';
          parsedImageUrl = extractHtmlImage(htmlContent);
        }
        
        const contentStr = item.content || item['content:encoded'] || item.contentEncoded || '';
        const snippetStr = item.contentSnippet || '';
        
        return {
          guid: item.guid,
          id: item.id || item.guid,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          contentSnippet: snippetStr.substring(0, 200),
          content: contentStr.length > 300 ? contentStr.substring(0, 300) + '...' : contentStr,
          creator: item.creator || item.author,
          imageUrl: parsedImageUrl,
          enclosure: item.enclosure ? (
            Array.isArray(item.enclosure) ? (
              item.enclosure.length > 0 ? {
                url: item.enclosure[0].url || item.enclosure[0].href || '',
                type: item.enclosure[0].type || ''
              } : undefined
            ) : {
              url: item.enclosure.url || item.enclosure.href || '',
              type: item.enclosure.type || ''
            }
          ) : undefined
        };
      })
  };
}


const ScreensaverContainer = ({ items, settings, handleItemClick, setViewMode, setSelectedChannelId }: { items: RssItem[], settings: any, handleItemClick: (e: React.MouseEvent, item: RssItem) => void, setViewMode: (val: ViewMode) => void, setSelectedChannelId: (id: string | null) => void }) => {
  const [stableItems, setStableItems] = useState<RssItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Stabilize items when updating dynamically in the background
  useEffect(() => {
    if (items.length === 0) {
      setStableItems([]);
      return;
    }
    // If stable list is currently empty, update immediately for fast starting
    if (stableItems.length === 0) {
      setStableItems(items);
      return;
    }
    // Otherwise, debounce changes to block rapid sub-second XML chunk increments
    const timer = setTimeout(() => {
      setStableItems(items);
    }, 1200);
    return () => clearTimeout(timer);
  }, [items]);

  const validItems = useMemo(() => {
    return (stableItems || []).sort((a, b) => b.timestamp - a.timestamp);
  }, [stableItems]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [validItems.length]);

  useEffect(() => {
    if (validItems.length === 0) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validItems.length);
    }, 10000); // 10 seconds per item
    return () => clearInterval(timer);
  }, [validItems.length]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log(`Fullscreen error: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (validItems.length === 0) {
    return <div className="p-12 text-center opacity-50">{tr(settings.language, 'No messages available.', 'Keine Meldungen verfügbar.')}</div>;
  }

  const item = validItems[currentIndex];
  const date = new Date(item.pubDate);
  const isYoutube = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');

  return createPortal(
    <div className={`fixed inset-0 z-[99999] bg-black overflow-hidden flex flex-col`}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`screensaver-item-${item.id}-${currentIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
        >
          {/* Background Image filling the screen */}
          {item.imageUrl ? (
            <motion.img 
              src={proxyImageUrl(item.imageUrl)} 
              className="absolute inset-0 w-full h-full object-cover opacity-20 blur-2xl saturate-150" 
              alt="" 
              referrerPolicy="no-referrer"
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              transition={{ duration: 10, ease: "easeOut" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 border border-white/10 opacity-50">
              {isYoutube ? <Youtube className="w-48 h-48 opacity-20 text-white" /> : <FileText className="w-48 h-48 opacity-20 text-white" />}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent pointer-events-none" />

          {/* Image sliding UP */}
          <motion.div 
             className="absolute z-10 w-[90%] md:w-[60%] lg:w-[50%] left-[5%] md:left-[5%] pointer-events-auto"
             initial={{ y: "100vh", opacity: 0, scale: 1 }}
             animate={{ 
               y: ["100vh", "5vh", "-5vh", "-100vh"],
               opacity: [0, 1, 1, 0],
               scale: [1, 1.1, 1.15, 1.25]
             }}
             transition={{ 
               duration: 10,
               times: [0, 0.2, 0.8, 1],
               ease: ["easeOut", "linear", "easeIn"]
             }}
          >
               {item.imageUrl && (
                 <div className="w-full aspect-video rounded-3xl overflow-hidden relative ring-1 ring-white/20 bg-black">
                    <img loading="lazy" src={proxyImageUrl(item.imageUrl)} className="w-full h-full object-cover" alt="" style={{ transform: 'scale(1.15)', transformOrigin: 'center' }} referrerPolicy="no-referrer" />
                 </div>
               )}
          </motion.div>

          {/* Text sliding DOWN */}
          <motion.div 
             className="absolute z-20 w-[95%] md:w-[60%] lg:w-[50%] right-[2%] md:right-[5%] pointer-events-auto"
             initial={{ y: "-100vh", opacity: 0 }}
             animate={{ 
               y: ["-100vh", "-8vh", "8vh", "100vh"], 
               opacity: [0, 1, 1, 0]
             }}
             transition={{ 
               duration: 10,
               times: [0, 0.2, 0.8, 1],
               ease: ["easeOut", "linear", "easeIn"]
             }}
          >
             <div className="w-full flex-1 flex flex-col text-white bg-black/50 backdrop-blur-3xl p-8 md:p-12 rounded-3xl border border-white/10 relative overflow-hidden">
               {/* Noise Texture */}
               <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
               <a href={item.link} target="_blank" rel="noopener noreferrer" onClick={(e) => handleItemClick(e, item)} className="inline-block group focus:outline-none mb-2 relative z-10">
                 <div 
                   onClick={(e) => {
                     if (item.feedId) {
                       e.preventDefault();
                       e.stopPropagation();
                       if (document.fullscreenElement) {
                         document.exitFullscreen().catch(() => {});
                       }
                       setSelectedChannelId(item.feedId);
                       setViewMode(settings.viewMode || 'list');
                     }
                   }}
                   className="flex items-center gap-4 mb-6 cursor-pointer hover:underline relative z-20"
                 >
                    {isYoutube && item.feedImageUrl ? (
                      <img loading="lazy" src={proxyImageUrl(item.feedImageUrl)} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/20 bg-white" alt="" referrerPolicy="no-referrer" />
                    ) : item.faviconUrl ? (
                      <img loading="lazy" src={proxyImageUrl(item.faviconUrl)} className="w-10 h-10 rounded bg-white p-0.5" alt="" referrerPolicy="no-referrer" />
                    ) : (
                      <FileText className="w-10 h-10 opacity-80" />
                    )}
                    <span className="text-2xl md:text-3xl font-medium tracking-wide text-white/90">{item.feedTitle}</span>
                    <span className="text-xl md:text-2xl opacity-60 ml-4 border-l border-white/30 pl-4 font-mono">
                      {formatTime(item.pubDate)}
                    </span>
                 </div>

                 <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold leading-tight mb-4 group-hover:text-orange-400 transition-colors line-clamp-3">
                   {item.title}
                 </h1>

                 {item.contentSnippet && (
                   <p className="text-base md:text-xl opacity-80 leading-relaxed line-clamp-4 text-gray-200 tracking-wide font-medium">
                     {item.contentSnippet}
                   </p>
                 )}
               </a>
             </div>
          </motion.div>

          {/* Link sliding right */}
          <motion.a 
             href={item.link}
             target="_blank" 
             rel="noopener noreferrer"
             onClick={(e) => handleItemClick(e, item)}
             className="absolute z-30 bottom-12 left-12 flex items-center gap-4 bg-black/50 hover:bg-black/70 backdrop-blur-3xl px-6 py-4 rounded-2xl border border-white/10 transition-all pointer-events-auto hover:text-white overflow-hidden"
             initial={{ x: "-100vw", opacity: 0 }}
             animate={{ 
               x: ["-100vw", "0vw", "0vw", "100vw"], 
               opacity: [0, 1, 1, 0]
             }}
             transition={{ 
               duration: 10,
               times: [0, 0.2, 0.8, 1],
               ease: ["easeOut", "linear", "easeIn"]
             }}
             title="Zum Artikel"
          >
             {/* Noise Texture */}
             <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>
             <Rss className="w-8 h-8 text-white relative z-10" />
             <div className="flex flex-col text-white relative z-10">
               <span className="text-sm opacity-80 font-medium tracking-wide">Link öffnen</span>
               <span className="font-bold line-clamp-1 max-w-[250px]">{item.feedTitle}</span>
             </div>
          </motion.a>
        </motion.div>
      </AnimatePresence>

      {/* Top Right Controls */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-4">
        <button 
          onClick={toggleFullscreen}
          className="p-4 bg-black/40 hover:bg-black/80 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-all hover:scale-110 border border-white/10"
          title="Fullscreen"
        >
          {isFullscreen ? <Minimize className="w-6 h-6" /> : <Maximize className="w-6 h-6" />}
        </button>
        
        <button 
          onClick={() => setViewMode('grid')}
          className="p-4 bg-black/40 hover:bg-black/80 hover:bg-red-500/80 backdrop-blur-md rounded-full text-white/80 hover:text-white transition-all hover:scale-110 border border-white/10"
          title="Schließen"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>,
    document.body
  );
};



function proxyImageUrl(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  if (typeof url !== 'string') return url;
  if (url.includes('da720bc5-6fe3-b09b-65c9-9430c5e13589') || url.includes('mza_1079549307223055428')) {
    url = 'https://lagedernation.org/wp-content/blogs.dir/10/files/2020/06/apple_podcast_artwork_reverse.png';
  }
  if (
    url.startsWith('/') || 
    url.startsWith('data:') || 
    url.startsWith('blob:') || 
    url.includes('/api/image-proxy') ||
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('googleusercontent.com')
  ) {
    return url;
  }
  return `/api/image-proxy?url=${encodeURIComponent(url)}`;
}

function findPublicSource(feedUrl: string | undefined, feedTitle: string | undefined, publicSources: any[]): any {
  if (!feedUrl && !feedTitle) return undefined;
  
  const cleanUrl = (url: string) => {
    return url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .replace(/\/feed\/?$/, '')
      .replace(/\/m4a\/?$/, '')
      .replace(/\/mp3\/?$/, '');
  };

  const normUrl = feedUrl ? cleanUrl(feedUrl) : '';
  const normTitle = feedTitle ? feedTitle.toLowerCase().trim() : '';

  // 1. Try exact URL match
  if (feedUrl) {
    const exact = publicSources.find(p => p.url === feedUrl);
    if (exact) return exact;
  }

  // 2. Try normalized URL match (ignoring http/https, www, trailing slash and common paths)
  if (normUrl) {
    const match = publicSources.find(p => p.url && cleanUrl(p.url) === normUrl);
    if (match) return match;
  }

  // 3. Try title containment or exact title match
  if (normTitle) {
    const match = publicSources.find(p => {
      const pTitle = (p.title || '').toLowerCase().trim();
      return pTitle === normTitle || pTitle.includes(normTitle) || normTitle.includes(pTitle);
    });
    if (match) return match;
  }

  return undefined;
}

function getFeedImageUrl(feed: any, publicSource?: any): string | undefined {
  if (!feed) return undefined;

  // 1. Explicit custom cover set by user or saved in database (HIGHEST priority)
  const customCover = feed.customImageUrl || publicSource?.customImageUrl;
  if (customCover && typeof customCover === 'string' && customCover.trim()) {
    return proxyImageUrl(customCover.trim());
  }

  // Known broken URLs or podcasts fallback
  const lowerTitle = (feed.title || '').toLowerCase();
  const lowerUrl = (feed.url || '').toLowerCase();
  if (lowerTitle.includes('lage der nation') || lowerUrl.includes('lagedernation') || lowerUrl.includes('ldn-mp3')) {
    return proxyImageUrl('https://lagedernation.org/wp-content/blogs.dir/10/files/2020/06/apple_podcast_artwork_reverse.png');
  }

  // 2. Curated or updated public source image
  if (publicSource?.imageUrl && typeof publicSource.imageUrl === 'string' && publicSource.imageUrl.trim()) {
    const pImg = publicSource.imageUrl.trim();
    if (!pImg.includes('mza_11977799580453303866')) {
      return proxyImageUrl(pImg);
    }
  }

  // 3. User feed imageUrl
  if (feed.imageUrl && typeof feed.imageUrl === 'string' && feed.imageUrl.trim()) {
    const fImg = feed.imageUrl.trim();
    if (!fImg.includes('mza_11977799580453303866')) {
      return proxyImageUrl(fImg);
    }
  }

  // 4. Fallback for Bits und so ONLY if no custom cover was uploaded/available
  if (lowerTitle.includes('bits und so') || lowerTitle.includes('bitsundso') || lowerUrl.includes('bitsundso') || lowerUrl.includes('bits-und-so')) {
    return `/api/image-proxy?url=${encodeURIComponent("https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bf/16/da/bf16da2d-abfa-ee92-a16f-cb9629b35b67/mza_18047970425501861730.png/600x600bb.jpg")}`;
  }

  // 5. Fallback to RSS feed original image from raw feed XML
  if (feed.originalImageUrl && typeof feed.originalImageUrl === 'string' && feed.originalImageUrl.trim()) {
    const oImg = feed.originalImageUrl.trim();
    if (!oImg.includes('mza_11977799580453303866')) {
      return proxyImageUrl(oImg);
    }
  }

  // 6. Favicon fallback
  if (feed.faviconUrl && typeof feed.faviconUrl === 'string' && feed.faviconUrl.trim()) {
    return proxyImageUrl(feed.faviconUrl.trim());
  }

  return undefined;
}

interface FadeInImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'onError'> {
  priority?: boolean;
  onError?: (e: React.SyntheticEvent<HTMLImageElement, Event>) => void;
  fallbackFavicon?: string;
  feedTitle?: string;
}

function FadeInImage({ 
  src, 
  alt, 
  className = "", 
  onError, 
  priority = false, 
  fallbackFavicon,
  feedTitle,
  ...props 
}: FadeInImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string | undefined>(() => proxyImageUrl(src));
  const [failed, setFailed] = useState(false);
  const [triedFallback, setTriedFallback] = useState(false);
  const [triedWeserv, setTriedWeserv] = useState(false);

  useEffect(() => {
    setCurrentSrc(proxyImageUrl(src));
    setFailed(false);
    setTriedFallback(false);
    setTriedWeserv(false);
  }, [src]);

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // 1. If direct image failed, try internal server-proxy fallback once
    if (currentSrc && !triedFallback && !currentSrc.includes('/api/image-proxy') && currentSrc.startsWith('http')) {
      setTriedFallback(true);
      setCurrentSrc(`/api/image-proxy?url=${encodeURIComponent(currentSrc)}`);
      return;
    }
    // 2. If image or proxy failed, try global weserv.nl CDN proxy directly in browser before giving up
    if (currentSrc && !triedWeserv) {
      setTriedWeserv(true);
      let rawUrl = currentSrc;
      if (rawUrl.includes('/api/image-proxy?url=')) {
        try {
          rawUrl = decodeURIComponent(rawUrl.split('/api/image-proxy?url=')[1]);
        } catch (err) {}
      }
      if (rawUrl.startsWith('http') && !rawUrl.includes('images.weserv.nl')) {
        setCurrentSrc(`https://images.weserv.nl/?url=${encodeURIComponent(rawUrl)}`);
        return;
      }
    }
    setFailed(true);
    if (onError) onError(e);
  };

  if (failed || !currentSrc) {
    if (fallbackFavicon) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 relative overflow-hidden pointer-events-none select-none">
          <div 
            className="absolute inset-[-20%] bg-cover bg-center blur-2xl opacity-40 dark:opacity-20 pointer-events-none"
            style={{ backgroundImage: `url(${proxyImageUrl(fallbackFavicon)})` }}
          />
          <img 
            src={proxyImageUrl(fallbackFavicon)} 
            alt={feedTitle || ""} 
            className="relative z-10 w-16 h-16 rounded-xl object-contain shadow-sm" 
            referrerPolicy="no-referrer" 
          />
        </div>
      );
    }
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 relative overflow-hidden pointer-events-none select-none">
        <FileText className="w-12 h-12 opacity-20 relative z-10" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || ""}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      onError={handleError}
      referrerPolicy="no-referrer"
      {...props}
    />
  );
}

export function RssPage({ type = 'rss' }: { type?: 'rss' | 'feeds' | 'youtube' | 'podcasts' | 'webcams' | 'all' | 'blogs' | 'radio' }) {
  const { settings, setViewMode, searchQuery, setShowTopAktuell, showHeader2 } = useSettings();
  const { showConfirm } = useCustomModal();
  const { playingAudio, setPlayingAudio, playingVideo, setPlayingVideo, readingArticle, setReadingArticle } = useMedia();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    let pageTitle = 'RSS Feeds';
    if (type === 'podcasts') pageTitle = tr(settings.language, 'Podcasts', 'Podcasts');
    else if (type === 'youtube') pageTitle = tr(settings.language, 'YouTube', 'YouTube');
    else if (type === 'webcams') pageTitle = tr(settings.language, 'WebCams', 'WebCams');
    else if (type === 'blogs') pageTitle = tr(settings.language, 'Blogs', 'Blogs');
    else if (type === 'rss') pageTitle = tr(settings.language, 'RSS Feeds', 'RSS-Feeds');
    
    document.title = `${pageTitle} | RSSer News`;
  }, [type, settings.language]);
  
  const { t } = useTranslation();
  const isDark = settings.theme === 'dark';
  const isEn = settings.language === 'en';
  
  const [feeds, setFeeds] = useState<Feed[]>(() => {
    try {
      const cached = localStorage.getItem(`cached_feeds_${type}`);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      return [];
    }
  });
  const [publicSources, setPublicSources] = useState<any[]>([]);
  const [feedItems, setFeedItems] = useState<RssItem[]>(() => {
    try {
      const cached = localStorage.getItem(`cached_items_${type}`);
      const parsed = cached ? JSON.parse(cached) : [];
      return Array.isArray(parsed) ? parsed.map((item: any) => ({
        ...item,
        imageUrl: proxyImageUrl(item.imageUrl)
      })) : [];
    } catch (e) {
      return [];
    }
  });
  const [loadingFeeds, setLoadingFeeds] = useState(() => {
    try {
      const cached = localStorage.getItem(`cached_feeds_${type}`);
      return !cached;
    } catch (e) {
      return true;
    }
  });
  const [loadingItems, setLoadingItems] = useState(false);
  const [isSyncing, setIsSyncing] = useState(() => {
    try {
      const cached = localStorage.getItem(`cached_feeds_${type}`);
      const parsed = cached ? JSON.parse(cached) : [];
      if (cached && parsed && Array.isArray(parsed) && parsed.length === 0) return false;
      const alreadySynced = sessionStorage.getItem(`rsser_session_synced_${type}`) === 'true';
      const isOnyTheFlyMode = type === 'podcasts' || type === 'youtube' || type === 'webcams' || type === 'radio';
      return !alreadySynced && !isOnyTheFlyMode;
    } catch (e) {
      return false;
    }
  });
  const [addingFeedUrl, setAddingFeedUrl] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("Alle");
  const [savedItemsDb, setSavedItemsDb] = useState<{ [key: string]: any }>({});
  const [readItemsDb, setReadItemsDb] = useState<{ [key: string]: boolean }>({});
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [showMidHistory, setShowMidHistory] = useState(false);
  const [showOldHistory, setShowOldHistory] = useState(false);
  const [showOlderHistory, setShowOlderHistory] = useState(false);

  const [communityVotes, setCommunityVotes] = useState<Record<string, { votes: number, voters: Record<string, 'up' | 'down'> }>>({});
  const [showTrendingSection, setShowTrendingSection] = useState<boolean>(true);
  const [slideshowIndex, setSlideshowIndex] = useState(0);
  const [stableTrendingItems, setStableTrendingItems] = useState<RssItem[]>([]);
  const [inlinePlayingIds, setInlinePlayingIds] = useState<string[]>([]);
  const [userRadioStations, setUserRadioStations] = useState<any[]>([]);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const handleAddStarterFeed = async (starter: { title: string; url: string; category?: string; type?: string; imageUrl?: string; faviconUrl?: string }) => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      setAddingFeedUrl(starter.url);
      const feedData: any = {
        title: starter.title,
        url: starter.url,
        category: starter.category || 'Nachrichten',
        type: starter.type || (type === 'rss' ? 'feeds' : type),
        imageUrl: starter.imageUrl || null,
        faviconUrl: starter.faviconUrl || null,
        createdAt: new Date().toISOString()
      };
      await addDoc(collection(db, 'users', user.uid, 'feeds'), feedData);
    } catch (e) {
      console.error("Error adding starter feed:", e);
    } finally {
      setAddingFeedUrl(null);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribe) unsubscribe();
      if (user) {
        const ref = collection(db, 'users', user.uid, 'radioStations');
        unsubscribe = onSnapshot(query(ref), (snapshot) => {
          const loaded = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          }));
          setUserRadioStations(loaded);
        }, (error) => {
          console.error("Failed to load user radio stations", error);
        });
      } else {
        setUserRadioStations([]);
      }
    });
    return () => {
      unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  interface InterspersePool {
    podcasts: RssItem[];
    youtube: RssItem[];
    webcams: any[];
    blogs: RssItem[];
  }

  const [interspersePool, setInterspersePool] = useState<InterspersePool>({
    podcasts: [],
    youtube: [],
    webcams: [],
    blogs: []
  });

  const formatColors = (() => {
    switch (type) {
      case 'podcasts':
        return {
          text: 'text-purple-600 dark:text-purple-400',
          hoverText: 'hover:text-purple-600 dark:hover:text-purple-400',
          activeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
          activeText: 'text-purple-600 dark:text-purple-400 font-black',
          badgeBg: 'bg-purple-500/10 dark:bg-purple-500/20',
          badgeText: 'text-purple-600 dark:text-purple-400',
          hoverBg: 'hover:bg-purple-500/5 dark:hover:bg-purple-500/10',
          hashColor: 'text-purple-600 dark:text-purple-400',
          rankBg: 'bg-purple-600',
          gradientFrom: 'from-purple-500/5 dark:from-purple-500/10',
          fallbackBg: 'bg-purple-500/5',
          liveBadgeBg: 'bg-purple-500/10',
          liveBadgeText: 'text-purple-600 dark:text-purple-400',
          tabActiveBgLight: 'bg-purple-100 text-purple-700 border-purple-200',
          tabActiveBgDark: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
          groupHoverText: 'group-hover:text-purple-600 dark:group-hover:text-purple-400',
          hoverBgSolid: 'hover:bg-purple-500',
          bgSolid: 'bg-purple-600',
        };
      case 'youtube':
        return {
          text: 'text-red-600 dark:text-red-400',
          hoverText: 'hover:text-red-600 dark:hover:text-red-400',
          activeBg: 'bg-red-500/10 dark:bg-red-500/20',
          activeText: 'text-red-600 dark:text-red-400 font-black',
          badgeBg: 'bg-red-500/10 dark:bg-red-500/20',
          badgeText: 'text-red-600 dark:text-red-400',
          hoverBg: 'hover:bg-red-500/5 dark:hover:bg-red-500/10',
          hashColor: 'text-red-600 dark:text-red-400',
          rankBg: 'bg-red-600',
          gradientFrom: 'from-red-500/5 dark:from-red-500/10',
          fallbackBg: 'bg-red-500/5',
          liveBadgeBg: 'bg-red-500/10',
          liveBadgeText: 'text-red-600 dark:text-red-400',
          tabActiveBgLight: 'bg-red-100 text-red-700 border-red-200',
          tabActiveBgDark: 'bg-red-500/20 text-red-400 border-red-500/30',
          groupHoverText: 'group-hover:text-red-600 dark:group-hover:text-red-400',
          hoverBgSolid: 'hover:bg-red-500',
          bgSolid: 'bg-red-600',
        };
      case 'webcams':
        return {
          text: 'text-green-600 dark:text-green-400',
          hoverText: 'hover:text-green-600 dark:hover:text-green-400',
          activeBg: 'bg-green-500/10 dark:bg-green-500/20',
          activeText: 'text-green-600 dark:text-green-400 font-black',
          badgeBg: 'bg-green-500/10 dark:bg-green-500/20',
          badgeText: 'text-green-600 dark:text-green-400',
          hoverBg: 'hover:bg-green-500/5 dark:hover:bg-green-500/10',
          hashColor: 'text-green-600 dark:text-green-400',
          rankBg: 'bg-green-600',
          gradientFrom: 'from-green-500/5 dark:from-green-500/10',
          fallbackBg: 'bg-green-500/5',
          liveBadgeBg: 'bg-green-500/10',
          liveBadgeText: 'text-green-600 dark:text-green-400',
          tabActiveBgLight: 'bg-green-100 text-green-700 border-green-200',
          tabActiveBgDark: 'bg-green-500/20 text-green-400 border-green-500/30',
          groupHoverText: 'group-hover:text-green-600 dark:group-hover:text-green-400',
          hoverBgSolid: 'hover:bg-green-500',
          bgSolid: 'bg-green-600',
        };
      case 'blogs':
        return {
          text: 'text-yellow-600 dark:text-yellow-400',
          hoverText: 'hover:text-yellow-700 dark:hover:text-yellow-300',
          activeBg: 'bg-yellow-100 dark:bg-yellow-500/20',
          activeText: 'text-yellow-800 dark:text-yellow-400 font-black',
          badgeBg: 'bg-yellow-100/70 dark:bg-yellow-500/10',
          badgeText: 'text-yellow-700 dark:text-yellow-400',
          hoverBg: 'hover:bg-yellow-50 dark:hover:bg-yellow-500/5',
          hashColor: 'text-yellow-500 dark:text-yellow-400',
          rankBg: 'bg-yellow-500',
          gradientFrom: 'from-yellow-500/5 dark:from-yellow-500/10',
          fallbackBg: 'bg-yellow-500/5',
          liveBadgeBg: 'bg-yellow-100 dark:bg-yellow-500/20',
          liveBadgeText: 'text-yellow-700 dark:text-yellow-400',
          tabActiveBgLight: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          tabActiveBgDark: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
          groupHoverText: 'group-hover:text-yellow-600 dark:group-hover:text-yellow-400',
          hoverBgSolid: 'hover:bg-yellow-600',
          bgSolid: 'bg-yellow-500',
        };
      case 'radio':
        return {
          text: 'text-blue-600 dark:text-blue-400',
          hoverText: 'hover:text-blue-600 dark:hover:text-blue-400',
          activeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
          activeText: 'text-blue-600 dark:text-blue-400 font-black',
          badgeBg: 'bg-blue-500/10 dark:bg-blue-500/20',
          badgeText: 'text-blue-600 dark:text-blue-400',
          hoverBg: 'hover:bg-blue-500/5 dark:hover:bg-blue-500/10',
          hashColor: 'text-blue-600 dark:text-blue-400',
          rankBg: 'bg-blue-600',
          gradientFrom: 'from-blue-500/5 dark:from-blue-500/10',
          fallbackBg: 'bg-blue-500/5',
          liveBadgeBg: 'bg-blue-500/10',
          liveBadgeText: 'text-blue-600 dark:text-blue-400',
          tabActiveBgLight: 'bg-blue-100 text-blue-700 border-blue-200',
          tabActiveBgDark: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
          groupHoverText: 'group-hover:text-blue-600 dark:group-hover:text-blue-400',
          hoverBgSolid: 'hover:bg-blue-500',
          bgSolid: 'bg-blue-600',
        };
      default: // rss, feeds, all, etc.
        return {
          text: 'text-[#f89440]',
          hoverText: 'hover:text-[#f89440]',
          activeBg: 'bg-[#f89440]/10 dark:bg-[#f89440]/20',
          activeText: 'text-[#f89440] font-black',
          badgeBg: 'bg-[#f89440]/10 dark:bg-[#f89440]/20',
          badgeText: 'text-[#f89440]',
          hoverBg: 'hover:bg-[#f89440]/5 dark:hover:bg-[#f89440]/10',
          hashColor: 'text-[#f89440]',
          rankBg: 'bg-[#f89440]',
          gradientFrom: 'from-[#f89440]/5 dark:from-[#f89440]/10',
          fallbackBg: 'bg-[#f89440]/5',
          liveBadgeBg: 'bg-[#f89440]/10',
          liveBadgeText: 'text-[#f89440]',
          tabActiveBgLight: 'bg-orange-100 text-orange-750 border-orange-200',
          tabActiveBgDark: 'bg-[#f89440]/20 text-orange-400 border-[#f89440]/30',
          groupHoverText: 'group-hover:text-[#f89440]',
          hoverBgSolid: 'hover:bg-[#e67e22]',
          bgSolid: 'bg-[#f89440]',
        };
    }
  })();

  // Subscribe to community item votes in Firestore
  useEffect(() => {
    try {
      const unsub = onSnapshot(collection(db, 'itemVotes'), (snap) => {
        const votesMap: Record<string, { votes: number, voters: Record<string, 'up' | 'down'> }> = {};
        snap.forEach((doc) => {
          const data = doc.data();
          votesMap[doc.id] = {
            votes: data.votes || 0,
            voters: data.voters || {}
          };
        });
        setCommunityVotes(votesMap);
      }, (err) => {
        console.warn("Could not subscribe to itemVotes. Falling back to offline-mode votes.", err);
      });
      return unsub;
    } catch (e) {
      console.error("Failed to compile communityVotes listener:", e);
    }
  }, []);

  const getSafeId = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return 'v_' + Math.abs(hash).toString(36) + '_' + str.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
  };

  const getSimulatedVotes = (item: RssItem) => {
    // Disabled as requested: no more faking votes
    return 0;
  };

  const getVotesCount = (item: RssItem) => {
    const docId = getSafeId(item.link || item.id);
    const record = communityVotes[docId];
    const base = getSimulatedVotes(item);
    return base + (record?.votes || 0);
  };

  const getVotedByUser = (item: RssItem) => {
    const docId = getSafeId(item.link || item.id);
    const record = communityVotes[docId];
    if (!record) return null;
    const uid = auth.currentUser?.uid || localStorage.getItem('rsser_community_user_id') || 'guest';
    return record.voters?.[uid] || null;
  };

  const castVote = async (e: React.MouseEvent, item: RssItem, voteType: 'up' | 'down') => {
    e.preventDefault();
    e.stopPropagation();
    
    let uid = auth.currentUser?.uid;
    if (!uid) {
      let guestId = localStorage.getItem('rsser_community_user_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('rsser_community_user_id', guestId);
      }
      uid = guestId;
    }
    
    const docId = getSafeId(item.link || item.id);
    const docRef = doc(db, 'itemVotes', docId);
    
    const existingRecord = communityVotes[docId];
    const prevVote = existingRecord?.voters?.[uid] || null;
    
    let newVoters = { ...(existingRecord?.voters || {}) };
    let votesChange = 0;
    
    if (prevVote === voteType) {
      delete newVoters[uid];
      votesChange = voteType === 'up' ? -1 : 1;
    } else {
      newVoters[uid] = voteType;
      if (prevVote === null) {
        votesChange = voteType === 'up' ? 1 : -1;
      } else {
        votesChange = voteType === 'up' ? 2 : -2;
      }
    }
    
    const newVotes = (existingRecord?.votes || 0) + votesChange;
    
    try {
      await setDoc(docRef, {
        id: item.id || docId,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        imageUrl: item.imageUrl || '',
        feedTitle: item.feedTitle,
        category: item.category || 'Allgemein',
        type: type,
        votes: newVotes,
        voters: newVoters,
        timestamp: item.timestamp || Date.now(),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error casting vote:", err);
    }
  };

  const getFeedVotesCount = (feedUrl: string) => {
    if (!feedUrl) return 0;
    const docId = getSafeId(feedUrl);
    const record = communityVotes[docId];
    return record?.votes || 0;
  };

  const getFeedVotedByUser = (feedUrl: string) => {
    if (!feedUrl) return null;
    const docId = getSafeId(feedUrl);
    const record = communityVotes[docId];
    if (!record) return null;
    const uid = auth.currentUser?.uid || localStorage.getItem('rsser_community_user_id') || 'guest';
    return record.voters?.[uid] || null;
  };

  const castFeedVote = async (e: React.MouseEvent, feedUrl: string, feedTitle: string, voteType: 'up' | 'down') => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!feedUrl) return;

    let uid = auth.currentUser?.uid;
    if (!uid) {
      let guestId = localStorage.getItem('rsser_community_user_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('rsser_community_user_id', guestId);
      }
      uid = guestId;
    }
    
    const docId = getSafeId(feedUrl);
    const docRef = doc(db, 'itemVotes', docId);
    
    const existingRecord = communityVotes[docId];
    const prevVote = existingRecord?.voters?.[uid] || null;
    
    let newVoters = { ...(existingRecord?.voters || {}) };
    let votesChange = 0;
    
    if (prevVote === voteType) {
      delete newVoters[uid];
      votesChange = voteType === 'up' ? -1 : 1;
    } else {
      newVoters[uid] = voteType;
      if (prevVote === null) {
        votesChange = voteType === 'up' ? 1 : -1;
      } else {
        votesChange = voteType === 'up' ? 2 : -2;
      }
    }
    
    const newVotes = (existingRecord?.votes || 0) + votesChange;
    
    try {
      await setDoc(docRef, {
        id: docId,
        title: feedTitle,
        link: feedUrl,
        pubDate: new Date().toISOString(),
        imageUrl: '',
        feedTitle: feedTitle,
        category: 'Source',
        type: type,
        votes: newVotes,
        voters: newVoters,
        timestamp: Date.now(),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error casting feed vote:", err);
    }
  };

  const [refreshTick, setRefreshTick] = useState(0);
  const forceBypassRef = React.useRef<boolean>(false);
  const imageFetchAttemptsRef = React.useRef<Set<string>>(new Set());

  // Clear image fetch attempts and failed images on channel change or refresh
  React.useEffect(() => {
    imageFetchAttemptsRef.current.clear();
    setFailedImages({});
  }, [selectedChannelId, refreshTick]);

  // Lazy-load missing images for articles of text-only feeds
  React.useEffect(() => {
    if (loadingItems || feedItems.length === 0) return;
    
    // Find items that have no imageUrl, but have a valid link, and have not been attempted yet
    const itemsToFetch = feedItems
      .filter(item => !item.imageUrl && item.link && !item.link.includes('youtube.com') && !item.link.includes('youtu.be'))
      .filter(item => !imageFetchAttemptsRef.current.has(item.link));

    if (itemsToFetch.length === 0) return;

    // Fetch in responsive batches of 8 at a time for high speed without blocking
    const sliceToFetch = itemsToFetch.slice(0, 8);

    const runFetches = async () => {
      const updates: { id: string; imageUrl: string }[] = [];
      await Promise.all(sliceToFetch.map(async (item) => {
        if (!item.link) return;
        imageFetchAttemptsRef.current.add(item.link);
        try {
          const res = await fetch(`/api/og-image?url=${encodeURIComponent(item.link)}`);
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data = await res.json() as { imageUrl?: string };
            if (data?.imageUrl) {
              updates.push({ id: item.id, imageUrl: data.imageUrl });
            }
          }
        } catch (err) {
          // Gracefully ignore lazy-load failure for individual item
        }
      }));

      if (updates.length > 0) {
        const updateMap = new Map(updates.map(u => [u.id, u.imageUrl]));
        setFeedItems(prev => prev.map(p => updateMap.has(p.id) ? { ...p, imageUrl: updateMap.get(p.id)! } : p));
      }
    };

    const timer = setTimeout(runFetches, 200);
    return () => clearTimeout(timer);
  }, [feedItems, loadingItems]);

  // Use a ref to track what we've already fetched to prevent redundant work
  const lastFetchedUrlsRef = React.useRef<string>("");
  const isFetchingRef = React.useRef<boolean>(false);
  const metadataUpdateBufferRef = React.useRef<{ [id: string]: any }>({});
  const publicSourcesRef = React.useRef(publicSources);

  const triggerManualSync = () => {
    if (isFetchingRef.current || feeds.length === 0) return;
    
    // Clear local storage cache for current feeds
    feeds.forEach(feed => {
      if (feed.url) {
        const cacheId = encodeURIComponent(feed.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
        try {
          localStorage.removeItem('rss_v5_' + cacheId);
        } catch (e) {}
      }
    });
    
    // Reset fetch blocks
    lastFetchedUrlsRef.current = "";
    forceBypassRef.current = true;
    setFailedImages({});
    imageFetchAttemptsRef.current.clear();
    
    // Clear the session synced flag on manual sync to allow hard sync
    try {
      sessionStorage.removeItem(`rsser_session_synced_${type}`);
    } catch (e) {}
    
    // Clear feed items & trigger fetch effect
    setFeedItems([]);
    setRefreshTick(prev => prev + 1);
  };
  
  // Keep the ref up to date without triggering the fetch effect
  useEffect(() => {
    publicSourcesRef.current = publicSources;
  }, [publicSources]);

  // Memoize feed URLs to prevent effect re-triggering when metadata changes
  const feedUrlsKey = useMemo(() => feeds.map(f => f.url || f.id).sort().join('|'), [feeds]);
  
  const categories = useMemo(() => {
    const base = [
      "Alle", 
      type === 'podcasts' ? "Später hören" : type === 'youtube' ? "Später sehen" : "Später lesen", 
      "Favoriten"
    ];
    if (type === 'blogs') return base;
    
    const cats = new Set<string>();
    feeds.forEach(f => {
      if (f.category && f.category !== 'WebCam' && f.category !== 'Radio') {
        cats.add(f.category);
      }
    });
    
    // Sort the user categories but keep base categories at start
    return [...base, ...Array.from(cats).sort()];
  }, [feeds, type]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const channelParam = params.get('channel');
    const stateChannel = location.state?.selectedChannelId;
    
    if (channelParam) {
      setSelectedChannelId(channelParam);
    } else if (stateChannel) {
      setSelectedChannelId(stateChannel);
    } else {
      setSelectedChannelId(null);
    }
  }, [location.pathname, location.search, location.state, type]);
  
  const viewMode = (type === 'youtube' || type === 'podcasts' || type === 'webcams') 
    ? 'grid' 
    : (settings.viewMode === 'magazine' && type !== 'rss' && type !== 'feeds' && type !== 'all')
      ? 'grid'
      : (settings.viewMode || 'list');

  // extract video ID simply
  const getOutputVideoId = (url: string) => {
    if (!url) return null;
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i);
    return match ? match[1] : null;
  };

  useEffect(() => {
    // Fetch public sources from server API instead of direct Firestore to save reads
    const fetchSources = async () => {
      try {
        const res = await fetch('/api/public-sources');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setPublicSources(data);
          }
        }
      } catch (e) {
        // Silently continue with local defaults
      }
    };
    fetchSources();
  }, []);

  useEffect(() => {
    if (viewMode !== 'magazine') return;
    
    let isCancelled = false;
    let timer: any = null;

    const loadPool = async () => {
      const pool: InterspersePool = { podcasts: [], youtube: [], webcams: [], blogs: [] };

      // Webcams: select from publicSources
      const webcamSources = publicSources.filter(s => s.type === 'webcams');
      
      pool.webcams = [...webcamSources].sort(() => 0.5 - Math.random()).slice(0, 5);

      const getFeedsOfType = (t: string): any[] => {
        const subscribed = feeds.filter(f => f.type === t);
        if (subscribed.length > 0) {
          return subscribed;
        }

        const discovery: any[] = publicSources.filter(s => s.type === t);

        const userLang = (settings.language || 'de').toLowerCase();
        const filteredDiscovery = discovery.filter(s => {
          const feedLang = (s.language || '').toLowerCase();
          if (!feedLang || feedLang === 'none') {
            return true;
          }
          const cleanUserLang = userLang.split('-')[0];
          const cleanFeedLang = feedLang.split('-')[0];
          return cleanUserLang === cleanFeedLang;
        });

        if (filteredDiscovery.length === 0) {
          return discovery;
        }

        return filteredDiscovery;
      };

      const podcastFeeds = getFeedsOfType('podcasts');
      const youtubeFeeds = getFeedsOfType('youtube');
      const blogFeeds = getFeedsOfType('blogs');

      const fetchFeedsItems = async (feedsList: any[], maxCount: number) => {
        const selected = [...feedsList].sort(() => 0.5 - Math.random()).slice(0, 3);
        
        const itemPromises = selected.map(async (f) => {
          // Check local storage cache first - using identical cacheId generation!
          try {
            const cacheId = encodeURIComponent(f.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
            const cached = localStorage.getItem('rss_v5_' + cacheId);
            if (cached) {
              const parsedLocal = JSON.parse(cached);
              const responseData = parsedLocal.data || parsedLocal;
              if (responseData && responseData.items && responseData.items.length > 0) {
                return responseData.items.slice(0, 3).map((item: any) => ({
                  ...item,
                  feedTitle: f.title || responseData.title || f.url,
                  feedId: f.id || '',
                  feedUrl: f.url,
                  category: f.category || '',
                  timestamp: new Date(item.pubDate).getTime() || Date.now()
                }));
              }
            }
          } catch (e) {}

          // Fallback: quick fetch via API (only if needed and not cached)
          try {
            const res = await fetch('/api/rss', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: f.url, maxDays: 14 })
            });
            if (res.ok) {
              const freshData = await res.json();
              if (freshData && freshData.items) {
                return freshData.items.slice(0, 3).map((item: any) => ({
                  ...item,
                  feedTitle: f.title || freshData.title || f.url,
                  feedId: f.id || '',
                  feedUrl: f.url,
                  category: f.category || '',
                  timestamp: new Date(item.pubDate).getTime() || Date.now()
                }));
              }
            }
          } catch (e) {}
          return [];
        });

        const results = await Promise.all(itemPromises);
        return results.flat();
      };

      const [pItems, yItems, bItems] = await Promise.all([
        fetchFeedsItems(podcastFeeds, 3),
        fetchFeedsItems(youtubeFeeds, 3),
        fetchFeedsItems(blogFeeds, 3)
      ]);

      if (!isCancelled) {
        setInterspersePool({
          podcasts: pItems.sort(() => 0.5 - Math.random()),
          youtube: yItems.sort(() => 0.5 - Math.random()),
          webcams: pool.webcams,
          blogs: bItems.sort(() => 0.5 - Math.random())
        });
      }
    };

    // Delay pool loading slightly to allow main thread and main feed requests to execute first
    timer = setTimeout(() => {
      loadPool();
    }, 450);

    return () => {
      isCancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [viewMode, feeds, publicSources, settings.language]);

  useEffect(() => {
    let hasLoadedCachedFeeds = false;
    let hasCachedItems = false;
    try {
      const cachedFeeds = localStorage.getItem(`cached_feeds_${type}`);
      const cachedItems = localStorage.getItem(`cached_items_${type}`);
      if (cachedFeeds) {
        setFeeds(JSON.parse(cachedFeeds));
        hasLoadedCachedFeeds = true;
      } else {
        setFeeds([]);
      }
      if (cachedItems) {
        const parsed = JSON.parse(cachedItems);
        const cleaned = Array.isArray(parsed) ? parsed.map((item: any) => ({
          ...item,
          imageUrl: proxyImageUrl(item.imageUrl)
        })) : [];
        setFeedItems(cleaned);
        if (cleaned && cleaned.length > 0) {
          hasCachedItems = true;
        }
      } else {
        setFeedItems([]);
      }
    } catch (e) {
      setFeeds([]);
      setFeedItems([]);
    }

    // Hydrate richer caches asynchronously from IndexedDB
    getCachedCategoryItems(type).then((idbItems) => {
      if (idbItems && idbItems.length > 0) {
        const cleanedIdb = idbItems.map((item: any) => ({
          ...item,
          imageUrl: proxyImageUrl(item.imageUrl)
        }));
        setFeedItems(prev => {
          if (!prev || prev.length === 0) return cleanedIdb;
          return prev;
        });
      }
    }).catch(() => {});

    getCachedCategoryFeeds(type).then((idbFeeds) => {
      if (idbFeeds && idbFeeds.length > 0) {
        setFeeds(prev => {
          if (!prev || prev.length === 0) return idbFeeds;
          return prev;
        });
        setLoadingFeeds(false);
      }
    }).catch(() => {});

    setLoadingFeeds(!hasLoadedCachedFeeds);
    let alreadySynced = false;
    try {
      alreadySynced = sessionStorage.getItem(`rsser_session_synced_${type}`) === 'true';
    } catch (e) {}

    const isOnyTheFlyMode = type === 'podcasts' || type === 'youtube' || type === 'webcams' || type === 'radio';
    if (!alreadySynced && !isOnyTheFlyMode) {
      setIsSyncing(true);
      setSyncProgress(0);
    } else {
      setIsSyncing(false);
    }
    let unsubscribeFeeds: (() => void) | undefined;
    let unsubscribeSaved: (() => void) | undefined;
    let unsubscribeRead: (() => void) | undefined;
    
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // First clean up any existing listeners if auth state changes
      if (unsubscribeFeeds) unsubscribeFeeds();
      if (unsubscribeSaved) unsubscribeSaved();
      if (unsubscribeRead) unsubscribeRead();

      if (user) {
        const feedsRef = collection(db, 'users', user.uid, 'feeds');
        const q = query(feedsRef);
        
        unsubscribeFeeds = onSnapshot(q, (snapshot) => {
          let loadedFeeds = snapshot.docs.map(d => {
            const data = d.data();
            const mappedCat = data.category === 'Technik' ? 'Tech' : data.category;
            return {
              id: d.id,
              ...data,
              category: mappedCat
            } as Feed;
          });
          
          if (type === 'youtube') {
            loadedFeeds = loadedFeeds.filter(f => (f.category === 'YouTube' || f.type === 'youtube' || (f.url && (f.url.includes('youtube.com') || f.url.includes('youtu.be')))) && f.category !== 'WebCam' && f.type !== 'webcams' && !f.url?.includes('/live/'));
          } else if (type === 'webcams') {
            loadedFeeds = loadedFeeds.filter(f => f.category === 'WebCam' || f.type === 'webcams' || (f.url && (f.url.includes('/watch') || f.url.includes('youtu.be/') || f.url.includes('/live/'))));
          } else if (type === 'podcasts') {
            loadedFeeds = loadedFeeds.filter(f => f.isPodcast === true || f.category === 'Podcast' || f.type === 'podcasts');
          } else if (type === 'blogs') {
            loadedFeeds = loadedFeeds.filter(f => f.type === 'blogs' || f.category === 'Blogs' || (f.url && (f.url.includes('rsser.news') || f.url.includes('run.app') || f.url.includes('localhost') || f.url.includes('127.0.0.1') || f.url.includes(window.location.hostname))));
          } else if (type === 'rss' || type === 'feeds') {
            loadedFeeds = loadedFeeds.filter(f => f.category !== 'WebCam' && f.type !== 'webcams' && f.type !== 'blogs' && f.category !== 'Blogs' && (!f.url || (!f.url.includes('youtube.com') && !f.url.includes('youtu.be') && !f.url.includes('rsser.news') && !f.url.includes('run.app') && !f.url.includes('localhost') && !f.url.includes('127.0.0.1') && !f.url.includes(window.location.hostname))) && !f.isPodcast);
          }
          
          setFeeds(loadedFeeds);
          try {
            safeLocalStorageSetItem(`cached_feeds_${type}`, JSON.stringify(loadedFeeds));
          } catch (err) {}
          setLoadingFeeds(false);
          setLoadingItems(false);
          if (loadedFeeds.length === 0) {
            setIsSyncing(false);
            setSyncProgress(100);
            try {
              sessionStorage.setItem(`rsser_session_synced_${type}`, 'true');
            } catch (e) {}
          }
        }, (error) => {
          setLoadingFeeds(false);
          setLoadingItems(false);
          if (!error.message?.includes('CANCELLED')) {
             handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/feeds`);
          }
        });

        const savedRef = collection(db, 'users', user.uid, 'savedItems');
        unsubscribeSaved = onSnapshot(savedRef, (snapshot) => {
          const dict: any = {};
          snapshot.docs.forEach(d => {
            dict[d.id] = d.data();
          });
          setSavedItemsDb(dict);
        }, (error) => {
          if (!error.message?.includes('CANCELLED')) {
             handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/savedItems`);
          }
        });

        const readRef = collection(db, 'users', user.uid, 'readItems');
        unsubscribeRead = onSnapshot(readRef, (snapshot) => {
          const dict: { [key: string]: boolean } = {};
          snapshot.docs.forEach(d => {
            const data = d.data();
            if (data.itemId) {
              dict[data.itemId] = true;
            }
          });
          setReadItemsDb(dict);
        }, (error) => {
          if (!error.message?.includes('CANCELLED')) {
             handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/readItems`);
          }
        });
      } else {
        setFeeds([]);
        setFeedItems([]);
        setSavedItemsDb({});
        setReadItemsDb({});
        setLoadingFeeds(false);
        setLoadingItems(false);
        setIsSyncing(false);
        setSyncProgress(100);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFeeds) unsubscribeFeeds();
      if (unsubscribeSaved) unsubscribeSaved();
      if (unsubscribeRead) unsubscribeRead();
    };
  }, [type]);

  useEffect(() => {
    let isCancelled = false;

    const fetchAllFeedItems = async () => {
      if (feeds.length === 0) {
        if (!isCancelled) {
          setFeedItems([]);
          setIsSyncing(false);
          setLoadingItems(false);
          setSyncProgress(100);
          try {
            sessionStorage.setItem(`rsser_session_synced_${type}`, 'true');
          } catch (e) {}
        }
        isFetchingRef.current = false;
        return;
      }
      
      // Prevent re-fetching if URLs haven't changed
      if (lastFetchedUrlsRef.current === feedUrlsKey && feedItems.length > 0) {
        return;
      }
      
      const urlsChanged = lastFetchedUrlsRef.current !== feedUrlsKey;
      
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      lastFetchedUrlsRef.current = feedUrlsKey;
      
      // 1. Instantly load cache in one synchronous swoop!
      const initialCachedItems: RssItem[] = [];
      const currentPublicSources = publicSourcesRef.current;
      
      feeds.forEach(feed => {
        if (feed.url) {
          const cacheId = encodeURIComponent(feed.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
          try {
             const localKey = 'rss_v5_' + cacheId;
             const localData = localStorage.getItem(localKey);
             if (localData) {
                const parsedLocal = JSON.parse(localData);
                const responseData = parsedLocal.data;
                if (responseData) {
                  const pSource = currentPublicSources.find(p => p.url === feed.url || p.blogId === feed.id);
                  const faviconUrl = pSource?.imageUrl || pSource?.authorAvatar || feed.imageUrl || getFavicon(feed.url) || getFavicon(responseData.link || '');
                  
                  const items = (responseData.items || [])
                     .filter((item: any) => item && item.title && typeof item.title === 'string' && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'ohne titel')
                     .map((item: any) => {
                        const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
                        let ytThumbnail = null;
                        if (isYoutubeItem) {
                            const videoId = getOutputVideoId(item.link);
                            if (videoId) ytThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                        }
                        let parsedImageUrl = item.imageUrl || item.image?.url;
                        if (isYoutubeItem && ytThumbnail && !parsedImageUrl) parsedImageUrl = ytThumbnail;
                        if (!parsedImageUrl && !isYoutubeItem && !feed.isPodcast) {
                            const htmlContent = item.content || item['content:encoded'] || item.contentEncoded || item.description || item.summary || '';
                            parsedImageUrl = extractHtmlImage(htmlContent);
                        }

                        return {
                            id: item.guid || item.link || Math.random().toString(),
                            title: item.title,
                            link: item.link,
                            pubDate: item.pubDate,
                            contentSnippet: item.contentSnippet,
                            feedTitle: feed.title || responseData.title || feed.url,
                            feedId: feed.id,
                            feedUrl: feed.url,
                            feedImageUrl: feed.imageUrl && feed.imageUrl.startsWith('http://') ? feed.imageUrl.replace('http://', 'https://') : feed.imageUrl,
                            timestamp: (!isNaN(new Date(item.pubDate).getTime())) ? new Date(item.pubDate).getTime() : Date.now(),
                            imageUrl: parsedImageUrl ? (parsedImageUrl.startsWith('http://') ? parsedImageUrl.replace('http://', 'https://') : parsedImageUrl) : null,
                            faviconUrl: faviconUrl && faviconUrl.startsWith('http://') ? faviconUrl.replace('http://', 'https://') : faviconUrl,
                            category: feed.category || FEED_CATEGORIES[0],
                            enclosure: item.enclosure
                        };
                     });
                  initialCachedItems.push(...items);
                }
             }
          } catch(e) {}
        }
      });

      // ONLY show fullscreen syncing indicator if we haven't synced in this session, and are not in an on-the-fly background sync mode
      let alreadySyncedInSession = false;
      try {
        alreadySyncedInSession = sessionStorage.getItem(`rsser_session_synced_${type}`) === 'true';
      } catch (e) {}

      const isOnyTheFlyMode = type === 'podcasts' || type === 'youtube' || type === 'webcams' || type === 'radio';

      setLoadingItems(true);
      if (!alreadySyncedInSession && !isOnyTheFlyMode) {
         setIsSyncing(true);
         setSyncProgress(0);
      } else {
         setIsSyncing(false);
      }

      if (!isCancelled) {
        if (initialCachedItems.length > 0) {
           const seen = new Set<string>();
           const uniqueItems = initialCachedItems.filter(item => {
             const key = item.id || item.link;
             if (key && !seen.has(key)) {
               seen.add(key);
               return true;
             }
             return false;
           }).sort((a, b) => b.timestamp - a.timestamp);
           setFeedItems(uniqueItems);
        } else {
           // Only clear if empty
           if (feedItems.length === 0) {
              setFeedItems([]);
           }
        }
      }
      
      // Use a buffer to batch updates to feedItems to prevent excessive re-renders
      let itemBuffer: RssItem[] = [];
      let flushTimeout: any = null;
      
      const flushBuffer = () => {
        if (isCancelled || itemBuffer.length === 0) return;
        
        const itemsToProcess = [...itemBuffer];
        itemBuffer = [];
        
        setFeedItems(prev => {
          const incomingFeedIds = new Set(itemsToProcess.map(i => i.feedId));
          const filtered = prev.filter(i => !incomingFeedIds.has(i.feedId));
          const merged = [...filtered, ...itemsToProcess];
          
          const seen = new Set<string>();
          const deduped = merged.filter(item => {
            const key = item.id || item.link;
            if (key && !seen.has(key)) {
              seen.add(key);
              return true;
            }
            return false;
          }).sort((a, b) => b.timestamp - a.timestamp);
          
          if (deduped.length >= 10) {
            setIsSyncing(false);
          }
          
          return deduped;
        });
      };

      const requestFlush = () => {
        if (flushTimeout) return;
        flushTimeout = setTimeout(() => {
          flushTimeout = null;
          flushBuffer();
        }, 120); // Flush every 120ms for much snappier updates
      };

      let activeCount = feeds.length;
      let finishedCount = 0;
      
      // Concurrency limit for background fetching (increased for faster startup)
      const CONCURRENCY_LIMIT = 24;
      const feedsToProcess = [...feeds];
      let running = 0;
      let index = 0;

      const processNext = async () => {
        if (isCancelled || index >= feedsToProcess.length) return;
        
        const feed = feedsToProcess[index++];
        running++;

        try {
          if (!feed.url && feed.type !== 'blogs') {
             // Skip
          } else if (type === 'webcams' || feed.type === 'webcams' || (feed.category === 'WebCam') || (feed.url && feed.url.includes('/live/'))) {
             // For webcams, create a direct item
             const isYoutube = feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be');
             let ytThumbnail = feed.imageUrl;
             if (isYoutube && !ytThumbnail) {
                const videoId = getOutputVideoId(feed.url);
                if (videoId) ytThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
             }

             const webcamItem: RssItem = {
                id: feed.id || feed.url || Math.random().toString(),
                title: feed.title || 'WebCam',
                link: feed.url || '',
                pubDate: new Date().toISOString(),
                contentSnippet: feed.title || 'WebCam Stream',
                feedTitle: feed.title || 'WebCam',
                feedId: feed.id,
                feedUrl: feed.url,
                feedImageUrl: feed.imageUrl,
                timestamp: Date.now(),
                imageUrl: ytThumbnail || feed.imageUrl,
                faviconUrl: getFavicon(feed.url),
                category: 'WebCam'
             };

             if (!isCancelled) {
               itemBuffer.push(webcamItem);
               requestFlush();
             }
          } else {
             // Internal or External Blog/RSS
             const isInternalBlog = feed.url && (feed.url.includes('rsser.news') || feed.url.includes('run.app') || feed.url.includes('localhost') || feed.url.includes('127.0.0.1') || feed.url.includes(window.location.hostname)) && (feed.url.includes('/blog/') || feed.url.includes('/article/') || feed.url.includes('/blogs/user/') || feed.url.includes('/blogs/author/') || feed.url.includes('/p/') || feed.url.includes('/api/rss/user/'));
             
              if (isInternalBlog) {
                 // Fetch internal blogs
                 let userId = '';
                 let pSourceInternal = null;
                 const currentPublicSources = publicSourcesRef.current;

                 if (feed.url.includes('/api/rss/user/')) {
                     userId = feed.url.split('/api/rss/user/').pop()?.split('?')[0] || '';
                     pSourceInternal = currentPublicSources.find(p => p.addedBy === userId);
                 } else if (feed.url.includes('/blogs/user/')) {
                     userId = feed.url.split('/blogs/user/').pop()?.split('/')[0] || '';
                     pSourceInternal = currentPublicSources.find(p => p.addedBy === userId);
                 } else if (feed.url.includes('/blogs/author/')) {
                     userId = feed.url.split('/blogs/author/').pop()?.split('/')[0] || '';
                     pSourceInternal = currentPublicSources.find(p => p.addedBy === userId);
                 } else {
                     const blogId = feed.url.split('/article/').pop()?.split('/blog/').pop()?.split('?')[0];
                     pSourceInternal = currentPublicSources.find(p => p.blogId === blogId || p.id === blogId || p.url === feed.url);
                     if (pSourceInternal) userId = pSourceInternal.addedBy;
                 }
                
                if (userId) {
                   try {
                     // Fetch actual user profile information for the blog author
                     let authorName = '';
                     let authorAvatar = '';
                     try {
                       const userDoc = await getDoc(doc(db, 'users', userId));
                       if (userDoc.exists()) {
                         const userData = userDoc.data();
                         authorName = userData.displayName || userData.name || '';
                         authorAvatar = userData.avatarUrl || userData.avatar || '';
                       }
                     } catch (err) {
                       console.error("Error fetching author user doc:", err);
                     }

                     const blogsRef = collection(db, 'users', userId, 'blogs');
                     const q = query(blogsRef, where('published', '==', true), orderBy('createdAt', 'desc'));
                     const blogSnap = await getDocs(q);
                     
                     const items: RssItem[] = blogSnap.docs.map(doc => {
                       const blogData = doc.data();
                       const itemLink = blogData.slug 
                         ? `${getCanonicalOrigin()}/blogs/user/${userId}/p/${blogData.slug}`
                         : `${getCanonicalOrigin()}/blogs/user/${userId}/article/${doc.id}`;
                       
                       const userLang = (settings.language || 'de').toLowerCase();
                       const originalLang = (blogData.language || 'de').toLowerCase();
                       
                       let displayTitle = blogData.title;
                       let displayContent = blogData.content || '';
                       let displayLanguage = blogData.language || 'de';
                       
                       if (userLang !== originalLang && blogData.translations && blogData.translations[userLang]) {
                         displayTitle = blogData.translations[userLang].title || blogData.title;
                         displayContent = blogData.translations[userLang].content || blogData.content || '';
                         displayLanguage = userLang;
                       }
                       
                       return {
                         id: doc.id,
                         title: displayTitle,
                         link: itemLink,
                         authorId: userId,
                         pubDate: blogData.createdAt?.toDate ? blogData.createdAt.toDate().toISOString() : new Date().toISOString(),
                         content: displayContent,
                         contentSnippet: displayContent?.replace(/<[^>]*>?/gm, ' ').substring(0, 200),
                         feedTitle: authorName || pSourceInternal?.authorName || feed.title,
                         feedId: feed.id,
                         feedUrl: feed.url,
                         feedImageUrl: authorAvatar || pSourceInternal?.authorAvatar || feed.imageUrl,
                         timestamp: blogData.createdAt?.toDate ? blogData.createdAt.toDate().getTime() : Date.now(),
                         imageUrl: blogData.coverImage || feed.imageUrl,
                         faviconUrl: authorAvatar || pSourceInternal?.authorAvatar || getFavicon(feed.url),
                         category: feed.category || 'Blogs',
                         language: displayLanguage
                       };
                     });
                     
                     if (!isCancelled && items.length > 0) {
                        itemBuffer.push(...items);
                        requestFlush();
                     }
                   } catch (e) {
                     console.error("Failed to fetch internal Blogs", e);
                   }
                }
             } else {
                // External RSS
                const cacheId = encodeURIComponent(feed.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
                let data = null;
                let isStale = true;
                
                try {
                   const localKey = 'rss_v5_' + cacheId;
                   const localData = localStorage.getItem(localKey);
                   if (localData) {
                      const parsedLocal = JSON.parse(localData);
                      data = parsedLocal.data;
                      if (Date.now() - parsedLocal.updatedAt < 30 * 60 * 1000) {
                          isStale = false;
                      }
                   } else {
                      const idbCached = await getCachedFeed(feed.url, 30 * 60 * 1000);
                      if (idbCached) {
                        data = idbCached;
                        isStale = false;
                      }
                   }
                } catch(e) {}
                
                const processData = (responseData: any, fetchedFresh: boolean) => {
                   if (!responseData || isCancelled) return;
                   
                   // Collect metadata updates for later instead of immediate updateDoc
                   if (fetchedFresh && feed.type !== 'webcams') {
                      const updates: any = {};
                      let hasUpdates = false;
                      const originalImg = responseData.originalImageUrl || responseData.image?.url;
                      if (originalImg && feed.originalImageUrl !== originalImg) {
                         updates.originalImageUrl = originalImg;
                         hasUpdates = true;
                      }
                      if (!feed.customImageUrl && responseData.image?.url && feed.imageUrl !== responseData.image.url) {
                         updates.imageUrl = responseData.image.url;
                         hasUpdates = true;
                      }
                      if (responseData.bannerUrl && feed.bannerUrl !== responseData.bannerUrl) {
                         updates.bannerUrl = responseData.bannerUrl;
                         hasUpdates = true;
                      }
                      if (!!responseData.isPodcast !== !!feed.isPodcast) {
                         updates.isPodcast = !!responseData.isPodcast;
                         hasUpdates = true;
                      }
                      if (hasUpdates) {
                         metadataUpdateBufferRef.current[feed.id] = {
                            ...(metadataUpdateBufferRef.current[feed.id] || {}),
                            ...updates
                         };
                      }
                   }

                   const currentPublicSources = publicSourcesRef.current;
                   const pSource = currentPublicSources.find(p => p.url === feed.url || p.blogId === feed.id);
                   const faviconUrl = pSource?.imageUrl || pSource?.authorAvatar || feed.imageUrl || getFavicon(feed.url) || getFavicon(responseData.link || '');
                   
                   const items = (responseData.items || []).map((item: any) => {
                      const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
                      let ytThumbnail = null;
                      if (isYoutubeItem) {
                          const videoId = getOutputVideoId(item.link);
                          if (videoId) ytThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
                      }
                      
                      let parsedImageUrl = item.imageUrl || item.image?.url;
                      if (isYoutubeItem && ytThumbnail && !parsedImageUrl) parsedImageUrl = ytThumbnail;
                      
                      if (!parsedImageUrl && !isYoutubeItem && !feed.isPodcast) {
                          const htmlContent = item.content || item['content:encoded'] || item.contentEncoded || item.description || item.summary || '';
                          parsedImageUrl = extractHtmlImage(htmlContent);
                      }

                      // Fallback for podcast episode cards: use feed/channel logo so they are not blank / gray
                      const feedUrlLower = (feed.url || responseData.feedUrl || '').toLowerCase();
                      const feedTitleLower = (feed.title || responseData.title || '').toLowerCase();
                      const feedCategoryLower = (feed.category || '').toLowerCase();
                      const isPodcastFeed = feed.isPodcast || 
                                            responseData.isPodcast || 
                                            type === 'podcasts' || 
                                            feedCategoryLower === 'podcasts' || 
                                            feedCategoryLower === 'podcast' || 
                                            feedUrlLower.includes('podcast') || 
                                            feedUrlLower.includes('radio') || 
                                            feedUrlLower.includes('audio') || 
                                            feedUrlLower.includes('/m4a/') || 
                                            feedUrlLower.includes('/m4a') || 
                                            feedUrlLower.includes('.mp3') || 
                                            feedTitleLower.includes('bits und so') || 
                                            feedTitleLower.includes('podcast') || 
                                            item.enclosure?.url;

                      const rawFeedImg = feed.customImageUrl || pSource?.customImageUrl || pSource?.imageUrl || feed.imageUrl || responseData.image?.url || responseData.itunes?.image || feed.originalImageUrl || pSource?.authorAvatar;
                      let finalFeedImageUrl = rawFeedImg && typeof rawFeedImg === 'string' ? rawFeedImg : '';
                      if (finalFeedImageUrl.includes('mza_11977799580453303866')) {
                        finalFeedImageUrl = "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bf/16/da/bf16da2d-abfa-ee92-a16f-cb9629b35b67/mza_18047970425501861730.png/600x600bb.jpg";
                      }
                      if (finalFeedImageUrl.startsWith('http://')) {
                        finalFeedImageUrl = finalFeedImageUrl.replace('http://', 'https://');
                      }

                      if ((!parsedImageUrl || (typeof parsedImageUrl === 'string' && parsedImageUrl.includes('mza_11977799580453303866'))) && isPodcastFeed) {
                          parsedImageUrl = finalFeedImageUrl;
                      }

                      return {
                          id: item.guid || item.link || Math.random().toString(),
                          title: item.title,
                          link: item.link,
                          pubDate: item.pubDate,
                          contentSnippet: item.contentSnippet,
                          feedTitle: feed.title || responseData.title || feed.url,
                          feedId: feed.id,
                          feedUrl: feed.url,
                          feedImageUrl: finalFeedImageUrl || null,
                          timestamp: (!isNaN(new Date(item.pubDate).getTime())) ? new Date(item.pubDate).getTime() : Date.now(),
                          imageUrl: parsedImageUrl ? (parsedImageUrl.startsWith('http://') ? parsedImageUrl.replace('http://', 'https://') : parsedImageUrl) : null,
                          faviconUrl: faviconUrl && faviconUrl.startsWith('http://') ? faviconUrl.replace('http://', 'https://') : faviconUrl,
                          category: feed.category || FEED_CATEGORIES[0],
                          enclosure: item.enclosure
                      };
                   });
                   
                   if (!isCancelled && items.length > 0) {
                       itemBuffer.push(...items);
                       requestFlush();
                   }
                };

                if (data) processData(data, false);

                const fetchPromise = async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 15000);
                    try {
                        const res = await fetch('/api/rss', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          signal: controller.signal,
                          body: JSON.stringify({ 
                            url: feed.url, 
                            maxDays: (type === 'youtube') ? 21 : type === 'podcasts' ? 30 : 5,
                            force: forceBypassRef.current,
                            bypassCache: forceBypassRef.current
                          })
                        });
                        clearTimeout(timeoutId);
                        if (res.ok) {
                            const freshData = await res.json();
                            if (!isCancelled) {
                                try {
                                    const slimmed = slimFeedResponse(freshData);
                                    safeLocalStorageSetItem('rss_v5_' + cacheId, JSON.stringify({ data: slimmed, updatedAt: Date.now() }));
                                    setCachedFeed(feed.url, freshData);
                                } catch(e) {}
                                processData(freshData, true);
                            }
                        }
                    } catch (e) {
                        clearTimeout(timeoutId);
                    }
                };

                if (!data || isStale) {
                    if (data) {
                        // Data loaded from cache instantly. Fetch update in background without blocking!
                        fetchPromise();
                    } else {
                        // No cache available. We MUST await to populate the UI and respect concurrency limits.
                        await fetchPromise();
                    }
                }
             }
          }
        } catch (err) {
          console.error("Error fetching feed", feed.url, err);
        } finally {
          running--;
          activeCount--;
          finishedCount++;
          if (!isCancelled && feeds.length > 0) {
             setSyncProgress(Math.round((finishedCount / feeds.length) * 100));
          }
          if (activeCount <= 0 && !isCancelled) {
             isFetchingRef.current = false;
             clearTimeout(flushTimeout);
             flushBuffer();
             setLoadingItems(false);
             setIsSyncing(false);
             
             // Set session synced flag so we don't show the fullscreen overlay again on tab switch
             try {
               sessionStorage.setItem(`rsser_session_synced_${type}`, 'true');
             } catch (e) {}
             
             // Process any metadata updates in background
             if (auth.currentUser) {
                const uid = auth.currentUser.uid;
                Object.entries(metadataUpdateBufferRef.current).forEach(([fid, updates]) => {
                  updateDoc(doc(db, 'users', uid, 'feeds', fid), updates).catch(() => {});
                });
                metadataUpdateBufferRef.current = {};
             }
          } else {
             // Keep the loop going
             processNext();
          }
        }
      };

      // Start initial batch of workers
      for (let i = 0; i < Math.min(CONCURRENCY_LIMIT, feedsToProcess.length); i++) {
        processNext();
      }
      // Reset force bypass once initial fetch request batch is dispatched
      forceBypassRef.current = false;
    };

    fetchAllFeedItems();
    
    return () => {
      isCancelled = true;
      isFetchingRef.current = false;
      lastFetchedUrlsRef.current = "";
    };
  }, [feedUrlsKey, type, refreshTick]);

  // Save compiled and sorted feed items into standard localStorage cache whenever they are loaded or updated.
  // We limit to 150 items to keep localStorage lightweight, lightning-fast, and bypass the browser's 5MB limit.
  // We use a 2-second debounce to avoid overloading storage when lazy-loading OG images in sequence.
  useEffect(() => {
    if (feedItems.length > 0) {
      const timer = setTimeout(() => {
        try {
          const slimmedItems = feedItems.slice(0, 150).map(item => slimRssItemForCache(item));
          safeLocalStorageSetItem(`cached_items_${type}`, JSON.stringify(slimmedItems));
          // Store complete rich items in IndexedDB without localStorage size bottlenecks
          setCachedCategoryItems(type, feedItems.slice(0, 300));
        } catch (e) {
          console.debug(`Error stringifying/storing feed cache for ${type}:`, e);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [feedItems, type]);

  useEffect(() => {
    if (feeds.length > 0) {
      setCachedCategoryFeeds(type, feeds);
    }
  }, [feeds, type]);

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
      // Check if it already exists to avoid duplicates
      const exists = feeds.some(f => f.url === feed.url);
      if (!exists) {
         const feedsRef = collection(db, 'users', auth.currentUser.uid, 'feeds');
         await addDoc(feedsRef, {
           title: feed.title,
           url: feed.url,
           category: feed.category
         });
      }
    }
  };

  const toggleSaved = async (e: React.MouseEvent, item: RssItem, type: 'isStarred' | 'isReadLater') => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    const existingKey = Object.keys(savedItemsDb).find(k => savedItemsDb[k].id === item.id);
    const existing = existingKey ? savedItemsDb[existingKey] : null;
    
    if (existing) {
      const ref = doc(db, 'users', auth.currentUser.uid, 'savedItems', existingKey);
      const newData = { ...existing, [type]: !existing[type] };
      if (!newData.isStarred && !newData.isReadLater) {
        await deleteDoc(ref).catch(err => handleFirestoreError(err, OperationType.DELETE, `savedItems/${existingKey}`));
      } else {
        await setDoc(ref, newData).catch(err => handleFirestoreError(err, OperationType.WRITE, `savedItems/${existingKey}`));
      }
    } else {
       const ref = doc(collection(db, 'users', auth.currentUser.uid, 'savedItems'));
       const newData = { ...item, savedAt: Date.now(), isStarred: false, isReadLater: false };
       newData[type] = true;
       await setDoc(ref, newData).catch(err => handleFirestoreError(err, OperationType.WRITE, `savedItems/new`));
    }
  };

  const toggleFeedSaved = async (e: React.MouseEvent, feed: any, field: 'isStarred' | 'isReadLater') => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    try {
      const isRadio = feed.isRadio || feed.category === 'Radio' || feed.type === 'radio';
      const collectionName = isRadio ? 'radioStations' : 'feeds';
      
      if (feed.id && !feed.id.startsWith('public-') && !feed.isDefault) {
        const ref = doc(db, 'users', auth.currentUser.uid, collectionName, feed.id);
        await updateDoc(ref, { [field]: !feed[field] });
      } else {
        const userCollRef = collection(db, 'users', auth.currentUser.uid, collectionName);
        const q = query(userCollRef);
        const snapshot = await getDocs(q);
        const existingDoc = snapshot.docs.find(d => d.data().url === feed.url);
        
        if (existingDoc) {
          const ref = doc(db, 'users', auth.currentUser.uid, collectionName, existingDoc.id);
          await updateDoc(ref, { [field]: !existingDoc.data()[field] });
        } else {
          const newFeedDoc = {
            title: feed.title || '',
            url: feed.url || '',
            category: feed.category || '',
            imageUrl: feed.imageUrl || feed.faviconUrl || '',
            isPodcast: feed.isPodcast || feed.type === 'podcasts' || false,
            [field]: true
          };
          await addDoc(userCollRef, newFeedDoc);
        }
      }
    } catch (err) {
      console.error("Error toggling feed saved state:", err);
    }
  };


  const handleMarkAllAsRead = async (feedId: string) => {
    if (!auth.currentUser) return;
    try {
      const feedRef = doc(db, 'users', auth.currentUser.uid, 'feeds', feedId);
      await updateDoc(feedRef, { lastReadAt: Date.now() });
    } catch (e) {
      console.error('Error marking as read', e);
      handleFirestoreError(e, OperationType.UPDATE, `users/feeds/${feedId}`);
    }
  };

  const { recentItems, midItems, olderItems } = useMemo(() => {
    let sourceItems = [...feedItems];
    
    // Merge saved items that might not be in feedItems (e.g. older than 5 days or purged from cache)
    Object.values(savedItemsDb).forEach((saved: any) => {
      const exists = feedItems.some(i => (i.id === saved.id || i.link === saved.link));
      if (!exists) {
        // Only add if it belongs to the current view type (rss, youtube, etc)
        const isYoutube = saved.link?.includes('youtube.com') || saved.link?.includes('youtu.be');
        const isPodcast = saved.enclosure?.url && (saved.enclosure.type?.startsWith('audio/') || type === 'podcasts' || saved.enclosure.url.toLowerCase().endsWith('.m4a') || saved.enclosure.url.toLowerCase().endsWith('.mp3'));
        const isBlog = saved.link?.includes('rsser.news') || saved.link?.includes('run.app');

        let match = false;
        if (type === 'youtube') match = isYoutube;
        else if (type === 'podcasts') match = isPodcast;
        else if (type === 'blogs') match = isBlog;
        else if (type === 'rss') match = !isYoutube && !isPodcast && !isBlog;
        else if (type === 'all') match = true;

        if (match) {
          sourceItems.push(saved as RssItem);
        }
      }
    });

    sourceItems = sourceItems.map(item => {
      const pSource = findPublicSource(item.feedUrl, item.feedTitle, publicSources);
      const userFeed = feeds.find(f => f.id === item.feedId || (f.url && f.url === item.feedUrl));
      
      let customImage = userFeed?.imageUrl || pSource?.imageUrl || item.feedImageUrl;
      
      // If customImage is watermarked/hardcoded iTunes image, let's see if we have a better/uploaded one in publicSource/userFeed
      if (customImage && customImage.includes('mzstatic.com/image/thumb/Podcasts125')) {
        const betterImg = (userFeed?.imageUrl && !userFeed.imageUrl.includes('mzstatic')) ? userFeed.imageUrl :
                          (pSource?.imageUrl && !pSource.imageUrl.includes('mzstatic')) ? pSource.imageUrl : null;
        if (betterImg) customImage = betterImg;
      }

      const isITunesImage = (url: string | undefined | null) => typeof url === 'string' && url.includes('mzstatic.com/image/thumb/Podcasts125');
      
      let finalFeedImg = customImage || item.feedImageUrl;
      let finalFavicon = customImage || item.faviconUrl;
      let finalImg = item.imageUrl;

      // Only fall back to the feed-level image as the card's main thumbnail for podcasts, videos, and webcams.
      // For general RSS news feeds and blogs, each article should have its own image (or none) rather than displaying the publisher's generic logo.
      const isPodcastOrVideoOrWebcam = type === 'podcasts' || type === 'youtube' || type === 'webcams' || 
                                       userFeed?.isPodcast || userFeed?.type === 'youtube' || userFeed?.type === 'webcams' ||
                                       pSource?.type === 'podcasts' || pSource?.type === 'youtube' || pSource?.type === 'webcams';

      if (customImage && isPodcastOrVideoOrWebcam) {
         const currentImgIsHardcoded = isITunesImage(item.imageUrl);
         if (!item.imageUrl || currentImgIsHardcoded) {
            finalImg = customImage;
         }
      }

      // Discard generic publisher logos as article-level images for general RSS news feeds and blogs
      const isInternalBlog = !!item.authorId || (item.feedUrl && (
        item.feedUrl.includes('/blog/') || 
        item.feedUrl.includes('/article/') || 
        item.feedUrl.includes('/blogs/user/') || 
        item.feedUrl.includes('/blogs/author/') || 
        item.feedUrl.includes('/p/') || 
        item.feedUrl.includes('/api/rss/user/')
      ));
      if (!isPodcastOrVideoOrWebcam && finalImg && !isInternalBlog) {
         const lowerImg = String(finalImg).toLowerCase();
         const lowerFeedImg = customImage ? String(customImage).toLowerCase() : '';
         const lowerFeedImageUrl = item.feedImageUrl ? String(item.feedImageUrl).toLowerCase() : '';
         const lowerFavicon = item.faviconUrl ? String(item.faviconUrl).toLowerCase() : '';

         if (
           lowerImg === lowerFeedImg || 
           lowerImg === lowerFeedImageUrl || 
           lowerImg === lowerFavicon ||
           lowerImg.includes('feed-logo') ||
           lowerImg.includes('feedlogo') ||
           lowerImg.includes('favicon') ||
           lowerImg.includes('heise-online-feed-logo') ||
           lowerImg.includes('golem-feed-logo') ||
           lowerImg.includes('logo_ho_pur') ||
           lowerImg.includes('logo-pur') ||
           lowerImg.includes('placeholder')
         ) {
           finalImg = undefined;
         }
      }

      return { 
         ...item, 
         feedImageUrl: finalFeedImg,
         faviconUrl: finalFavicon,
         imageUrl: finalImg
      };
    });
    
    if (selectedChannelId) {
      const selectedFeed = feeds.find(f => f.id === selectedChannelId || (f.url && f.url === selectedChannelId));
      if (selectedFeed) {
        sourceItems = sourceItems.filter(item => item.feedId === selectedFeed.id || (selectedFeed.url && item.feedUrl === selectedFeed.url));
      } else {
        sourceItems = sourceItems.filter(item => item.feedId === selectedChannelId || item.feedUrl === selectedChannelId);
      }
    } else if (selectedCategory === "Favoriten") {
      sourceItems = Object.values(savedItemsDb).filter((i: any) => {
        if (!i.isStarred) return false;
        const isYoutube = i.link?.includes('youtube.com') || i.link?.includes('youtu.be');
        const isPodcast = i.enclosure?.url || i.isPodcast || i.feedUrl?.includes('podcast') || i.feedTitle?.toLowerCase().includes('podcast');
        const isBlog = i.link?.includes('rsser.news') || i.link?.includes('run.app');
        if (type === 'youtube') return isYoutube;
        if (type === 'podcasts') return isPodcast;
        if (type === 'blogs') return isBlog;
        if (type === 'rss') return !isYoutube && !isPodcast && !isBlog;
        return true;
      });
      sourceItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (selectedCategory === "Später lesen" || selectedCategory === "Später hören" || selectedCategory === "Später sehen") {
      sourceItems = Object.values(savedItemsDb).filter((i: any) => {
        if (!i.isReadLater) return false;
        const isYoutube = i.link?.includes('youtube.com') || i.link?.includes('youtu.be');
        const isPodcast = i.enclosure?.url || i.isPodcast || i.feedUrl?.includes('podcast') || i.feedTitle?.toLowerCase().includes('podcast');
        const isBlog = i.link?.includes('rsser.news') || i.link?.includes('run.app');
        if (type === 'youtube') return isYoutube;
        if (type === 'podcasts') return isPodcast;
        if (type === 'blogs') return isBlog;
        if (type === 'rss') return !isYoutube && !isPodcast && !isBlog;
        return true;
      });
      sourceItems.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    } else if (selectedCategory !== "Alle") {
      sourceItems = feedItems.filter(item => item.category === selectedCategory);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      sourceItems = sourceItems.filter(item => 
        item.title?.toLowerCase().includes(q) || 
        item.contentSnippet?.toLowerCase().includes(q) ||
        item.feedTitle?.toLowerCase().includes(q)
      );
    }

    const seen = new Set<string>();
    const deduped: RssItem[] = [];
    sourceItems.forEach(item => {
      const titleExist = item && item.title && typeof item.title === 'string' && item.title.trim() !== '' && item.title.trim().toLowerCase() !== 'ohne titel';
      if (!titleExist) return;

      const key = item.id || item.link;
      if (key && !seen.has(key)) {
        seen.add(key);
        deduped.push(item);
      }
    });

    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const threeDays = 3 * oneDay;
    const fiveDays = 5 * oneDay;

    const today: RssItem[] = [];
    const mid: RssItem[] = [];
    const old: RssItem[] = [];

    deduped.forEach(item => {
      const isSaved = savedItemsDb[item.id] || savedItemsDb[item.link];
      
      const isPodcastItem = item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3'));
      const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
      const isWebcamItem = type === 'webcams' || item.category === 'WebCam';
      const isRadioItem = type === 'radio' || item.category === 'Radio';
      const isBlogItem = type === 'blogs' || item.category === 'Blogs';

      // For blogs, podcasts, youtube, webcams and radio we put everything in the "Recent" section (no time limits)
      if (isPodcastItem || isYoutubeItem || isWebcamItem || isRadioItem || isBlogItem) {
        today.push(item);
        return;
      }

      const age = now - item.timestamp;
      if (age < oneDay) {
        today.push(item);
      } else if (age < threeDays) {
        mid.push(item);
      } else if (age < fiveDays) {
        old.push(item);
      } else if (isSaved) {
        // Keep forever if saved
        old.push(item);
      }
    });

    return { recentItems: today, midItems: mid, olderItems: old };
  }, [feedItems, selectedCategory, savedItemsDb, selectedChannelId, type, searchQuery, publicSources]);

  const trendingItems = useMemo(() => {
    const all = [...recentItems, ...midItems, ...olderItems];
    if (all.length === 0) return [];
    
    return [...all]
      .map(item => ({ item, score: getVotesCount(item) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(entry => entry.item);
  }, [recentItems, midItems, olderItems, communityVotes]);

  // Smoothly-transition/stabilize changing top items during database and network updates to prevent slideshow flash
  useEffect(() => {
    if (trendingItems.length === 0) {
      setStableTrendingItems([]);
      return;
    }
    // If stable list is currently empty, show immediately for high perceived speed
    if (stableTrendingItems.length === 0) {
      setStableTrendingItems(trendingItems);
      return;
    }
    // Otherwise, debounce the changes to bypass rapid XML chunk loading spikes
    const handler = setTimeout(() => {
      setStableTrendingItems(trendingItems);
    }, 1200);
    return () => clearTimeout(handler);
  }, [trendingItems]);

  // Preload all custom loading animation GIFs on mount
  useEffect(() => {
    const gifsToPreload = [
      '/Loader_RSS.gif',
      '/Loader_Podcast.gif',
      '/Loader_Radio.gif',
      '/Loader_YouTube.gif',
      '/Loader_WebCam.gif',
      '/Loader_Blog.gif'
    ];
    gifsToPreload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Auto-play interval for Top Aktuell slideshow (always runs automatically, timer resets on interaction)
  useEffect(() => {
    if (stableTrendingItems.length <= 1) return;
    const interval = setInterval(() => {
      setSlideshowIndex((prev) => (prev + 1) % stableTrendingItems.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [stableTrendingItems.length, slideshowIndex]);

  // Reset slideshow index on type, channel or category changes to prevent fast transition glitching
  useEffect(() => {
    setSlideshowIndex(0);
  }, [type, selectedChannelId, selectedCategory]);

  // Handle bounds checks if active items change
  useEffect(() => {
    if (stableTrendingItems.length > 0 && slideshowIndex >= stableTrendingItems.length) {
      setSlideshowIndex(0);
    }
  }, [stableTrendingItems.length, slideshowIndex]);

  if (!auth.currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="opacity-50">Login required to view RSS feeds.</p>
      </div>
    );
  }

  const renderActions = (item: RssItem, layout: 'row' | 'column' = 'row') => {
    const existingKey = Object.keys(savedItemsDb).find(k => savedItemsDb[k].id === item.id);
    const existing = existingKey ? savedItemsDb[existingKey] : null;
    const isStarred = existing?.isStarred;
    const isReadLater = existing?.isReadLater;

    const voteCount = getVotesCount(item);
    const userVote = getVotedByUser(item); // 'up' | 'down' | null

    return (
      <div className={`flex ${layout === 'column' ? 'flex-col gap-3' : 'items-center justify-between mt-auto pt-2 w-full'} z-20`}>
        <div className={`flex ${layout === 'column' ? 'flex-col gap-3' : 'items-center gap-2'}`}>
          <button 
            onClick={(e) => toggleSaved(e, item, 'isReadLater')}
            className={`p-2 rounded-full transition-colors ${isReadLater ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-gray-400 hover:text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10'}`}
            title="Später lesen"
          >
            <Bookmark className="w-5 h-5" fill={isReadLater ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={(e) => toggleSaved(e, item, 'isStarred')}
            className={`p-2 rounded-full transition-colors ${isStarred ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
            title="Favorit"
          >
            <Star className="w-5 h-5" fill={isStarred ? 'currentColor' : 'none'} />
          </button>
        </div>

        {/* Community Upvote/Downvote Buttons */}
        {settings.showVoting && (
          <div 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="flex items-center gap-1 bg-gray-100/80 dark:bg-neutral-900 border border-gray-200/50 dark:border-white/5 rounded-full px-2 py-0.5 select-none pointer-events-auto"
          >
            <button
              onClick={(e) => castVote(e, item, 'up')}
              className={`p-1 rounded-full transition-all flex items-center justify-center hover:bg-emerald-500/10 ${userVote === 'up' ? 'text-emerald-500 hover:text-emerald-600 scale-110' : 'text-gray-400 hover:text-emerald-500'}`}
              title="Upvote (+1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-up"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            
            <span className={`text-[11px] font-bold font-mono min-w-[16px] text-center ${
              voteCount > 0 
                ? 'text-emerald-500' 
                : voteCount < 0 
                  ? 'text-red-500' 
                  : 'opacity-80 text-gray-500 dark:text-gray-400'
            }`}>
              {voteCount > 0 ? `+${voteCount}` : voteCount}
            </span>
            
            <button
              onClick={(e) => castVote(e, item, 'down')}
              className={`p-1 rounded-full transition-all flex items-center justify-center hover:bg-red-500/10 ${userVote === 'down' ? 'text-red-500 hover:text-red-600 scale-110' : 'text-gray-400 hover:text-red-500'}`}
              title="Downvote (-1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  const handleDeleteFeedDirectly = async (e: React.MouseEvent, feed: any) => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    const isRadio = feed.isRadio || feed.category === 'Radio' || feed.type === 'radio' || type === 'radio';
    const subcollectionName = isRadio ? 'radioStations' : 'feeds';
    
    const confirmed = await showConfirm(
      settings.language === 'en' ? 'Are you sure you want to delete this subscription?' : 'Möchtest du dieses Abonnement wirklich löschen?',
      settings.language === 'en' ? 'Delete subscription' : 'Abonnement löschen'
    );
    
    if (confirmed) {
      try {
        await deleteDoc(doc(db, 'users', auth.currentUser.uid, subcollectionName, feed.id));
        setFeeds(prev => {
          const next = prev.filter(f => f.id !== feed.id && f.url !== feed.url);
          try {
            safeLocalStorageSetItem(`cached_feeds_${type}`, JSON.stringify(next));
          } catch (_) {}
          return next;
        });
        setFeedItems(prev => prev.filter(i => i.feedId !== feed.id && i.feedUrl !== feed.url));
        if (feed.url) {
          const cacheId = encodeURIComponent(feed.url).replace(/[.#$/\[\]]/g, '_').substring(0, 500);
          try {
            localStorage.removeItem('rss_v5_' + cacheId);
          } catch (_) {}
        }
        if (selectedChannelId === feed.id || selectedChannelId === feed.url) {
          setSelectedChannelId(null);
        }
      } catch (err: any) {
        console.error(err);
        handleFirestoreError(err, OperationType.DELETE, `users/${auth.currentUser.uid}/${subcollectionName}/${feed.id}`);
      }
    }
  };

  const renderFeedActions = (feed: any, layout: 'row' | 'column' = 'row') => {
    const isStarred = !!feed.isStarred;
    const isReadLater = !!feed.isReadLater;
    const isDefault = !feed.id || feed.id.startsWith('default-');

    const isPodcast = feed.isPodcast || feed.type === 'podcasts' || type === 'podcasts';
    const isVideo = feed.category === 'WebCam' || feed.type === 'webcams' || type === 'webcams' || type === 'youtube' || feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be');
    const isRadio = feed.isRadio || feed.category === 'Radio' || feed.type === 'radio' || type === 'radio';
    
    let bookmarkTitle = isEn ? 'Read later' : 'Später lesen';
    if (isPodcast || isRadio) {
      bookmarkTitle = isEn ? 'Listen later' : 'Später hören';
    } else if (isVideo) {
      bookmarkTitle = isEn ? 'Watch later' : 'Später sehen';
    }

    const voteCount = getFeedVotesCount(feed.url);
    const userVote = getFeedVotedByUser(feed.url); // 'up' | 'down' | null

    return (
      <div className={`flex ${layout === 'column' ? 'flex-col gap-3' : 'items-center justify-between mt-auto pt-2 w-full'} z-20`}>
        <div className={`flex ${layout === 'column' ? 'flex-col gap-3' : 'items-center gap-2'}`}>
          <button 
            onClick={(e) => toggleFeedSaved(e, feed, 'isReadLater')}
            className={`p-2 rounded-full transition-colors ${isReadLater ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-gray-400 hover:text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10'}`}
            title={bookmarkTitle}
          >
            <Bookmark className="w-5 h-5" fill={isReadLater ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={(e) => toggleFeedSaved(e, feed, 'isStarred')}
            className={`p-2 rounded-full transition-colors ${isStarred ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
            title={isEn ? 'Favorite' : 'Favorit'}
          >
            <Star className="w-5 h-5" fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          {!isDefault && (
            <button 
              onClick={(e) => handleDeleteFeedDirectly(e, feed)}
              className="p-2 rounded-full text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              title={isEn ? 'Unsubscribe' : 'Deabonnieren'}
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Community Upvote/Downvote Buttons */}
        {settings.showVoting && (
          <div 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
            className="flex items-center gap-1 bg-gray-100/80 dark:bg-neutral-900 border border-gray-200/50 dark:border-white/5 rounded-full px-2 py-0.5 select-none pointer-events-auto shrink-0"
          >
            <button
              onClick={(e) => castFeedVote(e, feed.url, feed.title, 'up')}
              className={`p-1 rounded-full transition-all flex items-center justify-center hover:bg-emerald-500/10 ${userVote === 'up' ? 'text-emerald-500 hover:text-emerald-600 scale-110' : 'text-gray-400 hover:text-emerald-500'}`}
              title="Upvote (+1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-up"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            
            <span className={`text-[11px] font-bold font-mono min-w-[16px] text-center ${
              voteCount > 0 
                ? 'text-emerald-500' 
                : voteCount < 0 
                  ? 'text-red-500' 
                  : 'opacity-80 text-gray-500 dark:text-gray-400'
            }`}>
              {voteCount > 0 ? `+${voteCount}` : voteCount}
            </span>
            
            <button
              onClick={(e) => castFeedVote(e, feed.url, feed.title, 'down')}
              className={`p-1 rounded-full transition-all flex items-center justify-center hover:bg-red-500/10 ${userVote === 'down' ? 'text-red-500 hover:text-red-600 scale-110' : 'text-gray-400 hover:text-red-500'}`}
              title="Downvote (-1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  const markItemAsRead = async (item: RssItem) => {
    if (!auth.currentUser) return;
    try {
      const safeId = item.id.replace(/[^a-zA-Z0-9_\-]+/g, '_').substring(0, 100);
      const ref = doc(db, 'users', auth.currentUser.uid, 'readItems', safeId);
      await setDoc(ref, {
        itemId: item.id,
        title: item.title,
        link: item.link,
        readAt: Date.now()
      });
    } catch (e) {
      console.error('Error marking item as read', e);
    }
  };

  const toggleItemReadStatus = async (item: RssItem, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!auth.currentUser) return;
    try {
      const safeId = item.id.replace(/[^a-zA-Z0-9_\-]+/g, '_').substring(0, 100);
      const ref = doc(db, 'users', auth.currentUser.uid, 'readItems', safeId);
      const isCurrentlyRead = !!readItemsDb[item.id];
      if (isCurrentlyRead) {
        await deleteDoc(ref);
        setReadItemsDb(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } else {
        await setDoc(ref, {
          itemId: item.id,
          title: item.title,
          link: item.link,
          readAt: Date.now()
        });
        setReadItemsDb(prev => ({ ...prev, [item.id]: true }));
      }
    } catch (err) {
      console.error('Error toggling item read status', err);
    }
  };

  const handleItemClick = (e: React.MouseEvent, item: RssItem) => {
    markItemAsRead(item);
    // Check if it's an internal blog link to navigate within the app
    if (isInternalBlogLink(item.link)) {
        e.preventDefault();
        setReadingArticle(null);
        if (settings.viewMode === 'screensaver') setViewMode(type === 'rss' ? 'list' : 'grid');
        navigate(getInternalBlogPath(item.link), { state: { internal: true } });
        return;
    }

    const videoId = getOutputVideoId(item.link);

    if (videoId) {
      e.preventDefault();
      setPlayingVideo({ id: videoId, title: item.title, url: item.link });
    } else if (item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3'))) {
      e.preventDefault();
      const rawUrl = item.enclosure.url;
      const secureUrl = rawUrl.startsWith('http://') ? rawUrl.replace('http://', 'https://') : rawUrl;
      setPlayingAudio({
         title: item.title,
         url: secureUrl,
         feedTitle: item.feedTitle,
         imageUrl: item.imageUrl || item.faviconUrl,
         id: item.id,
         link: item.link
      });
    } else {
      const isMobile = window.innerWidth < 768;
      if (isMobile || !settings.openArticlesEmbedded) {
        // Let it open normally via target="_blank"
      } else {
        e.preventDefault();
        setReadingArticle({
           id: item.id,
           title: item.title,
           link: item.link,
           content: (item as any).content || (item as any)['content:encoded'] || (item as any).contentEncoded,
           contentSnippet: item.contentSnippet,
           pubDate: item.pubDate,
           author: (item as any).creator || (item as any).author,
           imageUrl: item.imageUrl,
           feedTitle: item.feedTitle
        });
      }
    }
  };

  const renderGridItem = (item: RssItem, index?: number) => {
    const isRead = !!readItemsDb[item.id];
    const isWebcamItem = type === 'webcams' || item.category === 'WebCam';
    const isRadioItem = type === 'radio' || item.category === 'Radio';
    const shouldShowReadState = isRead && !isWebcamItem && !isRadioItem;
    const hasImage = item.imageUrl && !failedImages[item.id];
    return (
      <a 
        href={item.link} 
        target="_blank" 
        rel="noopener noreferrer"
        onClick={(e) => handleItemClick(e, item)}
        key={`grid-item-${item.id || item.link}-${index ?? 0}`} 
        className={`content-visibility-auto group relative overflow-hidden flex flex-col rounded-xl border transition-all duration-300 hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} ${shouldShowReadState ? 'opacity-50 saturate-[40%]' : ''}`}
      >
      {hasImage ? (
        <div className={`${type === 'podcasts' ? 'aspect-square' : 'aspect-video'} w-full overflow-hidden bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative glanz-image-container`}>
          <FadeInImage 
            src={proxyImageUrl(item.imageUrl)!} 
            alt={item.title} 
            priority={typeof index === 'number' && index < 6}
            fallbackFavicon={item.faviconUrl}
            feedTitle={item.feedTitle}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
            referrerPolicy="no-referrer"
            onError={() => {
              setFailedImages(prev => ({ ...prev, [item.id]: true }));
            }}
          />
          {item.language && (
            <div className="absolute top-3 left-3 z-30 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-lg text-sm flex items-center justify-center leading-none border border-white/10">
              {item.language === 'en' ? '🇺🇸' : 
               item.language === 'fr' ? '🇫🇷' : 
               item.language === 'es' ? '🇪🇸' : 
               item.language === 'it' ? '🇮🇹' : 
               item.language === 'pt' ? '🇵🇹' : 
              '🇩🇪'}
            </div>
          )}
          {item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')) && (
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white z-10 border border-white/20 transform transition-transform group-hover:scale-110">
              <Headphones className="w-4 h-4" />
            </div>
          )}
          {shouldShowReadState && (
            <div 
              onClick={(e) => toggleItemReadStatus(item, e)}
              className="absolute bottom-3 right-3 z-30 bg-black/75 hover:bg-neutral-850 active:scale-95 transition-all backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/15 shadow-sm pointer-events-auto cursor-pointer select-none"
              title={tr(settings.language, 'Mark as unseen', 'Als ungesehen markieren')}
            >
              {tr(settings.language, 'Already seen', 'Bereits gesehen')}
            </div>
          )}
        </div>
      ) : (
        <div className={`${type === 'podcasts' ? 'aspect-square' : 'aspect-video'} w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden pointer-events-none select-none`}>
          {item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')) && (
            <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 md flex items-center justify-center text-black dark:text-white z-10">
              <Headphones className="w-4 h-4" />
            </div>
          )}
          {item.faviconUrl ? (
            <>
                <div 
                  className="absolute inset-[-20%] bg-cover bg-center blur-2xl opacity-40 dark:opacity-20 pointer-events-none"
                  style={{ backgroundImage: `url(${item.faviconUrl})` }}
                />
                <img loading="lazy" src={proxyImageUrl(item.faviconUrl)} alt={item.feedTitle} className={`relative z-10 ${type === 'podcasts' ? 'w-full h-full object-cover' : item.enclosure?.url && item.enclosure.type?.startsWith('audio/') ? 'w-auto h-full object-contain' : 'w-16 h-16 rounded-xl'}`} referrerPolicy="no-referrer" />
            </>
          ) : (
            <FileText className="w-12 h-12 opacity-20 relative z-10" />
          )}
          {shouldShowReadState && (
            <div 
              onClick={(e) => toggleItemReadStatus(item, e)}
              className="absolute bottom-3 right-3 z-30 bg-black/75 hover:bg-neutral-850 active:scale-95 transition-all backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/15 shadow-sm pointer-events-auto cursor-pointer select-none"
              title={tr(settings.language, 'Mark as unseen', 'Als ungesehen markieren')}
            >
              {tr(settings.language, 'Already seen', 'Bereits gesehen')}
            </div>
          )}
        </div>
      )}
      <div className="p-5 flex flex-col flex-1 gap-3">
        <div className="flex justify-between items-center text-xs opacity-70">
          <div 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (item.authorId) {
                navigate(`/blogs/author/${item.authorId}`, { state: { internal: true } });
              } else if (item.feedId) {
                setSelectedChannelId(item.feedId);
              }
            }}
            className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${formatColors.text} cursor-pointer hover:underline`}
          >
            {item.authorId ? (
              <AuthorAvatar 
                userId={item.authorId} 
                fallbackFavicon={item.faviconUrl} 
                className="w-6 h-6 rounded-full border border-yellow-500/20" 
              />
            ) : item.faviconUrl ? (
              <img loading="lazy" 
                src={proxyImageUrl(item.faviconUrl)} 
                alt="" 
                className="w-6 h-6 rounded object-cover" 
                referrerPolicy="no-referrer" 
              />
            ) : (
              <FileText className="w-5 h-5" />
            )}
            <span className="truncate max-w-[120px]">{item.feedTitle}</span>
          </div>
          <span>{formatDate(item.pubDate)}</span>
        </div>
        <h3 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors line-clamp-3`}>
          {item.title}
        </h3>
        {item.contentSnippet && (
          <p className="text-sm opacity-60 line-clamp-2 mt-auto">
            {item.contentSnippet}
          </p>
        )}
        <div className={!item.contentSnippet ? 'mt-auto' : ''}>
          {renderActions(item)}
        </div>
      </div>
    </a>
  );
};

  // Track news items and radio spacing globally for the current render pass of magazine view
  let globalNewsCount = 0;
  let lastRadioNewsCount = -999;

  const renderMagazineItem = (item: RssItem, index: number | string, forcedSpan?: number) => {
    const isRead = !!readItemsDb[item.id];
    const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
    const isWebcamItem = type === 'webcams' || item.category === 'WebCam';
    const isPodcastItem = !!(item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')));
    const isBlogItem = type === 'blogs' || item.category === 'Blogs' || item.feedTitle?.toLowerCase().includes('blog') || item.link?.includes('/blog/') || item.link?.includes('/blogs/');
    const isRadioItem = type === 'radio' || item.category === 'Radio';
    const shouldShowReadState = isRead && !isWebcamItem && !isRadioItem;
    
    const hasFailedImage = failedImages[item.id];
    let displayImageUrl = hasFailedImage ? undefined : item.imageUrl;
    if (!displayImageUrl && isBlogItem) {
      displayImageUrl = "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop";
    }
    
    let isLarge = forcedSpan !== undefined ? forcedSpan === 8 : (typeof index === 'number' ? (index % 10 === 0 || index % 10 === 6) : false);
    if (isYoutubeItem || isWebcamItem || isPodcastItem) {
      isLarge = false;
    }
    
    const span = isLarge ? 'col-span-12 md:col-span-8' : 'col-span-12 md:col-span-4';
    const imageHeight = isLarge ? 'h-64 md:h-80' : 'aspect-video';

    const videoId = getOutputVideoId(item.link);
    const hasInlinePlayer = !!videoId && (isYoutubeItem || isWebcamItem);
    const playId = `magazine-item-${item.id || item.link}-${index}`;
    const isPlayingInline = inlinePlayingIds.includes(playId);

    return (
      <a 
        href={item.link} 
        target="_blank" 
        rel="noopener noreferrer"
        onClick={(e) => {
          markItemAsRead(item);
          if (hasInlinePlayer) {
            e.preventDefault();
            e.stopPropagation();
            if (!inlinePlayingIds.includes(playId)) {
              setInlinePlayingIds(prev => [...prev, playId]);
            }
          } else {
            handleItemClick(e, item);
          }
        }}
        key={playId} 
        className={`${span} content-visibility-auto group relative overflow-hidden flex flex-col rounded-2xl border transition-all ${isPlayingInline ? '' : 'hover:-translate-y-1'} ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} ${shouldShowReadState ? 'opacity-50 saturate-[40%]' : ''}`}
      >
        <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800`}>
          {isPlayingInline ? (
            <div className="absolute inset-0 z-30 bg-black" onClick={(e) => e.stopPropagation()}>
              <iframe 
                src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} 
                title={item.title}
                className="w-full h-full"
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setInlinePlayingIds(prev => prev.filter(id => id !== playId));
                }}
                className="absolute top-2 right-2 z-40 bg-black/80 hover:bg-black p-2 rounded-full text-white border border-white/20 transition-all hover:scale-110 shadow-lg"
                title="Wiedergabe beenden"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {displayImageUrl ? (
                <div className="w-full h-full relative glanz-image-container">
                  {(type === 'podcasts' || type === 'radio') ? (
                    <>
                      <div 
                        className="absolute inset-[-20%] bg-cover bg-center blur-xl opacity-60 saturate-150 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-80-bg-div"
                        style={{ backgroundImage: `url(${proxyImageUrl(displayImageUrl)})` }}
                      />
                      <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                      <FadeInImage 
                        src={proxyImageUrl(displayImageUrl)!} 
                        alt={item.title} 
                        priority={typeof index === 'number' && index < 4}
                        fallbackFavicon={item.faviconUrl}
                        feedTitle={item.feedTitle}
                        className="w-full h-full object-contain relative z-10 transition-transform duration-700 group-hover:scale-105" 
                        referrerPolicy="no-referrer"
                        onError={() => {
                          setFailedImages(prev => ({ ...prev, [item.id]: true }));
                        }}
                      />
                    </>
                  ) : (
                    <FadeInImage 
                      src={proxyImageUrl(displayImageUrl)!} 
                      alt={item.title} 
                      priority={typeof index === 'number' && index < 4}
                      fallbackFavicon={item.faviconUrl}
                      feedTitle={item.feedTitle}
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                      referrerPolicy="no-referrer"
                      onError={() => {
                        setFailedImages(prev => ({ ...prev, [item.id]: true }));
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-neutral-800 overflow-hidden relative select-none">
                  {item.faviconUrl ? (
                    <>
                      <div 
                        className="absolute inset-[-20%] bg-cover bg-center blur-2xl opacity-40 dark:opacity-20 pointer-events-none"
                        style={{ backgroundImage: `url(${item.faviconUrl})` }}
                      />
                      <img loading="lazy" src={proxyImageUrl(item.faviconUrl)} alt={item.feedTitle} className={`relative z-10 ${item.enclosure?.url && item.enclosure.type?.startsWith('audio/') ? 'w-auto h-full object-contain' : 'w-16 h-16 rounded-xl'}`} referrerPolicy="no-referrer" />
                    </>
                  ) : (
                    <FileText className="w-12 h-12 opacity-20 relative z-10" />
                  )}
                </div>
              )}

              {item.language && (
                <div className="absolute top-4 left-4 z-30 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-lg text-sm flex items-center justify-center leading-none border border-white/10">
                  {item.language === 'en' ? '🇺🇸' : 
                   item.language === 'fr' ? '🇫🇷' : 
                   item.language === 'es' ? '🇪🇸' : 
                   item.language === 'it' ? '🇮🇹' : 
                   item.language === 'pt' ? '🇵🇹' : 
                  '🇩🇪'}
                </div>
              )}

              {item.enclosure?.url && item.enclosure.type?.startsWith('audio/') && (
                <div className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white z-10 border border-white/20 transform transition-transform group-hover:scale-110">
                  <Headphones className="w-4 h-4" />
                </div>
              )}

              {hasInlinePlayer && (
                <div 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!inlinePlayingIds.includes(playId)) {
                      setInlinePlayingIds(prev => [...prev, playId]);
                    }
                  }}
                  className="absolute inset-0 bg-black/25 flex items-center justify-center z-10 transition-opacity duration-300 group-hover:bg-black/45 cursor-pointer"
                >
                  <div className="w-14 h-14 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg transform transition-all duration-300 group-hover:scale-110 group-hover:bg-red-700">
                    <Play className="w-6 h-6 fill-current ml-0.5" />
                  </div>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 whitespace-nowrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white bg-black/60 px-3 py-1 rounded-full backdrop-blur-md">
                      {isWebcamItem ? tr(settings.language, 'Play Live Stream', 'Live Stream abspielen') : tr(settings.language, 'Play Video', 'Video abspielen')}
                    </span>
                  </div>
                </div>
              )}

              {shouldShowReadState && (
                <div 
                  onClick={(e) => toggleItemReadStatus(item, e)}
                  className="absolute bottom-4 right-4 z-30 bg-black/75 hover:bg-neutral-850 active:scale-95 transition-all backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white border border-white/15 shadow-sm pointer-events-auto cursor-pointer select-none"
                  title={tr(settings.language, 'Mark as unseen', 'Als ungesehen markieren')}
                >
                  {tr(settings.language, 'Already seen', 'Bereits gesehen')}
                </div>
              )}
            </>
          )}
        </div>
        
        <div className="p-6 flex flex-col flex-1 gap-3">
          <div className="flex justify-between items-center text-xs opacity-70">
            <div 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.authorId) {
                  navigate(`/blogs/author/${item.authorId}`, { state: { internal: true } });
                } else if (item.feedId) {
                  setSelectedChannelId(item.feedId);
                }
              }}
              className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${formatColors.text} cursor-pointer hover:underline`}
            >
              {item.authorId ? (
                <AuthorAvatar 
                  userId={item.authorId} 
                  fallbackFavicon={item.faviconUrl} 
                  className="w-6 h-6 rounded-full border border-yellow-500/20" 
                />
              ) : item.faviconUrl ? (
                <img loading="lazy" 
                  src={proxyImageUrl(item.faviconUrl)} 
                  alt="" 
                  className="w-6 h-6 rounded object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span className="truncate max-w-[150px]">{item.feedTitle}</span>
            </div>
            <span>{formatDate(item.pubDate)}</span>
          </div>

          <h3 className={`font-bold leading-tight ${isLarge ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors line-clamp-3`}>
            {item.title}
          </h3>
          {item.contentSnippet && (
            <p className={`text-sm opacity-80 flex-1 ${isLarge ? 'md:line-clamp-3 md:text-base' : 'line-clamp-2'}`}>
              {item.contentSnippet}
            </p>
          )}
          <div className={!item.contentSnippet ? 'mt-auto' : 'mt-2'}>
            {renderActions(item)}
          </div>
        </div>
      </a>
    );
  };

  const renderIntersperseCard = (cardType: string, key: string, poolIndex: number, span = 4) => {
    const isDark = settings.theme === 'dark';
    const spanClass = span === 8 ? 'col-span-12 md:col-span-8' : 'col-span-12 md:col-span-4';
    const imageHeight = span === 8 ? 'h-64 md:h-80' : 'aspect-video';
    
    if (cardType === 'radio') {
      // Prioritize user's custom added radio stations, fallback to public radio sources, fallback to defaults
      let stationsToUse = [...userRadioStations];
      if (stationsToUse.length < 12) {
        const publicRadio = publicSources.filter(s => s.type === 'radio' || s.category === 'Radio');
        for (const pr of publicRadio) {
          if (stationsToUse.length >= 12) break;
          if (!stationsToUse.some(s => s.url === pr.url)) {
            stationsToUse.push(pr);
          }
        }
      }
      if (stationsToUse.length < 12) {
        const defaultStations = [
          {
            title: 'WDR 1LIVE',
            shortName: '1LIVE',
            url: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fb/WDR_1LIVE_Logo_2016.svg',
            category: 'POP',
            domain: 'wdr.de'
          },
          {
            title: 'SWR3',
            shortName: 'SWR3',
            url: 'https://swr-swr3-live.cast.addradio.de/swr/swr3/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/SWR3_Logo.svg',
            category: 'POP',
            domain: 'swr3.de'
          },
          {
            title: 'Radio Swiss Pop',
            shortName: 'Swiss Pop',
            url: 'http://stream.srg-ssr.ch/m/rsp/mp3_128',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/c/c8/Radio_Swiss_Pop_Logo_2018.svg',
            category: 'RELAX',
            domain: 'srg-ssr.ch'
          },
          {
            title: 'Antenne Bayern',
            shortName: 'Antenne BY',
            url: 'https://mp3channels.webradio.antenne.de/antenne',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Antenne_Bayern_logo.svg',
            category: 'POP',
            domain: 'antenne.de'
          },
          {
            title: 'SRF 3',
            shortName: 'SRF 3',
            url: 'https://srf-3-live.cast.addradio.de/srf/srf3/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/df/SRF_3_logo_2020.svg',
            category: 'POP',
            domain: 'srf.ch'
          },
          {
            title: 'Radio 24',
            shortName: 'Radio 24',
            url: 'https://radio24.ice.infomaniak.ch/radio24-128.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/22/Logo_Radio_24.png',
            category: 'POP',
            domain: 'radio24.ch'
          },
          {
            title: 'Energy Zürich',
            shortName: 'Energy ZH',
            url: 'https://energyzurich.ice.infomaniak.ch/energyzurich-high.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Logo_Energy_Z%C3%BCrich_2022.svg',
            category: 'POP',
            domain: 'energy.ch'
          },
          {
            title: 'Bayern 3',
            shortName: 'Bayern 3',
            url: 'https://br-br3-live.cast.addradio.de/br/br3/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/ee/Bayern_3_Logo.svg',
            category: 'POP',
            domain: 'br.de'
          },
          {
            title: 'Sunshine Live',
            shortName: 'SSL',
            url: 'https://sunshinelive.ice.infomaniak.ch/sunshinelive-128.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/3d/Sunshine_live_logo.svg',
            category: 'ELECTRONIC',
            domain: 'sunshine-live.de'
          },
          {
            title: 'bigFM',
            shortName: 'bigFM',
            url: 'https://bigcast.bigfm.de/bigfm-deutschland-128-mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/23/BigFM_Logo.svg',
            category: 'POP',
            domain: 'bigfm.de'
          },
          {
            title: 'N-JOY',
            shortName: 'N-JOY',
            url: 'https://ndr-njoy-live.cast.addradio.de/ndr/njoy/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/a/af/Logo_N-Joy_2013.svg',
            category: 'POP',
            domain: 'ndr.de'
          },
          {
            title: 'Deutschlandfunk',
            shortName: 'DLF',
            url: 'https://deutschlandradio-dlf-live.cast.addradio.de/dradio/dlf/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/87/Deutschlandfunk_logo.svg',
            category: 'TALK',
            domain: 'deutschlandradio.de'
          },
          {
            title: 'Radio Swiss Classic',
            shortName: 'Swiss Classic',
            url: 'http://stream.srg-ssr.ch/m/rsc_de/mp3_128',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/e/e0/Radio_Swiss_Classic_Logo_2018.svg',
            category: 'CLASSIC',
            domain: 'srg-ssr.ch'
          },
          {
            title: 'Radio Swiss Jazz',
            shortName: 'Swiss Jazz',
            url: 'http://stream.srg-ssr.ch/m/rsj/mp3_128',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/d/da/Radio_Swiss_Jazz_Logo_2018.svg',
            category: 'JAZZ',
            domain: 'srg-ssr.ch'
          },
          {
            title: 'hr3',
            shortName: 'hr3',
            url: 'https://hr-hr3-live.cast.addradio.de/hr/hr3/live/mp3/128/stream.mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b5/Hr3_Logo_2015.svg',
            category: 'POP',
            domain: 'hr.de'
          },
          {
            title: 'RTL Radio',
            shortName: 'RTL',
            url: 'http://stream.rtlradio.de/rtl-de-mp3',
            imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/37/RTL_Radio_Logo.svg',
            category: 'POP',
            domain: 'rtlradio.de'
          }
        ];
        for (const ds of defaultStations) {
          if (stationsToUse.length >= 12) break;
          if (!stationsToUse.some(s => s.url === ds.url)) {
            stationsToUse.push(ds);
          }
        }
      }

      const isWide = span === 8;
      let gridColsClass = "grid-cols-3";
      let maxStations = 6;
      if (isWide) {
        gridColsClass = "grid-cols-4 md:grid-cols-6";
        maxStations = 12;
      } else {
        gridColsClass = "grid-cols-3";
        maxStations = 6;
      }
      const stationsToUseSlice = stationsToUse.slice(0, maxStations);

      return (
        <div 
          key={key}
          className={`${spanClass} group relative overflow-hidden flex flex-col rounded-2xl border transition-all hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'}`}
        >
          {/* Top Image Area */}
          <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800 glanz-image-container`}>
            <div 
              className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
              style={{ backgroundImage: `url(https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop)` }}
            />
            {/* Dark gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/25 to-black/10" />
            
            {/* Badge top-left */}
            <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-blue-600 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
              <Radio className="w-3.5 h-3.5 animate-pulse" />
              WEBRADIO
            </div>
            {/* Info top-right */}
            <div className="absolute top-4 right-4 text-[9px] font-bold tracking-widest text-white/85 bg-black/45 border border-white/10 px-2 py-1 rounded uppercase backdrop-blur-xs">
              Live Stream
            </div>
          </div>

          {/* Bottom Content Area */}
          <div className="p-6 flex flex-col flex-1 gap-4">
            <div>
              <div className="flex justify-between items-center text-xs opacity-70 mb-2">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                  INTERACTIVE AUDIO
                </span>
                <span>{stationsToUse.length} SENDER</span>
              </div>
              <h3 className={`font-bold leading-tight ${span === 8 ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1`}>
                Beliebte Radiosender
              </h3>
            </div>

            {/* Grid of beautiful 1:1 compact station tiles */}
            <div className={`grid ${gridColsClass} gap-3.5 mt-1`}>
              {stationsToUseSlice.map((station) => {
                const isPlaying = playingAudio?.url === station.url;
                const displayImage = station.imageUrl || station.faviconUrl;

                return (
                  <div
                    key={station.title}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (isPlaying) {
                        setPlayingAudio(null);
                      } else {
                        setPlayingVideo(null);
                        setReadingArticle(null);
                        setPlayingAudio({
                          title: station.title,
                          url: station.url,
                          feedTitle: 'Webradio',
                          imageUrl: displayImage ? proxyImageUrl(displayImage) : '',
                          id: station.title,
                          link: station.url
                        });
                      }
                    }}
                    className={`group/tile relative aspect-square overflow-hidden rounded-2xl border transition-all duration-300 hover:-translate-y-1 cursor-pointer flex items-center justify-center bg-white dark:bg-neutral-950 ${
                      isPlaying 
                        ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md shadow-blue-500/10' 
                        : 'border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20'
                    }`}
                    title={station.title}
                  >
                    {/* Cover logo image */}
                    {displayImage ? (
                      <img loading="lazy" 
                        src={proxyImageUrl(displayImage)} 
                        alt={station.title} 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover/tile:scale-110"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center text-xs opacity-50">
                        <Radio className="w-5 h-5 mb-1 text-blue-500 animate-pulse" />
                        <span className="text-[10px] font-bold tracking-tight truncate max-w-full">
                          {station.shortName || station.title}
                        </span>
                      </div>
                    )}

                    {/* Active hover/playing overlay */}
                    <div className={`absolute inset-0 bg-black/45 flex items-center justify-center transition-opacity duration-300 z-10 ${
                      isPlaying ? 'opacity-100 bg-black/30' : 'opacity-0 group-hover/tile:opacity-100'
                    }`}>
                      {isPlaying ? (
                        <div className="flex items-center gap-0.5 h-3">
                          <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_0s] h-2" />
                          <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_0.15s] h-3" />
                          <span className="w-0.5 bg-white rounded-full animate-[bounce_0.8s_infinite_0.3s] h-1.5" />
                        </div>
                      ) : (
                        <Play className="w-5 h-5 text-white fill-white" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    if (cardType === 'podcast' && interspersePool.podcasts.length > 0) {
      const item = interspersePool.podcasts[poolIndex % interspersePool.podcasts.length];
      const isPlaying = playingAudio?.url === item.enclosure?.url;
      
      return (
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
          onClick={(e) => handleItemClick(e, item)}
          className={`${spanClass} group relative overflow-hidden flex flex-col rounded-2xl border transition-all hover:-translate-y-1 cursor-pointer ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'}`}
        >
          <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800 glanz-image-container`}>
            {item.imageUrl ? (
              <>
                <div 
                  className="absolute inset-[-20%] bg-cover bg-center blur-xl opacity-60 saturate-150 transition-transform duration-700 group-hover:scale-110 group-hover:opacity-80"
                  style={{ backgroundImage: `url(${proxyImageUrl(item.imageUrl)})` }}
                />
                <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                <img loading="lazy" 
                  src={proxyImageUrl(item.imageUrl)} 
                  alt={item.title} 
                  className="w-full h-full object-contain relative z-10 transition-transform duration-700 group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                />
              </>
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/20 dark:to-indigo-900/20 flex items-center justify-center text-purple-400">
                <Headphones className="w-10 h-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleItemClick(e, item);
                }}
                className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
              >
                {isPlaying ? <Square className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
              </button>
            </div>
            
            <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-purple-600 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
              <Headphones className="w-3.5 h-3.5" />
              PODCAST
            </div>
          </div>

          <div className="p-6 flex flex-col flex-1 gap-3">
            <div className="flex justify-between items-center text-xs opacity-70">
              <div 
                onClick={(e) => {
                  if (item.feedId) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedChannelId(item.feedId);
                  }
                }}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400 cursor-pointer hover:underline"
              >
                {item.faviconUrl ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(item.faviconUrl)} 
                    alt="" 
                    className="w-6 h-6 rounded object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <Headphones className="w-5 h-5" />
                )}
                <span className="truncate max-w-[150px]">{item.feedTitle}</span>
              </div>
              <span>{formatDate(item.pubDate)}</span>
            </div>

            <h3 className={`font-bold leading-tight ${span === 8 ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors line-clamp-3`}>
              {item.title}
            </h3>
            {item.contentSnippet && (
              <p className={`text-sm opacity-80 flex-1 ${span === 8 ? 'md:line-clamp-3 md:text-base' : 'line-clamp-2'}`}>
                {item.contentSnippet}
              </p>
            )}
            <div className={!item.contentSnippet ? 'mt-auto' : 'mt-2'}>
              {renderActions(item)}
            </div>
          </div>
        </a>
      );
    }

    if (cardType === 'youtube' && interspersePool.youtube.length > 0) {
      const item = interspersePool.youtube[poolIndex % interspersePool.youtube.length];
      const videoId = getOutputVideoId(item.link);
      const playId = `intersperse-card-youtube-${item.id || item.link}-${key}`;
      const isPlayingInline = inlinePlayingIds.includes(playId);
      
      return (
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
          onClick={(e) => {
            if (videoId) {
              e.preventDefault();
              e.stopPropagation();
              if (!inlinePlayingIds.includes(playId)) {
                setInlinePlayingIds(prev => [...prev, playId]);
              }
            } else {
              handleItemClick(e, item);
            }
          }}
          className={`${spanClass} group relative overflow-hidden flex flex-col rounded-2xl border transition-all ${isPlayingInline ? '' : 'hover:-translate-y-1'} cursor-pointer ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'}`}
        >
          <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800 glanz-image-container`}>
            {isPlayingInline ? (
              <div className="absolute inset-0 z-30 bg-black" onClick={(e) => e.stopPropagation()}>
                <iframe 
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} 
                  title={item.title}
                  className="w-full h-full"
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                />
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInlinePlayingIds(prev => prev.filter(id => id !== playId));
                  }}
                  className="absolute top-2 right-2 z-40 bg-black/80 hover:bg-black p-2 rounded-full text-white border border-white/20 transition-all hover:scale-110 shadow-lg"
                  title="Wiedergabe beenden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {item.imageUrl ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(item.imageUrl)} 
                    alt={item.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-red-100 to-amber-100 dark:from-red-900/20 dark:to-amber-900/20 flex items-center justify-center text-red-400">
                    <Youtube className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (videoId && !inlinePlayingIds.includes(playId)) {
                        setInlinePlayingIds(prev => [...prev, playId]);
                      } else {
                        handleItemClick(e, item);
                      }
                    }}
                    className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                </div>
                
                <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-red-600 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
                  <Youtube className="w-3.5 h-3.5" />
                  YOUTUBE
                </div>
              </>
            )}
          </div>

          <div className="p-6 flex flex-col flex-1 gap-3">
            <div className="flex justify-between items-center text-xs opacity-70">
              <div 
                onClick={(e) => {
                  if (item.feedId) {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedChannelId(item.feedId);
                  }
                }}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400 cursor-pointer hover:underline"
              >
                {item.faviconUrl ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(item.faviconUrl)} 
                    alt="" 
                    className="w-6 h-6 rounded object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <Youtube className="w-5 h-5" />
                )}
                <span className="truncate max-w-[150px]">{item.feedTitle}</span>
              </div>
              <span>{formatDate(item.pubDate)}</span>
            </div>

            <h3 className={`font-bold leading-tight ${span === 8 ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors line-clamp-3`}>
              {item.title}
            </h3>
            {item.contentSnippet && (
              <p className={`text-sm opacity-80 flex-1 ${span === 8 ? 'md:line-clamp-3 md:text-base' : 'line-clamp-2'}`}>
                {item.contentSnippet}
              </p>
            )}
            <div className={!item.contentSnippet ? 'mt-auto' : 'mt-2'}>
              {renderActions(item)}
            </div>
          </div>
        </a>
      );
    }

    if (cardType === 'webcam' && interspersePool.webcams.length > 0) {
      const feed = interspersePool.webcams[poolIndex % interspersePool.webcams.length];
      const videoId = getOutputVideoId(feed.url);
      
      const isYoutube = feed.url?.includes('youtube.com') || feed.url?.includes('youtu.be');
      let ytThumbnail = feed.bannerUrl || feed.imageUrl;
      if (isYoutube && !ytThumbnail && videoId) {
        ytThumbnail = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      }
      
      const webcamAsItem: RssItem = {
        id: feed.id || feed.url || Math.random().toString(),
        title: feed.title || 'WebCam',
        link: feed.url || '',
        pubDate: new Date().toISOString(),
        contentSnippet: feed.title || 'WebCam Stream',
        feedTitle: 'WebCam',
        feedId: feed.id || '',
        feedUrl: feed.url || '',
        feedImageUrl: feed.imageUrl,
        timestamp: Date.now(),
        imageUrl: ytThumbnail || feed.imageUrl,
        faviconUrl: getFavicon(feed.url),
        category: 'WebCam'
      };
      
      const playId = `intersperse-webcam-${feed.id || feed.url || 'webcam'}-${key}`;
      const isPlayingInline = inlinePlayingIds.includes(playId);
      
      return (
        <div 
          key={key}
          onClick={(e) => {
            if (videoId) {
              e.preventDefault();
              e.stopPropagation();
              if (!inlinePlayingIds.includes(playId)) {
                setInlinePlayingIds(prev => [...prev, playId]);
              }
            } else {
              e.preventDefault();
              e.stopPropagation();
              if (videoId) {
                setPlayingVideo({ id: videoId, title: feed.title, url: feed.url, isWebcam: true, webcamId: feed.id });
              }
            }
          }}
          className={`${spanClass} group relative overflow-hidden flex flex-col rounded-2xl border transition-all ${isPlayingInline ? '' : 'hover:-translate-y-1'} cursor-pointer ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'}`}
        >
          <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800 glanz-image-container`}>
            {isPlayingInline ? (
              <div className="absolute inset-0 z-30 bg-black" onClick={(e) => e.stopPropagation()}>
                <iframe 
                  src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`} 
                  title={feed.title}
                  className="w-full h-full"
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                  allowFullScreen
                />
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setInlinePlayingIds(prev => prev.filter(id => id !== playId));
                  }}
                  className="absolute top-2 right-2 z-40 bg-black/80 hover:bg-black p-2 rounded-full text-white border border-white/20 transition-all hover:scale-110 shadow-lg"
                  title="Wiedergabe beenden"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                {ytThumbnail ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(ytThumbnail)} 
                    alt={feed.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 flex items-center justify-center text-emerald-400">
                    <Video className="w-12 h-12" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity z-10">
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (videoId && !inlinePlayingIds.includes(playId)) {
                        setInlinePlayingIds(prev => [...prev, playId]);
                      } else if (videoId) {
                        setPlayingVideo({ id: videoId, title: feed.title, url: feed.url, isWebcam: true, webcamId: feed.id });
                      }
                    }}
                    className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-lg transition-transform"
                  >
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </button>
                </div>
                
                <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-emerald-600 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 block animate-ping mr-1" />
                  WEBCAM
                </div>
              </>
            )}
          </div>

          <div className="p-6 flex flex-col flex-1 gap-3">
            <div className="flex justify-between items-center text-xs opacity-70">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                {feed.imageUrl ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(feed.imageUrl)} 
                    alt="" 
                    className="w-6 h-6 rounded object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <Video className="w-5 h-5" />
                )}
                <span className="truncate max-w-[150px]">{feed.category || 'WebCam'}</span>
              </div>
              <span>{new Date().toLocaleDateString()}</span>
            </div>

            <h3 className={`font-bold leading-tight ${span === 8 ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-3`}>
              {feed.title}
            </h3>
            <p className={`text-sm opacity-80 flex-1 ${span === 8 ? 'md:line-clamp-3 md:text-base' : 'line-clamp-2'}`}>
              Echtzeit Live-Webcam aus {feed.category || 'aller Welt'}. Klicken Sie hier, um den Stream live im Player zu öffnen.
            </p>
            <div className="mt-auto">
              {renderActions(webcamAsItem)}
            </div>
          </div>
        </div>
      );
    }

    if (cardType === 'blog' && interspersePool.blogs.length > 0) {
      const item = interspersePool.blogs[poolIndex % interspersePool.blogs.length];
      
      return (
        <a 
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          key={key}
          onClick={(e) => handleItemClick(e, item)}
          className={`${spanClass} group relative overflow-hidden flex flex-col rounded-2xl border transition-all hover:-translate-y-1 cursor-pointer ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'}`}
        >
          <div className={`relative ${imageHeight} w-full overflow-hidden bg-gray-100 dark:bg-neutral-800 glanz-image-container`}>
            {(() => {
              const blogImg = item.imageUrl || "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop";
              return (
                <img loading="lazy" 
                  src={proxyImageUrl(blogImg)} 
                  alt={item.title} 
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                  referrerPolicy="no-referrer"
                />
              );
            })()}
            
            <div className="absolute top-4 left-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white bg-yellow-600 px-3 py-1.5 rounded-full backdrop-blur-md z-20">
              {item.authorId ? (
                <AuthorAvatar 
                  userId={item.authorId} 
                  fallbackFavicon={item.faviconUrl} 
                  className="w-4 h-4 rounded-full border border-white/20" 
                />
              ) : item.faviconUrl ? (
                <img loading="lazy" src={proxyImageUrl(item.faviconUrl)} alt="" className="w-4 h-4 rounded-full object-cover border border-white/20" referrerPolicy="no-referrer" />
              ) : (
                <FileText className="w-3.5 h-3.5" />
              )}
              BLOG
            </div>
          </div>

          <div className="p-6 flex flex-col flex-1 gap-3">
            <div className="flex justify-between items-center text-xs opacity-70">
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.authorId) {
                    navigate(`/blogs/author/${item.authorId}`, { state: { internal: true } });
                  } else if (item.feedId) {
                    setSelectedChannelId(item.feedId);
                  }
                }}
                className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 cursor-pointer hover:underline"
              >
                {item.authorId ? (
                  <AuthorAvatar 
                    userId={item.authorId} 
                    fallbackFavicon={item.faviconUrl} 
                    className="w-6 h-6 rounded-full border border-yellow-500/20" 
                  />
                ) : item.faviconUrl ? (
                  <img loading="lazy" 
                    src={proxyImageUrl(item.faviconUrl)} 
                    alt="" 
                    className="w-6 h-6 rounded object-cover" 
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <FileText className="w-5 h-5" />
                )}
                <span className="truncate max-w-[150px]">{item.feedTitle}</span>
              </div>
              <span>{formatDate(item.pubDate)}</span>
            </div>

            <h3 className={`font-bold leading-tight mb-3 ${span === 8 ? 'text-2xl md:text-3xl' : 'text-xl'} ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors line-clamp-3`}>
              {item.title}
            </h3>
            {item.contentSnippet && (
              <p className={`text-sm opacity-80 flex-1 ${span === 8 ? 'md:line-clamp-3 md:text-base' : 'line-clamp-2'}`}>
                {item.contentSnippet}
              </p>
            )}
            <div className={!item.contentSnippet ? 'mt-auto' : 'mt-2'}>
              {renderActions(item)}
            </div>
          </div>
        </a>
      );
    }

    return null;
  };

  const renderMagazineSection = (items: RssItem[], sectionKey: string) => {
    const shouldIntersperse = !selectedChannelId && (type === 'rss' || type === 'all' || selectedCategory === 'Alle');
    
    if (!shouldIntersperse) {
      return items.map((item, index) => renderMagazineItem(item, `${sectionKey}-${index}`));
    }

    // Reset counts for the current render pass
    globalNewsCount = 0;
    lastRadioNewsCount = -999;
    let usedWebcamCount = 0;

    const cardsToRender: ({ type: 'news'; item: RssItem } | { type: string; poolIndex: number })[] = [];
    let itemIndex = 0;
    let intersperseCount = 0;

    const cardsSequence = ['podcast', 'radio', 'youtube'];

    const isValidCardType = (typeStr: string) => {
      if (typeStr === 'radio') {
        if (globalNewsCount - lastRadioNewsCount < 100) return false;
        return true;
      }
      if (typeStr === 'podcast') {
        return interspersePool.podcasts.length > 0;
      }
      if (typeStr === 'youtube') {
        return interspersePool.youtube.length > 0;
      }
      return false;
    };

    while (itemIndex < items.length) {
      // Chunk size alternates to look organic and flow beautiful
      const chunkSize = intersperseCount % 2 === 0 ? 3 : 4;
      for (let i = 0; i < chunkSize && itemIndex < items.length; i++) {
        cardsToRender.push({ type: 'news', item: items[itemIndex] });
        itemIndex++;
        globalNewsCount++;
      }

      if (itemIndex < items.length) {
        let cardType = cardsSequence[intersperseCount % cardsSequence.length];
        
        if (!isValidCardType(cardType)) {
          const alternatives = ['podcast', 'youtube', 'radio'];
          let foundAlternative = false;
          for (const alt of alternatives) {
            if (alt !== cardType && isValidCardType(alt)) {
              cardType = alt;
              foundAlternative = true;
              break;
            }
          }
          if (!foundAlternative) {
            intersperseCount++;
            continue;
          }
        }

        if (cardType === 'webcam') {
          cardsToRender.push({ type: 'webcam', poolIndex: usedWebcamCount });
          usedWebcamCount++;
        } else {
          cardsToRender.push({ type: cardType, poolIndex: intersperseCount });
          if (cardType === 'radio') {
            lastRadioNewsCount = globalNewsCount;
          }
        }
        intersperseCount++;
      }
    }

    // Helper to determine if a card is restricted (Radio, YouTube, Webcam, or Podcast)
    const isRestrictedCard = (c: { type: string; item?: RssItem }) => {
      if (c.type === 'radio' || c.type === 'youtube' || c.type === 'webcam' || c.type === 'podcast') {
        return true;
      }
      if (c.type === 'news' && c.item) {
        const isYoutube = c.item.link?.includes('youtube.com') || c.item.link?.includes('youtu.be');
        const isWebcam = c.item.category === 'WebCam';
        const isRadio = c.item.category === 'Radio';
        const isPodcast = !!(c.item.enclosure?.url && (c.item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || c.item.enclosure.url.toLowerCase().endsWith('.m4a') || c.item.enclosure.url.toLowerCase().endsWith('.mp3')));
        if (isYoutube || isWebcam || isRadio || isPodcast) {
          return true;
        }
      }
      return false;
    };

    // Now layout dynamically to sum up to multiples of 12 (to guarantee no gaps!)
    let currentLineSpan = 0;
    const rendered: React.ReactNode[] = [];

    cardsToRender.forEach((card, idx) => {
      let span = 4; // default span is 4 columns

      // Only news cards are allowed to be large (span 8), and only if we are at the start of a row (currentLineSpan === 0)
      // and only if this is not the last item in cardsToRender (to prevent an uneven ending)
      let canBeLarge = (currentLineSpan === 0) && (card.type === 'news') && (idx < cardsToRender.length - 1);
      
      // Rule: If the current card is restricted (Radio, YouTube, Webcam, Podcast), it must NEVER be large (span 8)
      if (canBeLarge && isRestrictedCard(card)) {
        canBeLarge = false;
      }

      // Rule: If the next card (sharing the row) is restricted (Radio, YouTube, Webcam, Podcast), the current card must NEVER be large (span 8)
      // so that they are never placed on the same row with a stretched/long card.
      if (canBeLarge && idx < cardsToRender.length - 1) {
        const nextCard = cardsToRender[idx + 1];
        if (nextCard && isRestrictedCard(nextCard)) {
          canBeLarge = false;
        }
      }

      // We make it large if it is eligible and we want a large card on this row (alternate rows to look super professional)
      const rowCount = Math.floor(rendered.length / 3);
      if (canBeLarge && (rowCount % 2 === 0)) {
        span = 8;
      }

      currentLineSpan += span;
      if (currentLineSpan >= 12) {
        currentLineSpan = 0; // complete the row and reset
      }

      if (card.type === 'news') {
        const newsCard = card as { type: 'news'; item: RssItem };
        rendered.push(renderMagazineItem(newsCard.item, `${sectionKey}-${idx}`, span));
      } else {
        const intCard = card as { type: string; poolIndex: number };
        rendered.push(renderIntersperseCard(intCard.type, `intersperse-${sectionKey}-${intCard.poolIndex}-${idx}`, intCard.poolIndex, span));
      }
    });

    return rendered;
  };

  const getSourceIcon = (item: RssItem) => {
    const isYoutube = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
    const isPodcast = item.enclosure?.url && item.enclosure.type?.startsWith('audio/');
    if (isYoutube) return <Youtube className="w-4 h-4 text-red-500" />;
    if (isPodcast) return <Headphones className="w-4 h-4 text-purple-500" />;
    return <Rss className="w-4 h-4 text-orange-500" />;
  };





  const renderListItem = (item: RssItem, index?: number) => {
    const isRead = !!readItemsDb[item.id];
    const isWebcamItem = type === 'webcams' || item.category === 'WebCam';
    const isRadioItem = type === 'radio' || item.category === 'Radio';
    const shouldShowReadState = isRead && !isWebcamItem && !isRadioItem;
    const hasImage = item.imageUrl && !failedImages[item.id];
    return (
      <a 
        href={item.link} 
        target="_blank" 
        rel="noopener noreferrer"
        onClick={(e) => handleItemClick(e, item)}
        key={`list-item-${item.id || item.link}-${index ?? 0}`} 
        className={`content-visibility-auto group relative overflow-hidden rounded-xl border transition-all duration-300 hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} p-5 flex items-center justify-between gap-5 ${shouldShowReadState ? 'opacity-50 saturate-[40%]' : ''}`}
      >
      <div className="flex gap-4 sm:gap-5 items-start flex-1 min-w-0">
        {hasImage ? (
          <div className="w-20 h-16 sm:w-32 sm:h-24 flex-shrink-0 rounded-lg overflow-hidden border border-white/10 relative glanz-image-container">
              <FadeInImage 
                src={proxyImageUrl(item.imageUrl)!} 
                alt={item.title} 
                priority={typeof index === 'number' && index < 6}
                fallbackFavicon={item.faviconUrl}
                feedTitle={item.feedTitle}
                className="w-full h-full object-cover" 
                referrerPolicy="no-referrer"
                onError={() => {
                  setFailedImages(prev => ({ ...prev, [item.id]: true }));
                }}
              />
             {item.language && (
                <div className="absolute top-1.5 left-1.5 z-10 bg-black/40 backdrop-blur-sm px-1 py-0.5 rounded text-[10px] flex items-center justify-center leading-none border border-white/10">
                  {item.language === 'en' ? '🇺🇸' : 
                   item.language === 'fr' ? '🇫🇷' : 
                   item.language === 'es' ? '🇪🇸' : 
                   item.language === 'it' ? '🇮🇹' : 
                   item.language === 'pt' ? '🇵🇹' : 
                  '🇩🇪'}
                </div>
             )}
             {item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')) && (
               <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white z-10 border border-white/20">
                 <Headphones className="w-3 h-3" />
               </div>
             )}
             {shouldShowReadState && (
               <div 
                 onClick={(e) => toggleItemReadStatus(item, e)}
                 className="absolute bottom-1 right-1 z-20 bg-black/75 hover:bg-neutral-850 active:scale-95 transition-all backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white border border-white/15 shadow-sm pointer-events-auto cursor-pointer select-none"
                 title={tr(settings.language, 'Mark as unseen', 'Als ungesehen markieren')}
               >
                 {tr(settings.language, 'Already seen', 'Bereits gesehen')}
               </div>
             )}
          </div>
        ) : (
           <div className="w-20 h-16 sm:w-32 sm:h-24 flex-shrink-0 bg-gray-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-gray-100 dark:border-white/5 relative flex items-center justify-center pointer-events-none select-none">
            {item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')) && (
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-black dark:text-white z-10">
                <Headphones className="w-3 h-3" />
              </div>
            )}
            {item.faviconUrl ? (
              <>
                <div 
                  className="absolute inset-[-20%] bg-cover bg-center blur-xl opacity-40 dark:opacity-20 pointer-events-none"
                  style={{ backgroundImage: `url(${item.faviconUrl})` }}
                />
                <img loading="lazy" src={proxyImageUrl(item.faviconUrl)} alt={item.feedTitle} className={`relative z-10 ${item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3')) ? 'w-auto h-full object-contain' : 'w-8 h-8 sm:w-10 sm:h-10 rounded-lg'}`} referrerPolicy="no-referrer" />
              </>
            ) : (
                <FileText className="w-6 h-6 sm:w-8 sm:h-8 opacity-20 relative z-10" />
            )}
            {shouldShowReadState && (
              <div 
                onClick={(e) => toggleItemReadStatus(item, e)}
                className="absolute bottom-1 right-1 z-20 bg-black/75 hover:bg-neutral-850 active:scale-95 transition-all backdrop-blur-sm px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-white border border-white/15 shadow-sm pointer-events-auto cursor-pointer select-none"
                title={tr(settings.language, 'Mark as unseen', 'Als ungesehen markieren')}
              >
                {tr(settings.language, 'Already seen', 'Bereits gesehen')}
              </div>
            )}
           </div>
        )}
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          <div className="flex justify-between items-center text-xs opacity-70">
            <div 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.authorId) {
                  navigate(`/blogs/author/${item.authorId}`, { state: { internal: true } });
                } else if (item.feedId) {
                  setSelectedChannelId(item.feedId);
                }
              }}
              className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${formatColors.text} cursor-pointer hover:underline`}
            >
              {item.authorId ? (
                <AuthorAvatar 
                  userId={item.authorId} 
                  fallbackFavicon={item.faviconUrl} 
                  className="w-6 h-6 rounded-full border border-yellow-500/20" 
                />
              ) : item.faviconUrl ? (
                <img loading="lazy" 
                  src={proxyImageUrl(item.faviconUrl)} 
                  alt="" 
                  className="w-6 h-6 rounded object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              <span className="truncate max-w-[120px]">{item.feedTitle}</span>
            </div>
            <span className="whitespace-nowrap hidden sm:block">{formatDateTime(item.pubDate)}</span>
          </div>
          <h3 className={`text-lg font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors truncate`}>
            {item.title}
          </h3>
          {item.contentSnippet && (
            <p className="text-sm opacity-70 line-clamp-2 mt-1">
              {item.contentSnippet}
            </p>
          )}
          <span className="whitespace-nowrap sm:hidden text-xs opacity-70 mt-1">
            {formatDateTime(item.pubDate) || 'Aktuell'}
          </span>
        </div>
      </div>
      <div className="hidden md:flex flex-shrink-0 flex-col gap-2 border-l pl-5 justify-center items-center h-full border-gray-200 dark:border-white/10">
        {renderActions(item, 'column')}
      </div>
      <div className="md:hidden absolute bottom-4 right-4">
        {renderActions(item)}
      </div>
    </a>
  );
};

  const isYoutubeMain = type === 'youtube' && !selectedChannelId;
  const isWebcamsMain = type === 'webcams' && !selectedChannelId;
  const isPodcastMain = type === 'podcasts' && !selectedChannelId;
  const isBlogsMain = type === 'blogs' && !selectedChannelId;
  const selectedChannel = selectedChannelId ? feeds.find(f => f.id === selectedChannelId) : null;
  const selectedChannelPublicSource = selectedChannel ? publicSources.find(p => p.url === selectedChannel.url) : null;
  const effectiveBannerUrl = selectedChannel?.bannerUrl || (selectedChannelPublicSource as any)?.bannerUrl;
  const selectedChannelRealImageUrl = getFeedImageUrl(selectedChannel, selectedChannelPublicSource);
  const hasAppBanner = selectedChannel ? (!!effectiveBannerUrl || !!selectedChannelRealImageUrl) : false;

  const colorConfig: Record<string, { gradient: string, glowColor: string, textColorClass: string, textHex: string, glowBg: string, loaderGif: string }> = {
    rss: {
      gradient: 'from-orange-500 to-amber-500',
      glowColor: 'rgba(249,115,22,0.5)',
      textColorClass: 'text-orange-500',
      textHex: '#FF4500',
      glowBg: 'bg-orange-500/15',
      loaderGif: '/Loader_RSS.gif'
    },
    feeds: {
      gradient: 'from-orange-500 to-amber-500',
      glowColor: 'rgba(249,115,22,0.5)',
      textColorClass: 'text-orange-500',
      textHex: '#FF4500',
      glowBg: 'bg-orange-500/15',
      loaderGif: '/Loader_RSS.gif'
    },
    all: {
      gradient: 'from-orange-500 to-amber-500',
      glowColor: 'rgba(249,115,22,0.5)',
      textColorClass: 'text-orange-500',
      textHex: '#FF4500',
      glowBg: 'bg-orange-500/15',
      loaderGif: '/Loader_RSS.gif'
    },
    podcasts: {
      gradient: 'from-purple-600 to-fuchsia-500',
      glowColor: 'rgba(147,51,234,0.5)',
      textColorClass: 'text-purple-500',
      textHex: '#a855f7',
      glowBg: 'bg-purple-500/15',
      loaderGif: '/Loader_Podcast.gif'
    },
    podcast: {
      gradient: 'from-purple-600 to-fuchsia-500',
      glowColor: 'rgba(147,51,234,0.5)',
      textColorClass: 'text-purple-500',
      textHex: '#a855f7',
      glowBg: 'bg-purple-500/15',
      loaderGif: '/Loader_Podcast.gif'
    },
    radio: {
      gradient: 'from-blue-600 to-cyan-500',
      glowColor: 'rgba(37,99,235,0.5)',
      textColorClass: 'text-blue-500',
      textHex: '#3b82f6',
      glowBg: 'bg-blue-500/15',
      loaderGif: '/Loader_Radio.gif'
    },
    youtube: {
      gradient: 'from-red-600 to-rose-500',
      glowColor: 'rgba(220,38,38,0.5)',
      textColorClass: 'text-red-500',
      textHex: '#dc2626',
      glowBg: 'bg-red-500/15',
      loaderGif: '/Loader_YouTube.gif'
    },
    webcams: {
      gradient: 'from-emerald-500 to-green-400',
      glowColor: 'rgba(16,185,129,0.5)',
      textColorClass: 'text-emerald-500',
      textHex: '#10b981',
      glowBg: 'bg-emerald-500/15',
      loaderGif: '/Loader_WebCam.gif'
    },
    webcam: {
      gradient: 'from-emerald-500 to-green-400',
      glowColor: 'rgba(16,185,129,0.5)',
      textColorClass: 'text-emerald-500',
      textHex: '#10b981',
      glowBg: 'bg-emerald-500/15',
      loaderGif: '/Loader_WebCam.gif'
    },
    blogs: {
      gradient: 'from-amber-400 to-yellow-500',
      glowColor: 'rgba(245,158,11,0.5)',
      textColorClass: 'text-amber-500',
      textHex: '#d97706',
      glowBg: 'bg-amber-500/15',
      loaderGif: '/Loader_Blog.gif'
    },
    blog: {
      gradient: 'from-amber-400 to-yellow-500',
      glowColor: 'rgba(245,158,11,0.5)',
      textColorClass: 'text-amber-500',
      textHex: '#d97706',
      glowBg: 'bg-amber-500/15',
      loaderGif: '/Loader_Blog.gif'
    }
  };

  const formatColor = colorConfig[type] || colorConfig.rss;

  return (
    <div className="max-w-[2400px] mx-auto h-full flex flex-col relative">
      {/* Non-blocking top synchronization progress bar */}
      <AnimatePresence>
        {isSyncing && (
          <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-transparent overflow-hidden pointer-events-none">
            <motion.div 
              className={`h-full bg-gradient-to-r ${formatColor.gradient}`}
              style={{ boxShadow: `0 0 10px ${formatColor.glowColor}` }}
              initial={{ width: '5%' }}
              animate={{ width: `${Math.max(8, syncProgress)}%` }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Floating non-blocking sync status pill */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-5 right-5 z-[90] flex items-center gap-3 px-3.5 py-2 rounded-full shadow-xl border backdrop-blur-md text-xs font-semibold select-none ${
              isDark ? 'bg-neutral-900/90 text-white border-white/15' : 'bg-white/95 text-gray-900 border-gray-200'
            }`}
          >
            <div className="w-2 h-2 rounded-full animate-ping bg-amber-400 shrink-0" />
            <span>
              {syncProgress === 100 
                ? (isEn ? 'Finishing up...' : 'Wird abgeschlossen...') 
                : (isEn ? `Syncing feeds (${syncProgress}%)...` : `Feeds werden synchronisiert (${syncProgress}%)...`)}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`flex-1 flex flex-col bg-white dark:bg-[#0a0a0a] ${readingArticle ? 'flex' : 'hidden'}`}>
        {readingArticle && (
          <>
            <div className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-white/10 sticky top-0 z-50 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md">
              <button 
                onClick={() => setReadingArticle(null)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-colors font-medium text-sm ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}
              >
                <ArrowLeft className="w-4 h-4" />
                {t('back') || 'Zurück'}
              </button>
              <div className="flex-1 font-bold truncate opacity-80">{readingArticle.title}</div>
              <a 
                href={readingArticle.link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (isInternalBlogLink(readingArticle.link)) {
                    e.preventDefault();
                    setReadingArticle(null);
                    navigate(getInternalBlogPath(readingArticle.link));
                  }
                }}
                className="text-sm px-4 py-2 rounded-full bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                {t('read-original') || 'Im Original lesen'}
              </a>
            </div>
            <div className="flex-1 w-full bg-gray-50 dark:bg-black/50 relative">
               {window.innerWidth >= 768 ? (
                 <iframe 
                   src={`/api/proxy?url=${encodeURIComponent(readingArticle.link)}`}
                   className="absolute inset-0 w-full h-full border-0 bg-white" 
                   sandbox="allow-same-origin allow-forms"
                   title={readingArticle.title}
                 />
               ) : (
                 <div className="absolute inset-0 overflow-y-auto p-6 md:p-12 bg-white dark:bg-[#0a0a0a]">
                   <article 
                     className={`prose prose-sm max-w-none w-full
                       ${isDark ? 'prose-invert hover:prose-a:text-white prose-a:text-white/80' : 'prose-gray prose-a:text-blue-600'}
                       prose-img:rounded-xl
                       prose-headings:font-heading prose-headings:tracking-tight
                       prose-a:no-underline hover:prose-a:underline break-words
                     `}
                     dangerouslySetInnerHTML={{ __html: normalizeLinks(readingArticle.content || readingArticle.contentSnippet || 'Kein Inhalt verfügbar.') }} onClick={(e) => handleInternalLinkClick(e, navigate)}
                   />
                 </div>
               )}
            </div>
          </>
        )}
      </div>
      <div className={`flex-1 flex flex-col ${readingArticle ? 'hidden' : 'flex'}`}>
      {selectedChannel ? (
        <div className="relative overflow-hidden border border-gray-200 dark:border-white/10 mb-6 bg-white dark:bg-neutral-900 group mx-4 md:mx-8 mt-4 md:mt-8 rounded-3xl">
           <button 
             onClick={() => setSelectedChannelId(null)}
             className="absolute top-4 left-4 z-20 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md border border-white/10 transition-all opacity-100"
             title="Zurück zur Übersicht"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
           <button 
             onClick={() => handleMarkAllAsRead(selectedChannel.id)}
             className="absolute top-4 right-4 z-20 flex justify-center items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-black/60 hover:bg-black/80 rounded-full text-white backdrop-blur-md border border-white/10 transition-all opacity-100 text-xs md:text-sm font-semibold"
             title={type === 'podcasts' ? 'Alles als gehört markieren' : type === 'youtube' ? 'Alles als gesehen markieren' : 'Alles als gelesen markieren'}
           >
             <CheckCheck className="w-4 h-4" />
             {type === 'podcasts' ? 'Alles als gehört' : type === 'youtube' ? 'Alles als gesehen' : 'Alles als gelesen'}
           </button>
           {effectiveBannerUrl ? (
             <div className="w-full h-40 md:h-56 object-cover bg-gray-100 dark:bg-neutral-800">
               <img loading="lazy" src={proxyImageUrl(effectiveBannerUrl)} alt="banner" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             </div>
           ) : selectedChannelRealImageUrl ? (
             <div className="w-full h-40 md:h-56 overflow-hidden bg-gray-100 dark:bg-neutral-800 relative select-none pointer-events-none">
                <div 
                  className="absolute inset-[-20%] bg-cover bg-center blur-xl opacity-70"
                  style={{ backgroundImage: `url(${selectedChannelRealImageUrl})` }}
                />
                <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
             </div>
           ) : null}
           <div className={`px-4 md:px-8 flex flex-col md:flex-row md:items-end gap-x-6 gap-y-4 ${hasAppBanner ? 'pt-4' : 'pt-6'} pb-6`}>
             <div className={`flex-shrink-0 ${hasAppBanner ? '-mt-16 md:-mt-20 relative z-10' : ''}`}>
               {selectedChannelRealImageUrl ? (
                 <img loading="lazy" src={proxyImageUrl(selectedChannelRealImageUrl)} className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white dark:border-[#0a0a0a] bg-white dark:bg-[#0a0a0a] object-cover" alt="" referrerPolicy="no-referrer" />
               ) : (
                 <div className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white dark:border-[#0a0a0a] bg-blue-100 flex items-center justify-center text-blue-500 text-3xl md:text-4xl font-bold">
                    {selectedChannel.title.charAt(0).toUpperCase()}
                 </div>
               )}
             </div>
             <div className="flex-1 mt-2 md:mt-0 relative z-10 md:mb-1">
               <h2 className="text-3xl md:text-4xl font-extrabold pb-1">{selectedChannel.title}</h2>
             </div>
           </div>
        </div>
      ) : (!selectedChannelId && type !== 'webcams') && (
        <>
          <div 
            style={{
              transform: showHeader2 ? 'translateY(0)' : 'translateY(-100%)',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
              transitionDelay: showHeader2 ? '150ms' : '0ms',
              pointerEvents: showHeader2 ? 'auto' : 'none',
              opacity: showHeader2 ? 1 : 0
            }}
            className="sticky top-0 z-50 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-gray-200 dark:border-white/10 pt-4 pb-4 px-4 md:px-8 mb-6"
          >
          <div className="flex justify-between items-center overflow-x-auto hide-scrollbar gap-2 pb-4">
            <div className="flex overflow-x-auto hide-scrollbar gap-2">
              {categories.map(category => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    selectedCategory === category
                     ? (isDark ? formatColors.tabActiveBgDark : formatColors.tabActiveBgLight)
                     : (isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  {(category === 'Später lesen' || category === 'Später hören' || category === 'Später sehen') && <Bookmark className="w-4 h-4" />}
                  {category === 'Favoriten' && <Star className="w-4 h-4" />}
                  {t('cat-' + category, category)} {category === "Alle" ? `(${feedItems.length})` : ''}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pr-2">
              <button
                onClick={triggerManualSync}
                disabled={isSyncing || loadingFeeds || loadingItems || feeds.length === 0}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                  isDark 
                    ? 'bg-neutral-900 border-white/10 text-white hover:bg-neutral-800 disabled:opacity-50' 
                    : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50'
                }`}
                title={isEn ? 'Synchronize feeds now' : 'Feeds jetzt synchronisieren'}
              >
                <div className={`w-4 h-4 flex items-center justify-center ${isSyncing ? 'animate-spin' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-rotate-cw"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
                </div>
                <span className="hidden sm:inline">{isEn ? 'Sync' : 'Synchronisieren'}</span>
              </button>
            </div>
          </div>
        </div>
      </>
      )}

      <div className={`px-4 md:px-8 pb-8 space-y-6 ${(!(isYoutubeMain || isPodcastMain || isWebcamsMain) && !selectedChannel) ? 'pt-2' : 'pt-6 md:pt-8'}`}>
        {/* Top Aktuell highlights panel */}
        {stableTrendingItems.length > 0 && settings.showTopAktuell !== false && !selectedCategory.startsWith("Favoriten") && !selectedCategory.startsWith("Später") && (() => {
          const activeIndex = slideshowIndex % stableTrendingItems.length;
          const currentItem = stableTrendingItems[activeIndex];
          const voteCount = getVotesCount(currentItem);
          const userVote = getVotedByUser(currentItem);
          const rank = activeIndex + 1;
          
          // Dynamic classes for slideshow image size & aspect ratio based on type
          let imageSizeClass = "w-64 h-48 sm:w-80 sm:h-56 md:w-[420px] md:h-[300px] rounded-3xl shrink-0 shadow-lg";
          if (type === 'podcasts') {
            imageSizeClass = "w-56 h-56 sm:w-72 sm:h-72 md:w-[380px] md:h-[380px] rounded-3xl shrink-0 shadow-lg";
          } else if (type === 'youtube' || type === 'webcams' || type === 'blogs') {
            imageSizeClass = "w-72 aspect-video sm:w-96 md:w-[460px] lg:w-[500px] rounded-3xl shrink-0 shadow-lg";
          } else {
            imageSizeClass = "w-72 aspect-[3/2] sm:w-96 md:w-[440px] lg:w-[480px] rounded-3xl shrink-0 shadow-lg";
          }
          
          return (
            <div 
              className="w-full min-h-[340px] md:h-[380px] z-20"
            >
              {/* Active Article & Slideshow with blurred background - Full Width */}
              <div 
                className={`w-full h-full border border-gray-200/50 dark:border-white/5 bg-gradient-to-br ${formatColors.gradientFrom} via-transparent to-transparent dark:bg-neutral-900/40 p-5 md:p-6 rounded-2xl relative overflow-hidden shadow-sm flex flex-col justify-between z-20 min-h-0`}
              >
                {/* Solid backdrop layer to prevent background AmbientWave from shining through semi-transparent areas */}
                <div className="absolute inset-0 bg-white dark:bg-[#0a0a0a] z-[-1] rounded-2xl pointer-events-none" />

                {/* Slowly zooming blurred background - sync changes faster! */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                  <AnimatePresence mode="popLayout">
                    {currentItem.imageUrl ? (
                      <motion.img 
                        key={`top-aktuell-bg-${currentItem.id}`}
                        src={proxyImageUrl(currentItem.imageUrl)!} 
                        className="absolute inset-0 w-full h-full object-cover blur-3xl saturate-150" 
                        style={{ opacity: isDark ? 0.25 : 0.15 }}
                        alt="" 
                        referrerPolicy="no-referrer"
                        initial={{ scale: 1.15, opacity: 0 }}
                        animate={{ scale: 1.02, opacity: isDark ? 0.25 : 0.15 }}
                        exit={{ opacity: 0, scale: 1 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                      />
                    ) : (
                      <div className={`absolute inset-0 ${formatColors.fallbackBg} blur-[80px] rounded-full`} />
                    )}
                  </AnimatePresence>
                </div>

                {/* Overlapping, larger preview image positioned absolute on the right with custom zoom and a gradient fade-out to the left */}
                <AnimatePresence mode="wait">
                  {currentItem.imageUrl ? (
                    <motion.div 
                      key={`top-aktuell-preview-${currentItem.id}`}
                      className="absolute right-0 top-0 bottom-0 w-[42%] sm:w-[46%] md:w-[48%] lg:w-[50%] overflow-hidden z-0 pointer-events-none glanz-auto"
                      style={{
                        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.15) 15%, rgba(0, 0, 0, 0.85) 60%, rgba(0, 0, 0, 1) 100%)',
                        maskImage: 'linear-gradient(to right, transparent 0%, rgba(0, 0, 0, 0.15) 15%, rgba(0, 0, 0, 0.85) 60%, rgba(0, 0, 0, 1) 100%)',
                      }}
                      initial={{ x: 80, opacity: 0 }}
                      animate={{ 
                        x: 0, 
                        opacity: isDark ? 0.85 : 0.95, 
                        transition: {
                          x: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
                          opacity: { duration: 0.8 }
                        }
                      }}
                      exit={{ 
                        x: -100,
                        opacity: 0, 
                        transition: {
                          x: { duration: 0.8, ease: [0.7, 0, 0.84, 0] },
                          opacity: { duration: 0.8 }
                        }
                      }}
                    >
                      <motion.img 
                        src={proxyImageUrl(currentItem.imageUrl)!} 
                        alt="" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer"
                        initial={{ scale: 1.0 }}
                        animate={{ scale: 1.15 }}
                        transition={{ duration: 7, ease: "linear" }}
                      />
                      {/* Smooth gradient overlay so the text remains highly readable over the image */}
                      <div className={`absolute inset-0 bg-gradient-to-r ${isDark ? 'from-neutral-950 via-neutral-950/40 to-transparent' : 'from-white via-white/40 to-transparent'} z-10`} />
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                {/* Left Column Content: Active Article with slide controls */}
                <div className="w-full flex-1 flex flex-col justify-between relative z-10 min-w-0">
                  {/* Header */}
                  <div className="flex flex-col gap-2 pb-2">
                    <div className="flex items-center justify-between gap-4">
                      <div 
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (currentItem.authorId) {
                            navigate(`/blogs/author/${currentItem.authorId}`, { state: { internal: true } });
                          } else if (currentItem.feedId) {
                            setSelectedChannelId(currentItem.feedId);
                          }
                        }}
                        className={`flex items-center gap-3 ${(currentItem.authorId || currentItem.feedId) ? 'cursor-pointer group/author' : ''}`}
                      >
                        {/* Animated Favicon: Doubled in size, slides left-to-right on enter, and leftwards on exit */}
                        <div className="relative w-12 h-12 flex items-center justify-center shrink-0 overflow-hidden bg-transparent shadow-none border-none">
                          <AnimatePresence mode="wait">
                            <motion.div
                              key={`favicon-slide-${currentItem.id}`}
                              initial={{ scale: 0.5, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1, transition: { duration: 0.35, ease: "easeOut" } }}
                              exit={{ scale: 0.5, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }}
                              className="absolute inset-0 flex items-center justify-center p-1"
                            >
                              {type === 'blogs' && currentItem.authorId ? (
                                <AuthorAvatar 
                                  userId={currentItem.authorId} 
                                  fallbackFavicon={currentItem.faviconUrl} 
                                  className="w-10 h-10 rounded-full border border-yellow-500/20" 
                                />
                              ) : currentItem.faviconUrl ? (
                                <img loading="lazy" src={proxyImageUrl(currentItem.faviconUrl)} alt="" className="w-10 h-10 rounded-lg object-cover bg-transparent" referrerPolicy="no-referrer" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 font-bold text-sm">
                                  {currentItem.feedTitle?.charAt(0).toUpperCase()}
                                </div>
                              )}
                            </motion.div>
                          </AnimatePresence>
                        </div>

                        {/* Header title/meta info in 2-line structure */}
                        <div className="flex flex-col justify-center text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider truncate max-w-[260px] sm:max-w-[400px] md:max-w-[600px]">
                          <span className={`truncate text-gray-800 dark:text-neutral-200 font-extrabold text-[13px] normal-case tracking-normal ${(currentItem.authorId || currentItem.feedId) ? 'group-hover/author:underline' : ''}`}>{currentItem.feedTitle}</span>
                          <span className="opacity-65 font-medium mt-0.5">
                            {formatTime(currentItem.pubDate)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Decorative elegant short divider line */}
                    <div className="h-[1px] w-32 bg-gray-200/40 dark:bg-white/10" />
                  </div>

                  {/* Content Segment with custom deceleration (entering) and slow-start acceleration (leaving) animations */}
                  <div className="w-full flex-1 flex items-center min-w-0 py-1 overflow-hidden min-h-0 relative h-full">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`top-aktuell-slide-${currentItem.id}-${rank}`}
                        className="w-full h-full flex items-center min-w-0"
                        initial="initial"
                        animate="animate"
                        exit="exit"
                      >
                        {/* Text content overlapping the image (plenty of room to breathe and read everything) */}
                        <motion.div 
                          className={`w-full ${currentItem.imageUrl ? 'max-w-full sm:max-w-[68%] md:max-w-[72%] lg:max-w-[75%]' : 'max-w-full'} flex flex-col justify-center relative z-10 pl-1 pr-3 sm:pr-6`}
                          variants={{
                            initial: { y: -60, opacity: 0 },
                            animate: { 
                              y: 0, 
                              opacity: 1,
                              transition: {
                                y: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
                                opacity: { duration: 0.8 }
                              }
                            },
                            exit: { 
                              y: 100,
                              opacity: 0, 
                              transition: {
                                y: { duration: 0.8, ease: [0.7, 0, 0.84, 0] },
                                opacity: { duration: 0.8 }
                              }
                            }
                          }}
                        >
                          <a 
                            href={currentItem.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleItemClick(e, currentItem)}
                            className={`block font-extrabold text-lg sm:text-xl md:text-2xl lg:text-[26px] leading-snug tracking-tight ${formatColors.hoverText} text-gray-900 dark:text-neutral-100 line-clamp-2 md:line-clamp-3 transition-colors mb-2.5`}
                          >
                            {currentItem.title}
                          </a>
                          {currentItem.contentSnippet && (
                            <p className="text-xs sm:text-sm md:text-[15px] lg:text-base leading-relaxed text-gray-700 dark:text-neutral-300 line-clamp-3 md:line-clamp-4">
                              {currentItem.contentSnippet}
                            </p>
                          )}
                        </motion.div>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  {/* Footer bar with controls, slide indicator pills, and optional vote action */}
                  <div className="flex items-center justify-between pt-2 gap-4 flex-wrap">
                    <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase tracking-wider opacity-90 ${formatColors.text}`}>
                          {t('top-aktuell') || 'Top Aktuell'}
                        </span>
                        <span className="text-[11px] font-mono text-gray-400 dark:text-neutral-400 font-bold ml-1">
                          {rank} / {stableTrendingItems.length}
                        </span>
                      </div>

                      {/* Carousel navigation controls (prev & next only, transparent without pill background) */}
                      <div className="flex items-center gap-0.5">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSlideshowIndex((prev) => (prev - 1 + stableTrendingItems.length) % stableTrendingItems.length);
                          }}
                          className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                          title={settings.language === 'en' ? "Previous slide" : "Vorheriger Beitrag"}
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSlideshowIndex((prev) => (prev + 1) % stableTrendingItems.length);
                          }}
                          className="p-1 rounded-md text-gray-500 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white transition-colors"
                          title={settings.language === 'en' ? "Next slide" : "Nächster Beitrag"}
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Direct slide indicator pills */}
                      <div className="hidden sm:flex items-center gap-1.5">
                        {stableTrendingItems.slice(0, 10).map((_, idx) => (
                          <button
                            key={`slide-pill-${idx}`}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSlideshowIndex(idx);
                            }}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === activeIndex
                                ? 'w-6 bg-orange-500'
                                : 'w-1.5 bg-gray-300 dark:bg-white/20 hover:bg-gray-400 dark:hover:bg-white/40'
                            }`}
                            title={`#${idx + 1}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Compact Vote actions inside active slide */}
                    {settings.showVoting && (
                      <div 
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        className="flex items-center gap-2 bg-white/70 dark:bg-neutral-900/80 border border-gray-200/50 dark:border-white/5 rounded-full px-2.5 py-0.5 select-none shrink-0"
                      >
                        <button
                          onClick={(e) => castVote(e, currentItem, 'up')}
                          className={`p-0.5 rounded transition-all hover:bg-emerald-500/10 ${userVote === 'up' ? 'text-emerald-500 scale-110' : 'text-gray-400 hover:text-emerald-500'}`}
                          title="Upvote (+1)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
                        </button>
                        
                        <span className={`text-[10px] font-black font-mono leading-none min-w-[14px] text-center ${
                          voteCount > 0 
                            ? 'text-emerald-500' 
                            : voteCount < 0 
                              ? 'text-red-500' 
                              : 'text-gray-500 dark:text-gray-400 opacity-80'
                        }`}>
                          {voteCount > 0 ? `+${voteCount}` : voteCount}
                        </span>
                        
                        <button
                          onClick={(e) => castVote(e, currentItem, 'down')}
                          className={`p-0.5 rounded transition-all hover:bg-red-500/10 ${userVote === 'down' ? 'text-red-500 scale-110' : 'text-gray-400 hover:text-red-500'}`}
                          title="Downvote (-1)"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {(loadingFeeds || (loadingItems && feedItems.length === 0 && !(isYoutubeMain || isPodcastMain || isWebcamsMain))) ? (
          <div className={
            viewMode === 'grid' ? `grid ${type === 'podcasts' ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(280px,1fr))]'} gap-6` :
            viewMode === 'magazine' ? "grid grid-cols-12 gap-6" :
            "grid grid-cols-1 gap-4 w-full"
          }>
            {[...Array(viewMode === 'list' ? 6 : 8)].map((_, i) => {
              if (viewMode === 'magazine') {
                const isLarge = i % 10 === 0 || i % 10 === 6;
                const span = isLarge ? 'col-span-12 md:col-span-8' : 'col-span-12 md:col-span-4';
                return (
                  <div key={i} className={`${span} rounded-2xl flex flex-col overflow-hidden border ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'}`}>
                    <div className={`${isLarge ? 'h-64 md:h-80' : 'aspect-video'} w-full relative overflow-hidden bg-gray-100 dark:bg-neutral-800`}>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col gap-4">
                       <div className="h-6 bg-gray-200 dark:bg-neutral-800 rounded-md w-3/4 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                       <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded-md w-full relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                       <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded-md w-5/6 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                    </div>
                  </div>
                );
              }
              
              if (viewMode === 'list') {
                return (
                  <div key={i} className={`p-5 rounded-xl border flex gap-5 ${isDark ? 'border-white/10 bg-neutral-800' : 'border-gray-200 bg-white'}`}>
                    <div className="hidden sm:block w-32 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-neutral-900 relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                    </div>
                    <div className="flex-1 flex flex-col gap-3">
                      <div className="h-3 w-24 bg-gray-200 dark:bg-neutral-900 rounded relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                      <div className="h-5 bg-gray-200 dark:bg-neutral-900 rounded w-full relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                      <div className="h-4 bg-gray-200 dark:bg-neutral-900 rounded w-2/3 relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                    </div>
                  </div>
                );
              }

              // grid mode
              return (
                <div key={i} className={`rounded-xl border flex flex-col overflow-hidden ${isDark ? 'border-white/10 bg-neutral-800' : 'border-gray-200 bg-white'}`}>
                  <div className="aspect-video w-full bg-gray-100 dark:bg-neutral-900 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" />
                  </div>
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div className="h-3 w-1/3 bg-gray-200 dark:bg-neutral-900 rounded relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                    <div className="h-5 bg-gray-200 dark:bg-neutral-900 rounded w-full relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                    <div className="h-4 bg-gray-200 dark:bg-neutral-900 rounded w-3/4 mt-auto relative overflow-hidden"><div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]" /></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (isYoutubeMain || isPodcastMain || isWebcamsMain) ? (
          <div className="w-full mt-4 md:mt-8">
            {feeds.length === 0 ? (
              <div className={`flex flex-col items-center justify-center p-12 md:p-24 border border-dashed rounded-2xl ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {isPodcastMain ? (
                  <Headphones className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                ) : isYoutubeMain ? (
                  <Youtube className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                ) : (
                  <Camera className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                )}
                <h3 className="text-xl font-bold font-heading mb-2 opacity-80">
                  {isPodcastMain ? tr(settings.language, 'No podcasts', 'Keine Podcasts') :
                   isYoutubeMain ? tr(settings.language, 'No YouTube channels', 'Keine YouTube Kanäle') :
                   tr(settings.language, 'No webcams', 'Keine Webcams')}
                </h3>
                <p className={`text-center max-w-md ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {isPodcastMain ? (
                    settings.language === 'en' ? <>Add a podcast on the <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen Podcast hinzu, um ihn hier zu speichern.</>
                  ) : isYoutubeMain ? (
                    settings.language === 'en' ? <>Add a YouTube channel on the <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen YouTube Kanal hinzu, um ihn hier zu speichern.</>
                  ) : (
                    settings.language === 'en' ? <>Add a webcam on the <Link to="/discover/webcams" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/webcams" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> eine Webcam hinzu, um sie hier zu speichern.</>
                  )}
                </p>
              </div>
            ) : (() => {
              const filteredFeeds = feeds.filter(feed => {
                if (selectedCategory === "Alle") return true;
                if (selectedCategory === "Favoriten") return !!feed.isStarred;
                if (selectedCategory === "Später hören" || selectedCategory === "Später sehen" || selectedCategory === "Später lesen") return !!feed.isReadLater;
                return feed.category === selectedCategory;
              }).filter(feed => !searchQuery || feed.title?.toLowerCase().includes(searchQuery.toLowerCase()));

              return (
                <div className="space-y-12">
                  {/* Channels block */}
                  {filteredFeeds.length > 0 && (
                    <div className="space-y-6">
                      {selectedCategory !== "Alle" && (
                        <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {type === 'podcasts' ? (isEn ? 'Podcast Channels' : 'Podcast-Kanäle') :
                           type === 'youtube' ? (isEn ? 'YouTube Channels' : 'YouTube-Kanäle') :
                           (isEn ? 'Webcam Channels' : 'Webcam-Kanäle')}
                          {` (${filteredFeeds.length})`}
                        </h3>
                      )}
                      
                      <div className={`grid ${type === 'podcasts' ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'} gap-6`}>
                        {filteredFeeds.map((feed, index) => {
                          const hasNewVideos = feedItems.some(item => {
                            if (item.feedId !== feed.id) return false;
                            const pubTime = new Date(item.pubDate).getTime();
                            if (feed.lastReadAt && pubTime <= feed.lastReadAt) return false;
                            return (Date.now() - pubTime) < 30 * 24 * 60 * 60 * 1000;
                          });
                          const publicSource = publicSources.find(p => p.url === feed.url) as any;
                          let ytThumbnail = null;
                          if (feed.url) {
                            const match = feed.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                            if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
                          }
                          const finalImageUrl = getFeedImageUrl(feed, publicSource);
                          const displayBanner = isWebcamsMain && ytThumbnail ? ytThumbnail : (publicSource?.bannerUrl || feed.bannerUrl);

                          if (type === 'podcasts') {
                            return (
                              <div 
                                key={`podcast-channel-${feed.id || feed.url}-${index}`}
                                onClick={() => setSelectedChannelId(feed.id)}
                                className={`group relative overflow-hidden flex flex-col rounded-xl border transition-all hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer`}
                              >
                                <div className="aspect-square w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden select-none glanz-image-container">
                                  <Headphones className="w-12 h-12 opacity-20 relative z-10" />
                                  {finalImageUrl && (
                                    <img 
                                      src={proxyImageUrl(finalImageUrl)} 
                                      alt="" 
                                      loading="lazy"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 absolute inset-0 z-10" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  )}

                                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-20">
                                    <div className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white shadow-lg transform transition-transform scale-95 group-hover:scale-100">
                                      <Play className="w-6 h-6 ml-0.5 text-white" fill="currentColor" />
                                    </div>
                                  </div>

                                  {hasNewVideos && (
                                    <div className="absolute top-3 right-3 bg-purple-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-30 uppercase tracking-wide">
                                      {isEn ? 'NEW' : 'NEU'}
                                    </div>
                                  )}
                                </div>

                                <div className="p-5 flex flex-col flex-1 gap-3">
                                  <div className="flex justify-between items-center text-xs opacity-70">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#A855F7]">
                                      <Headphones className="w-3.5 h-3.5" />
                                      <span>{feed.category || 'Podcast'}</span>
                                    </div>
                                    {(feed as any).language && <span className="text-[10px] uppercase font-mono">{(feed as any).language}</span>}
                                  </div>

                                  <h3 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-purple-500 transition-colors line-clamp-2`}>
                                    {feed.title}
                                  </h3>

                                  <div className="mt-auto pt-2 flex flex-col gap-3 w-full">
                                    <button 
                                      onClick={(e) => { e.stopPropagation(); setSelectedChannelId(feed.id); }}
                                      className="w-full flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-purple-600 hover:bg-purple-500 text-white"
                                    >
                                      <span>{isEn ? 'TO THE EPISODES' : 'ZU DEN FOLGEN'}</span>
                                    </button>

                                    {renderFeedActions(feed)}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`feed-channel-${feed.id || feed.url}-${index}`}
                              onClick={() => {
                                  if (isWebcamsMain && feed.url) {
                                    const videoId = getOutputVideoId(feed.url);
                                    if (videoId) {
                                      setPlayingVideo({ id: videoId, title: feed.title, url: feed.url, isWebcam: true, webcamId: feed.id });
                                    }
                                  } else {
                                    setSelectedChannelId(feed.id);
                                  }
                              }}
                              className={`group flex flex-col rounded-3xl overflow-hidden transition-transform hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer relative text-left w-full`}
                            >
                              {isWebcamsMain ? (
                                <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20 flex items-center gap-1 shadow-md animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                                  <span>LIVE</span>
                                </div>
                              ) : hasNewVideos && (
                                <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20">
                                  {isEn ? (type === 'youtube' ? 'UNWATCHED' : 'NEW') : (type === 'youtube' ? 'UNGESEHEN' : 'NEU')}
                                </div>
                              )}
                              <div className="w-full h-24 bg-gray-100 dark:bg-neutral-800 relative overflow-hidden pointer-events-none select-none glanz-image-container">
                                {displayBanner ? (
                                  <img src={proxyImageUrl(displayBanner)} alt="banner" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : feed.isPodcast && finalImageUrl ? (
                                  <>
                                    <div 
                                      className="absolute inset-[-20%] bg-cover bg-center blur-lg opacity-70"
                                      style={{ backgroundImage: `url(${finalImageUrl})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40"></div>
                                )}
                              </div>
                              <div className="px-6 flex flex-col items-center -mt-10 relative z-10 w-full mb-6">
                                <div className="relative">
                                  {finalImageUrl || displayBanner ? (
                                    <img src={proxyImageUrl(finalImageUrl || displayBanner)} alt={feed.title} loading="lazy" className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-neutral-900 bg-white" referrerPolicy="no-referrer" />
                                  ) : (
                                     <div className="w-20 h-20 rounded-full border-4 border-white dark:border-neutral-900 bg-blue-100 flex items-center justify-center text-blue-500 text-3xl font-bold">
                                       {feed.title.charAt(0).toUpperCase()}
                                     </div>
                                  )}
                                </div>
                                <h3 className={`font-bold text-center line-clamp-1 w-full mt-3 ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors`} title={feed.title}>{feed.title}</h3>

                                <div className="w-full mt-2">
                                  {renderFeedActions(feed)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Episodes block */}
                  {(recentItems.length > 0 || midItems.length > 0 || olderItems.length > 0) && (
                    <div className="space-y-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                      <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCategory === "Favoriten" || selectedCategory === "Später hören" || selectedCategory === "Später sehen"
                          ? (type === 'podcasts' ? (isEn ? 'Saved Podcast Episodes' : 'Gespeicherte Podcast-Folgen') :
                             type === 'youtube' ? (isEn ? 'Saved Videos' : 'Gespeicherte Videos') :
                             (isEn ? 'Saved Webcams' : 'Gespeicherte Webcams'))
                          : (type === 'podcasts' ? (isEn ? 'Latest Podcast Episodes' : 'Neueste Podcast-Folgen') :
                             type === 'youtube' ? (isEn ? 'Latest Videos' : 'Neueste Videos') :
                             (isEn ? 'Webcams' : 'Webcams'))}
                        {` (${recentItems.length + midItems.length + olderItems.length})`}
                      </h3>

                      <div className="space-y-12">
                        {recentItems.length > 0 && (
                          <div className={
                            viewMode === 'magazine' ? "grid grid-cols-12 gap-6" :
                            viewMode === 'list' ? "flex flex-col gap-4 w-full" :
                            type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6"
                          }>
                            {(viewMode === 'grid' || viewMode === 'screensaver') && recentItems.map((item, idx) => renderGridItem(item, idx))}
                            {viewMode === 'magazine' && renderMagazineSection(recentItems, 'recent')}
                            {viewMode === 'list' && recentItems.map((item, idx) => renderListItem(item, idx))}
                          </div>
                        )}

                        {midItems.length > 0 && (
                          <div className="space-y-6">
                            <button 
                              onClick={() => setShowMidHistory(!showMidHistory)}
                              className="w-full flex items-center gap-4 group"
                            >
                              <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                              <span className="px-6 py-2 rounded-full border border-gray-200 dark:border-white/10 text-xs font-bold tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                                {tr(settings.language, "Older than 24h", "Älter als 24 Stunden")} ({midItems.length})
                              </span>
                              <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                            </button>

                            <AnimatePresence>
                              {showMidHistory && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                   <div className={
                                      viewMode === 'magazine' ? "grid grid-cols-12 gap-6 pb-4" :
                                      viewMode === 'list' ? "flex flex-col gap-4 w-full pb-4" :
                                      type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6 pb-4" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 pb-4"
                                    }>
                                      {(viewMode === 'grid' || viewMode === 'screensaver') && midItems.map((item, idx) => renderGridItem(item, idx))}
                                      {viewMode === 'magazine' && renderMagazineSection(midItems, 'mid')}
                                      {viewMode === 'list' && midItems.map((item, idx) => renderListItem(item, idx))}
                                   </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}

                        {olderItems.length > 0 && (
                          <div className="space-y-6">
                            <button 
                              onClick={() => setShowOlderHistory(!showOlderHistory)}
                              className="w-full flex items-center gap-4 group"
                            >
                              <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                              <span className="px-6 py-2 rounded-full border border-gray-200 dark:border-white/10 text-xs font-bold tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                                {tr(settings.language, "Older than 3 days", "Älter als 3 Tage")} ({olderItems.length})
                              </span>
                              <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                            </button>

                            <AnimatePresence>
                              {showOlderHistory && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: "auto" }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3 }}
                                  className="overflow-hidden"
                                >
                                   <div className={
                                      viewMode === 'magazine' ? "grid grid-cols-12 gap-6 pb-4" :
                                      viewMode === 'list' ? "flex flex-col gap-4 w-full pb-4" :
                                      type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6 pb-4" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 pb-4"
                                    }>
                                      {(viewMode === 'grid' || viewMode === 'screensaver') && olderItems.map((item, idx) => renderGridItem(item, idx))}
                                      {viewMode === 'magazine' && renderMagazineSection(olderItems, 'older')}
                                      {viewMode === 'list' && olderItems.map((item, idx) => renderListItem(item, idx))}
                                   </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empty state when absolutely nothing is favorited/saved in this view */}
                  {filteredFeeds.length === 0 && recentItems.length === 0 && midItems.length === 0 && olderItems.length === 0 && (
                    <div className="text-center p-20 border border-dashed rounded-2xl opacity-50 flex flex-col items-center gap-4 mt-8">
                      <FileText className="w-12 h-12 opacity-20" />
                      {tr(settings.language, 'No entries found in this category.', 'Keine Einträge in dieser Kategorie gefunden.')}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        ) : feeds.length === 0 ? (
          <div className="w-full max-w-4xl mx-auto py-8 sm:py-12 px-4">
            <div className={`p-8 sm:p-12 rounded-3xl border text-center relative overflow-hidden ${
              isDark ? 'bg-neutral-900/80 border-white/10 text-white' : 'bg-white/90 border-gray-200 text-gray-900'
            } shadow-xl backdrop-blur-md`}>
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold font-heading mb-3">
                {tr(settings.language, 'Welcome to RSSer!', 'Willkommen bei RSSer!')}
              </h2>
              <p className={`text-base sm:text-lg max-w-xl mx-auto mb-8 ${isDark ? 'text-white/70' : 'text-gray-600'}`}>
                {tr(
                  settings.language, 
                  'Your clean, algorithmic-free hub for news, podcasts, videos, and radio. Get started by exploring our curated catalog or running the quick interactive tour.',
                  'Dein sauberer, algorithmusfreier Feed für Nachrichten, Podcasts, Videos und Radio. Starte jetzt mit der interaktiven Tour oder füge beliebte Quellen mit einem Klick hinzu.'
                )}
              </p>

              <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('start-onboarding-tour'))}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm sm:text-base flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  {tr(settings.language, 'Start Onboarding Tour', 'Einführungstour starten')}
                </button>
                <Link
                  to={`/discover/${type === 'feeds' || type === 'rss' ? 'feeds' : type}`}
                  className={`px-6 py-3 rounded-xl border font-bold text-sm sm:text-base flex items-center gap-2 transition-all hover:scale-105 active:scale-95 ${
                    isDark ? 'border-white/20 bg-white/5 hover:bg-white/10 text-white' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-800'
                  }`}
                >
                  <Compass className="w-4 h-4" />
                  {tr(settings.language, 'Discover All Sources', 'Quellen entdecken')}
                </Link>
              </div>

              {/* Quick starter feeds */}
              <div className="border-t pt-8 mt-4 border-dashed border-gray-200 dark:border-white/10 text-left">
                <h3 className="text-sm font-bold uppercase tracking-wider opacity-60 mb-4 text-center">
                  {tr(settings.language, 'Popular Starter Sources (1-Click Add)', 'Beliebte Starter-Quellen (1-Klick)')}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {publicSources.filter(s => {
                    const matchType = (type === 'rss' || type === 'feeds') ? s.type === 'feeds' : s.type === type;
                    return matchType && s.language === (settings.language === 'en' ? 'en' : 'de');
                  }).slice(0, 6).map((starter, idx) => {
                    const isAdding = addingFeedUrl === starter.url;
                    return (
                      <div 
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                          isDark ? 'border-white/10 bg-neutral-800/60 hover:bg-neutral-800' : 'border-gray-200 bg-gray-50/80 hover:bg-white shadow-sm'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm truncate">{starter.title}</p>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-medium">
                            {starter.category}
                          </span>
                        </div>
                        <button
                          disabled={isAdding}
                          onClick={() => handleAddStarterFeed(starter)}
                          className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-95 text-white flex items-center justify-center shrink-0 transition-all shadow-sm"
                          title={tr(settings.language, 'Add to my feeds', 'Zu meinen Quellen hinzufügen')}
                        >
                          {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : recentItems.length === 0 && midItems.length === 0 && olderItems.length === 0 ? (
          <div className="text-center p-20 border border-dashed rounded-2xl opacity-50 flex flex-col items-center gap-4 mt-8">
            <FileText className="w-12 h-12 opacity-20" />
            {tr(settings.language, 'No entries found in this category.', 'Keine Einträge in dieser Kategorie gefunden.')}
          </div>
        ) : (
          <div className="space-y-12">
            {viewMode === 'screensaver' && (
              <ScreensaverContainer 
                items={[...recentItems, ...midItems, ...olderItems]} 
                settings={settings}
                handleItemClick={handleItemClick}
                setViewMode={setViewMode}
                setSelectedChannelId={setSelectedChannelId}
              />
            )}
            
            <div className="space-y-12">
              {/* Today / Last 24h */}
              {recentItems.length > 0 && (
                <div className={
                  viewMode === 'magazine' ? "grid grid-cols-12 gap-6" :
                  viewMode === 'list' ? "flex flex-col gap-4 w-full" :
                  type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6"
                }>
                  {(viewMode === 'grid' || viewMode === 'screensaver') && recentItems.map((item, idx) => renderGridItem(item, idx))}
                  {viewMode === 'magazine' && renderMagazineSection(recentItems, 'recent')}
                  {viewMode === 'list' && recentItems.map((item, idx) => renderListItem(item, idx))}
                </div>
              )}

              {/* Older than 24h (up to 3 days) */}
              {midItems.length > 0 && (
                <div className="space-y-6">
                  <button 
                    onClick={() => setShowMidHistory(!showMidHistory)}
                    className="w-full flex items-center gap-4 group"
                  >
                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                    <span className="px-6 py-2 rounded-full border border-gray-200 dark:border-white/10 text-xs font-bold tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                      {tr(settings.language, "Older than 24h", "Älter als 24 Stunden")} ({midItems.length})
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                  </button>

                  <AnimatePresence>
                    {showMidHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                         <div className={
                            viewMode === 'magazine' ? "grid grid-cols-12 gap-6 pb-4" :
                            viewMode === 'list' ? "flex flex-col gap-4 w-full pb-4" :
                            type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6 pb-4" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 pb-4"
                          }>
                            {(viewMode === 'grid' || viewMode === 'screensaver') && midItems.map((item, idx) => renderGridItem(item, idx))}
                            {viewMode === 'magazine' && renderMagazineSection(midItems, 'mid')}
                            {viewMode === 'list' && midItems.map((item, idx) => renderListItem(item, idx))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Older than 3 days (up to 5 days) */}
              {olderItems.length > 0 && (
                <div className="space-y-6">
                  <button 
                    onClick={() => setShowOldHistory(!showOldHistory)}
                    className="w-full flex items-center gap-4 group"
                  >
                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                    <span className="px-6 py-2 rounded-full border border-gray-200 dark:border-white/10 text-xs font-bold tracking-widest uppercase opacity-60 group-hover:opacity-100 transition-opacity">
                      {tr(settings.language, "Older than 3 days", "Älter als 3 Tage")} ({olderItems.length})
                    </span>
                    <div className="h-px flex-1 bg-gray-200 dark:bg-white/10" />
                  </button>

                  <AnimatePresence>
                    {showOldHistory && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                        className="overflow-hidden"
                      >
                         <div className={
                            viewMode === 'magazine' ? "grid grid-cols-12 gap-6 pb-4" :
                            viewMode === 'list' ? "flex flex-col gap-4 w-full pb-4" :
                            type === 'podcasts' ? "grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-6 pb-4" : "grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6 pb-4"
                          }>
                            {(viewMode === 'grid' || viewMode === 'screensaver') && olderItems.map((item, idx) => renderGridItem(item, idx))}
                            {viewMode === 'magazine' && renderMagazineSection(olderItems, 'older')}
                            {viewMode === 'list' && olderItems.map((item, idx) => renderListItem(item, idx))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
