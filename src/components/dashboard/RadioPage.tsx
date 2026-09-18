import { tr } from '../../lib/t';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useMedia } from '../../context/MediaContext';
import { useTranslation } from '../../hooks/useTranslation';
import { HeroBanner } from './HeroBanner';
import { Radio, Play, Square, Loader2, Bookmark, Star } from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot, query, deleteDoc, doc, updateDoc, setDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';

interface RadioStation {
  id: string;
  title: string;
  url: string;
  faviconUrl?: string;
  imageUrl?: string;
  category?: string;
  isStarred?: boolean;
  isReadLater?: boolean;
}

export function RadioPage() {
  const { settings, searchQuery, showHeader2 } = useSettings();
  const { playingAudio, setPlayingAudio, setPlayingVideo, setReadingArticle } = useMedia();
  const { t } = useTranslation();
  const isDark = settings.theme === 'dark';
  const isEn = settings.language === 'en';

  const [stations, setStations] = useState<RadioStation[]>([]);
  const [publicSources, setPublicSources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Alle");
  const [communityVotes, setCommunityVotes] = useState<Record<string, { votes: number, voters: Record<string, 'up' | 'down'> }>>({});

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
        console.warn("Could not subscribe to itemVotes in RadioPage.", err);
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
        category: 'Radio',
        type: 'radio',
        votes: newVotes,
        voters: newVoters,
        timestamp: Date.now(),
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error casting feed vote:", err);
    }
  };

  const toggleFeedSaved = async (e: React.MouseEvent, feed: any, field: 'isStarred' | 'isReadLater') => {
    e.preventDefault();
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    try {
      const ref = doc(db, 'users', auth.currentUser.uid, 'radioStations', feed.id);
      await updateDoc(ref, { [field]: !feed[field] });
    } catch (err) {
      console.error("Error toggling radio saved state:", err);
    }
  };

  const renderStationActions = (station: RadioStation) => {
    const isStarred = !!station.isStarred;
    const isReadLater = !!station.isReadLater;
    const bookmarkTitle = isEn ? 'Listen later' : 'Später hören';

    const voteCount = getFeedVotesCount(station.url);
    const userVote = getFeedVotedByUser(station.url); // 'up' | 'down' | null

    return (
      <div 
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
        className="flex items-center justify-between mt-auto pt-2 w-full border-t border-gray-100 dark:border-white/5"
      >
        <div className="flex items-center gap-0.5">
          <button 
            onClick={(e) => toggleFeedSaved(e, station, 'isReadLater')}
            className={`p-1.5 rounded-full transition-colors ${isReadLater ? 'text-[var(--brand-orange)] bg-[var(--brand-orange)]/10' : 'text-gray-400 hover:text-[var(--brand-orange)] hover:bg-[var(--brand-orange)]/10'}`}
            title={bookmarkTitle}
          >
            <Bookmark className="w-3.5 h-3.5" fill={isReadLater ? 'currentColor' : 'none'} />
          </button>
          <button 
            onClick={(e) => toggleFeedSaved(e, station, 'isStarred')}
            className={`p-1.5 rounded-full transition-colors ${isStarred ? 'text-yellow-500 bg-yellow-500/10' : 'text-gray-400 hover:text-yellow-500 hover:bg-yellow-500/10'}`}
            title={isEn ? 'Favorite' : 'Favorit'}
          >
            <Star className="w-3.5 h-3.5" fill={isStarred ? 'currentColor' : 'none'} />
          </button>
          
          {auth.currentUser && (
            <button
              onClick={(e) => handleDelete(e, station.id)}
              className="p-1.5 rounded-full transition-colors text-gray-400 hover:text-red-500 hover:bg-red-500/10"
              title={isEn ? "Remove station" : "Sender löschen"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>
            </button>
          )}
        </div>

        {/* Community Upvote/Downvote Buttons */}
        {settings.showVoting && (
          <div 
            className="flex items-center gap-0.5 bg-gray-100/80 dark:bg-neutral-950 border border-gray-200/50 dark:border-white/5 rounded-full px-1.5 py-0.5 select-none shrink-0"
          >
            <button
              onClick={(e) => castFeedVote(e, station.url, station.title, 'up')}
              className={`p-0.5 rounded-full transition-all flex items-center justify-center hover:bg-emerald-500/10 ${userVote === 'up' ? 'text-emerald-500 hover:text-emerald-600 scale-110' : 'text-gray-400 hover:text-emerald-500'}`}
              title="Upvote (+1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
            </button>
            
            <span className={`text-[9px] font-bold font-mono min-w-[12px] text-center ${
              voteCount > 0 
                ? 'text-emerald-500' 
                : voteCount < 0 
                  ? 'text-red-500' 
                  : 'opacity-80 text-gray-500 dark:text-gray-400'
            }`}>
              {voteCount > 0 ? `+${voteCount}` : voteCount}
            </span>
            
            <button
              onClick={(e) => castFeedVote(e, station.url, station.title, 'down')}
              className={`p-0.5 rounded-full transition-all flex items-center justify-center hover:bg-red-500/10 ${userVote === 'down' ? 'text-red-500 hover:text-red-600 scale-110' : 'text-gray-400 hover:text-red-500'}`}
              title="Downvote (-1)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
          </div>
        )}
      </div>
    );
  };

  useEffect(() => {
    document.title = `${tr(settings.language, "Web Radio", "Webradio")} | RSSer News`;
  }, [settings.language]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    
    // Fetch public sources from server API to save Firestore reads
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
        // Silently continue
      }
    };
    fetchSources();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribe) unsubscribe();

      if (user) {
        const ref = collection(db, 'users', user.uid, 'radioStations');
        unsubscribe = onSnapshot(query(ref), (snapshot) => {
          const loaded = snapshot.docs.map(d => ({
            id: d.id,
            ...d.data()
          } as RadioStation));
          setStations(loaded);
          setLoading(false);
        }, (error) => {
          handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/radioStations`);
        });
      } else {
        setStations([]);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'radioStations', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/radioStations/${id}`);
    }
  };

  const handlePlay = (station: RadioStation) => {
    if (playingAudio?.url === station.url) {
      setPlayingAudio(null);
      return;
    }
    setPlayingVideo(null);
    setReadingArticle(null);
    const domain = getRootDomain(station.url);
    const fallbackImage = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null;
    
    setPlayingAudio({
      title: station.title,
      url: station.url,
      feedTitle: station.category || 'Radio',
      imageUrl: station.imageUrl || station.faviconUrl || fallbackImage || ''
    });
  };

  const getRootDomain = (urlStr: string) => {
    try {
      const hostname = new URL(urlStr).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length > 2) {
        const secondToLast = parts[parts.length - 2];
        if (['co', 'com', 'org', 'net', 'gv', 'gov'].includes(secondToLast)) {
          return parts.slice(-3).join('.');
        }
      }
      return parts.slice(-2).join('.');
    } catch {
      return null;
    }
  };

  if (loading && stations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[300px]">
        <Loader2 className="w-8 h-8 animate-spin opacity-50" />
      </div>
    );
  }

  const categories = ["Alle", ...Array.from(new Set(stations.map(s => s.category || 'Radio'))).sort()];
  let filteredStations = selectedCategory === "Alle" ? stations : stations.filter(s => (s.category || 'Radio') === selectedCategory);
  
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filteredStations = filteredStations.filter(s => s.title?.toLowerCase().includes(q) || s.category?.toLowerCase().includes(q));
  }

  return (
    <div className="max-w-[2400px] mx-auto h-full flex flex-col relative pt-4">
      {categories.length > 1 && (
        <div 
          style={{
            transform: showHeader2 ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            transitionDelay: showHeader2 ? '150ms' : '0ms'
          }}
          className="sticky top-0 z-50 bg-white/90 dark:bg-[#0a0a0a]/90 backdrop-blur-md border-b border-gray-200 dark:border-white/10 pt-4 pb-4 px-4 md:px-8 mb-6"
        >
          <div className="flex justify-between items-center overflow-x-auto hide-scrollbar gap-2 pb-4">
            <div className="flex overflow-x-auto hide-scrollbar gap-2">
              {categories.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    selectedCategory === category
                      ? (isDark 
                          ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          : 'bg-blue-100 text-blue-700 border-blue-200')
                      : (isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100')
                  }`}
                >
                  <Radio className="w-4 h-4 text-blue-500" />
                  {t('cat-' + category, category)} {category === "Alle" ? `(${stations.length})` : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 md:px-8 pb-8">
        {filteredStations.length > 0 ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 md:gap-5">
            {filteredStations.map(station => {
              const isPlaying = playingAudio?.url === station.url;
              const domain = getRootDomain(station.url);
              const publicSource = publicSources.find(p => p.url === station.url) as any;
              const finalImageUrl = publicSource?.imageUrl || station.imageUrl || station.faviconUrl;
              const fallbackImage = finalImageUrl || (domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);

              return (
                <div 
                  key={station.id} 
                  className={`group relative overflow-hidden flex flex-col rounded-xl border transition-all hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/30 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer`}
                  onClick={() => handlePlay({...station, imageUrl: fallbackImage})}
                >
                  {/* aspect-square card image panel */}
                  <div className="aspect-square w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden select-none glanz-image-container">
                    {fallbackImage ? (
                      <img 
                        src={fallbackImage} 
                        alt="" 
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                          if (sibling) sibling.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div 
                      className="w-full h-full flex items-center justify-center text-blue-500 font-bold text-2xl uppercase bg-blue-500/10 dark:bg-blue-500/5 transition-transform duration-500 group-hover:scale-105 select-none"
                      style={{ display: fallbackImage ? 'none' : 'flex' }}
                    >
                      {station.title?.charAt(0).toUpperCase()}
                    </div>

                    {/* Play / pause hover overlay */}
                    <div className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 z-20 ${isPlaying ? 'opacity-100 bg-black/30' : ''}`}>
                      <div className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white shadow-lg transform transition-transform scale-95 group-hover:scale-100">
                        {isPlaying ? (
                          <Square className="w-4 h-4 text-white" fill="currentColor" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5 text-white" fill="currentColor" />
                        )}
                      </div>
                    </div>

                    {/* LIVE badge at the top right of aspect-square area */}
                    {isPlaying && (
                      <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-500 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider animate-pulse z-30">
                        <span className="w-1 h-1 bg-emerald-500 rounded-full"></span>
                        <span>LIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Info block styled exactly like RSS news card */}
                  <div className="p-3 flex flex-col flex-1 justify-between gap-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-center text-[10px] opacity-70">
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-blue-500 dark:text-blue-400">
                          <Radio className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                          <span className="truncate max-w-[70px]">{station.category || 'Radio'}</span>
                        </div>
                        <span className="text-[9px] opacity-50 font-mono truncate max-w-[60px]">{domain}</span>
                      </div>

                      <h3 className={`text-xs font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-blue-500 transition-colors line-clamp-2`} title={station.title}>
                        {station.title}
                      </h3>
                    </div>

                    {renderStationActions(station)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`flex flex-col items-center justify-center p-12 md:p-24 border border-dashed rounded-2xl ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
            <Radio className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
            <h3 className="text-xl font-bold font-heading mb-2 opacity-80">{tr(settings.language, 'No radio stations', 'Keine Radiosender')}</h3>
            <p className={`text-center max-w-md ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
              {tr(settings.language, 'Add a radio station on the Organize page to save it here in your library and listen to it.', 'Füge in der Organisieren-Seite einen Radiosender hinzu, um ihn hier in deiner Bibliothek zu speichern und anzuhören.')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
