
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { auth, db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { getCanonicalOrigin, handleInternalLinkClick } from '../../lib/utils';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { Loader2, ArrowLeft, User, Mail, Globe, Calendar, Bookmark, ExternalLink, Youtube, Instagram, Twitter, Rss, Check, Link as LinkIcon, Facebook, Github, Linkedin, Slack, UserPlus, UserCheck, ShieldAlert, Zap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { setDoc, deleteDoc } from 'firebase/firestore';
import { AppShell } from '../layout/AppShell';
import { AmbientWave } from '../layout/AmbientWave';
import { usePlan } from '../../hooks/usePlan';
import { LimitReachedModal } from './LimitReachedModal';

function getSocialIcon(url: string, isGrayscale = false) {
  if (!url) return <LinkIcon className="w-5 h-5" />;
  const lurl = url.toLowerCase();
  if (lurl.includes('youtube.com') || lurl.includes('youtu.be')) return <Youtube className={`w-5 h-5 ${isGrayscale ? '' : 'text-red-500'}`} />;
  if (lurl.includes('instagram.com')) return <Instagram className={`w-5 h-5 ${isGrayscale ? '' : 'text-pink-500'}`} />;
  if (lurl.includes('twitter.com') || lurl.includes('x.com')) return <Twitter className={`w-5 h-5 ${isGrayscale ? '' : 'text-neutral-400'}`} />;
  if (lurl.includes('facebook.com')) return <Facebook className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-600'}`} />;
  if (lurl.includes('github.com')) return <Github className="w-5 h-5" />;
  if (lurl.includes('linkedin.com')) return <Linkedin className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-700'}`} />;
  if (lurl.includes('slack.com')) return <Slack className={`w-5 h-5 ${isGrayscale ? '' : 'text-purple-500'}`} />;
  if (lurl.includes('mastodon') || lurl.includes('mstdn')) return <Globe className={`w-5 h-5 ${isGrayscale ? '' : 'text-purple-400'}`} />;
  if (lurl.includes('bsky.app')) return <Globe className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-400'}`} />;
  return <Globe className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-500'}`} />;
}

function getSocialFallbackLabel(url: string) {
  if (!url) return 'Link';
  const lurl = url.toLowerCase();
  if (lurl.includes('youtube.com') || lurl.includes('youtu.be')) return 'YouTube';
  if (lurl.includes('instagram.com')) return 'Instagram';
  if (lurl.includes('twitter.com') || lurl.includes('x.com')) return 'X / Twitter';
  if (lurl.includes('facebook.com')) return 'Facebook';
  if (lurl.includes('github.com')) return 'GitHub';
  if (lurl.includes('linkedin.com')) return 'LinkedIn';
  if (lurl.includes('slack.com')) return 'Slack';
  if (lurl.includes('mastodon')) return 'Mastodon';
  if (lurl.includes('bsky.app')) return 'Bluesky';
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch (e) {
    return 'Website';
  }
}

function getDomainOnly(url: string) {
  if (!url) return 'LINK';
  try {
    return new URL(url).hostname.replace('www.', '').toUpperCase();
  } catch (e) {
    return 'LINK';
  }
}

export function AuthorProfile() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings } = useSettings();
  const { isAtLimit } = usePlan();
  const [limitModal, setLimitModal] = useState<{isOpen: boolean, type: any}>({ isOpen: false, type: 'blogs' });
  const { t } = useTranslation();
  const isDark = settings.theme === 'dark';

  const [author, setAuthor] = useState<any>(null);
  const [blogs, setBlogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (author?.displayName) {
      document.title = `${author.displayName} | RSSer News`;
    } else if (loading) {
      document.title = `Laden... | RSSer News`;
    } else {
      document.title = `RSSer News`;
    }
  }, [author, loading]);
  const [followLoading, setFollowLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [hasHistory, setHasHistory] = useState(false);

  const rssUrl = `${getCanonicalOrigin()}/api/rss/user/${userId}`;

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
    // Check if we have history to go back to (internal navigation)
    if (window.history.length > 1 && document.referrer.includes(window.location.host)) {
      setHasHistory(true);
    }
  }, []);

  const handleCopyRss = () => {
    navigator.clipboard.writeText(rssUrl);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleToggleFollow = async () => {
    if (!auth.currentUser || !userId) return;
    
    if (!isFollowing && isAtLimit('blogs')) {
      setLimitModal({ isOpen: true, type: 'blogs' });
      return;
    }

    setFollowLoading(true);
    try {
      const feedId = `user_${userId}`;
      const userFeedRef = doc(db, 'users', auth.currentUser.uid, 'feeds', feedId);
      
      if (isFollowing) {
        await deleteDoc(userFeedRef);
        setIsFollowing(false);
      } else {
        await setDoc(userFeedRef, {
          title: author.displayName || 'RSSer News',
          url: rssUrl,
          type: 'blog',
          authorId: userId,
          category: 'Blogs',
          addedAt: new Date(),
          active: true
        });
        setIsFollowing(true);
      }
    } catch (err) {
      console.error("Error toggling follow:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${auth.currentUser.uid}/feeds`);
    } finally {
      setFollowLoading(false);
    }
  };

  const isInternal = !!(
    location.state?.internal || 
    location.pathname.startsWith('/settings') ||
    location.pathname.startsWith('/discover') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/rss-feeds') ||
    location.pathname.startsWith('/podcasts') ||
    location.pathname.startsWith('/youtube') ||
    location.pathname.startsWith('/radio') ||
    location.pathname.startsWith('/webcam') ||
    (document.referrer && document.referrer.includes(window.location.host) && auth.currentUser)
  );

  useEffect(() => {
    if (!userId) return;

    async function fetchData() {
      setLoading(true);
      try {
        // 1. Fetch User Profile
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          setError('Author not found');
          setLoading(false);
          return;
        }
        setAuthor(userDoc.data());

        // 2. Fetch Published Blogs
        const blogsRef = collection(db, 'users', userId, 'blogs');
        const q = query(
          blogsRef, 
          where('published', '==', true),
          orderBy('createdAt', 'desc'),
          limit(20)
        );
        
        try {
          const blogsSnap = await getDocs(q);
          setBlogs(blogsSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (blogErr) {
          console.warn("Could not fetch blogs with order (index missing?), fetching without order:", blogErr);
          // Fallback if index is not ready
          const fallbackQ = query(blogsRef, where('published', '==', true), limit(20));
          const fallbackSnap = await getDocs(fallbackQ);
          const data = fallbackSnap.docs.map(d => ({ id: d.id, ...d.data() }));
          // @ts-ignore
          data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
          setBlogs(data);
        }
        
        // 3. Check if following
        if (auth.currentUser) {
          const feedId = `user_${userId}`;
          const followDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'feeds', feedId));
          setIsFollowing(followDoc.exists());
        }

      } catch (err) {
        console.error(err);
        setError('Error loading profile');
        handleFirestoreError(err, OperationType.GET, `users/${userId}`);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [userId]);

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <Loader2 className="w-10 h-10 animate-spin text-[#FF4500]" />
        <p className="mt-4 opacity-50 font-bold uppercase tracking-widest text-xs">Profile Loading...</p>
      </div>
    );
  }

  if (error || !author) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center text-center px-4 ${isDark ? 'bg-[#0a0a0a] text-white' : 'bg-white text-gray-900'}`}>
        <h2 className="text-2xl font-black mb-2">{error || 'Author not found'}</h2>
        <button onClick={() => navigate('/')} className="mt-4 flex items-center gap-2 text-[#FF4500] font-bold">
          <ArrowLeft className="w-4 h-4" /> Go Home
        </button>
      </div>
    );
  }

  const mainContent = (
    <div className={`min-h-screen relative overflow-y-auto hide-scrollbar ${isDark ? 'bg-[#0a0a0a]/40 text-white' : 'bg-white/40 text-gray-900'} backdrop-blur-[3px]`}>
      {/* Yellow and Orange ambient background glowing blobs */}
      <div className="absolute top-1/4 left-10 w-[300px] h-[300px] rounded-full bg-yellow-500/15 dark:bg-yellow-500/10 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-1/3 right-10 w-[450px] h-[450px] rounded-full bg-orange-500/15 dark:bg-orange-500/10 blur-[150px] pointer-events-none z-0" />

      {/* BANNER SECTION */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 sm:pt-6 relative z-10">
        <div className="relative w-full">
          {/* Main Banner Container */}
          <div className="relative h-[180px] sm:h-[280px] w-full rounded-[2rem] bg-neutral-100 dark:bg-neutral-900 border border-black/5 dark:border-white/10 shadow-sm overflow-hidden">
            {author.bannerUrl ? (
              <img 
                src={author.bannerUrl} 
                alt="Banner" 
                className="w-full h-full object-cover" 
                style={{ objectPosition: `50% ${author.bannerOffset !== undefined ? author.bannerOffset : 50}%` }}
              />
            ) : (
              <div className="w-full h-full relative bg-neutral-100 dark:bg-neutral-950 overflow-hidden flex items-center justify-center">
                {/* Yellow/Orange glowing mesh gradients */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[150%] h-[150%] bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.18)_0%,rgba(249,115,22,0.06)_50%,transparent_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1)_0%,rgba(249,115,22,0.03)_50%,transparent_100%)] animate-[pulse_10s_infinite_alternate]" />
                <div className="absolute top-1/4 left-1/4 w-80 h-80 rounded-full bg-yellow-500/20 dark:bg-yellow-500/10 blur-3xl animate-[pulse_6s_infinite_alternate]" />
                <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-orange-500/20 dark:bg-orange-500/10 blur-3xl animate-[pulse_8s_infinite_alternate]" />
                <div className="z-10 flex flex-col items-center gap-2 opacity-30 dark:opacity-20">
                  <Globe className="w-12 h-12 text-yellow-500 animate-spin-slow" />
                </div>
              </div>
            )}
            
            {/* LANGUAGE FLAG - TOP LEFT */}
            {author.blogLanguage && (
                <div className="absolute top-6 left-8 z-30 text-3xl sm:text-4xl drop-shadow-md">
                   {author.blogLanguage === 'de' ? '🇩🇪' : 
                    author.blogLanguage === 'en' ? '🇺🇸' :
                    author.blogLanguage === 'fr' ? '🇫🇷' :
                    author.blogLanguage === 'es' ? '🇪🇸' :
                    author.blogLanguage === 'it' ? '🇮🇹' : ''}
                </div>
            )}

            {isInternal && hasHistory && (
              <button 
                onClick={() => navigate(-1)}
                className="absolute top-6 right-8 w-10 h-10 flex items-center justify-center rounded-full bg-black/40 text-white hover:bg-[#FF4500] transition-all backdrop-blur-md z-30"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* OVERLAP CONTENT */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-12 relative z-20">
        
        {/* AVATAR (ABSOLUTE OVERLAP) */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-14 sm:-top-[4.5rem]">
            <div 
              className="w-28 h-28 sm:w-36 sm:h-36 rounded-full border-4 border-white dark:border-[#0a0a0a] bg-neutral-100 dark:bg-neutral-800 shadow-xl transition-transform hover:scale-105 duration-500 shrink-0 relative overflow-hidden group"
            >
              {author.avatarUrl ? (
                  <img src={author.avatarUrl} alt={author.displayName} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
              ) : (
                  <User className="w-full h-full p-6 text-neutral-400" />
              )}
            </div>
        </div>

        {/* Content with minimal padding to move everything right under the banner */}
        <div className="flex flex-col pt-4 sm:pt-4">
            {/* LABELS ROW - Tightly under the banner */}
            <div className="w-full flex justify-between items-center mb-0 px-2 hidden sm:flex">
                <div className="flex-1">
                   <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 drop-shadow-sm">AUTOR</span>
                </div>
                {/* Spacer block for avatar area */}
                <div className="shrink-0 w-28 sm:w-36" /> 
                <div className="flex-1 flex justify-end">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40">
                            <Calendar className="w-3 h-3 text-orange-500" />
                            <span className="whitespace-nowrap">BEIGETRETEN AM:</span>
                        </div>
                        <span className="text-xs font-bold opacity-80 whitespace-nowrap uppercase">
                          MAI 2026
                        </span>
                    </div>
                </div>
            </div>

            <div className="w-full flex items-start justify-between gap-6 sm:gap-12">
                
                {/* NAME (LEFT) */}
                <div className="hidden sm:flex flex-col items-start flex-1 min-w-0 px-2">
                    <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none truncate w-full">
                      {author.displayName}
                    </h1>
                </div>

                {/* AVATAR SPACER (CENTER) */}
                <div className="w-28 h-28 sm:w-36 sm:h-2 shrink-0 relative pointer-events-none" />

                {/* RIGHT SPACER */}
                <div className="hidden sm:flex flex-col items-end flex-1 min-w-0 px-2">
                    {/* Balanced spacer */}
                </div>

            </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 md:px-10 mt-2 sm:mt-4">
        {/* MOBILE ONLY NAME AND QUICK INFO */}
        <div className="flex sm:hidden flex-col items-center gap-3 mb-6 mt-1 text-center">
            <span className="text-[9px] font-bold uppercase tracking-[0.4em] text-orange-500 -mb-1">AUTOR</span>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-white leading-none">{author.displayName}</h1>
            
            <div className="flex items-center gap-4">
                {author.blogLanguage && (
                    <div className="bg-neutral-50 dark:bg-white/5 px-2.5 py-1 rounded-lg border border-neutral-200/50 flex items-center gap-2">
                         <span className="text-[11px] font-black tracking-widest opacity-70">
                           {author.blogLanguage === 'de' ? '🇩🇪 DE' : author.blogLanguage.toUpperCase()}
                         </span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] opacity-40">
                    <Calendar className="w-4 h-4" />
                    <span>Beigetreten 2024</span>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 pb-16">
            {/* LEFT COLUMN */}
            <div className="lg:col-span-8 space-y-12 relative z-10">
                <section className={`p-6 sm:p-8 rounded-2xl border backdrop-blur-md transition-all duration-500 ${isDark ? 'bg-neutral-900/30 border-white/5 hover:border-yellow-500/20 shadow-lg shadow-yellow-500/[0.01]' : 'bg-white/60 border-gray-100/80 shadow-sm shadow-yellow-500/[0.02]'}`}>
                   <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-50 mb-4 font-mono text-yellow-600 dark:text-yellow-400">ÜBER DEN AUTOR</h2>
                   <div className="space-y-4">
                     <p className="text-base sm:text-lg font-bold leading-normal italic opacity-95 tracking-tight text-neutral-850 dark:text-neutral-100">
                         "{author.bio || 'Willkommen auf meinem Profil!'}"
                     </p>
                     {author.detailedBio && (
                       <p className="text-sm opacity-75 leading-relaxed font-medium max-w-2xl whitespace-pre-wrap">
                           {author.detailedBio}
                       </p>
                     )}
                   </div>
                </section>

                <section>
                   <h2 className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-50 mb-5 font-mono text-yellow-600 dark:text-yellow-400">NEUESTE BEITRÄGE ({blogs.length})</h2>
                   
                   <div className="space-y-6">
                       {blogs.map((blog) => (
                        <motion.div 
                           key={blog.id}
                           className={`group cursor-pointer rounded-2xl border overflow-hidden flex flex-col sm:flex-row backdrop-blur-md transition-all duration-300 ${isDark ? 'bg-neutral-900/30 border-white/5 hover:border-yellow-500/30 hover:bg-neutral-900/50 hover:shadow-lg hover:shadow-yellow-500/[0.02]' : 'bg-white/60 border-gray-100/80 hover:border-yellow-500/20 hover:bg-white/80 shadow-sm hover:shadow-md'}`}
                           onClick={() => {
                             const path = blog.slug 
                               ? `/blogs/user/${userId}/p/${blog.slug}`
                               : `/blogs/user/${userId}/article/${blog.id}`;
                             navigate(path, { state: { internal: true } });
                           }}
                        >
                            <div className="w-full sm:w-[200px] h-44 sm:h-auto shrink-0 overflow-hidden">
                                <img src={blog.coverImage || 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&q=80'} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" alt={blog.title} />
                            </div>
                            <div className="p-5 sm:p-6 flex flex-col justify-center flex-1">
                                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-yellow-500 dark:text-yellow-400 mb-2 opacity-90 font-mono">BEITRAG</span>
                                <h3 className="text-lg sm:text-xl font-bold mb-2 leading-tight transition-colors group-hover:text-yellow-500 dark:group-hover:text-yellow-400">{blog.title}</h3>
                                <p className="text-xs sm:text-sm opacity-55 line-clamp-2 font-medium mb-4 leading-relaxed text-neutral-600 dark:text-neutral-400">
                                    {blog.content?.replace(/<[^>]*>/g, '').substring(0, 150)}...
                                </p>
                                <div className="flex items-center gap-2 text-[11px] font-bold opacity-30 mt-auto">
                                    <Calendar className="w-3.5 h-3.5" />
                                    <span>{blog.createdAt?.toDate ? (() => {
                                      const d = blog.createdAt.toDate();
                                      return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
                                    })() : '8.5.2026'}</span>
                                </div>
                            </div>
                        </motion.div>
                       ))}
                   </div>
                </section>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-4 relative z-10">
                <div className={`p-6 sm:p-8 rounded-2xl border sticky top-24 backdrop-blur-md ${isDark ? 'bg-neutral-900/30 border-white/5 shadow-lg shadow-yellow-500/[0.01]' : 'bg-neutral-50/40 border-gray-100'}`}>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.4em] opacity-50 mb-6 font-mono text-yellow-600 dark:text-yellow-400">AUTOR KONTAKTIEREN</h3>
                    
                    <div className="space-y-4">
                        <button 
                          onClick={handleCopyRss}
                          className={`w-full p-4 rounded-xl shadow-sm border flex items-center gap-4 group transition-all text-left ${isDark ? 'bg-neutral-950/40 border-white/5 hover:border-yellow-500/30' : 'bg-white/75 border-neutral-200/50 hover:border-yellow-500/20'}`}
                        >
                            <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0">
                                <Rss className="w-5 h-5" />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-bold opacity-30 tracking-[0.2em] mb-0.5 uppercase font-mono">Rss Feed</span>
                                <span className="text-xs sm:text-sm font-bold truncate group-hover:text-yellow-500 dark:group-hover:text-yellow-400">{copySuccess ? 'Kopiert!' : 'URL kopieren'}</span>
                            </div>
                        </button>

                        {author.socialLink1 && (
                          <a 
                            href={author.socialLink1}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleInternalLinkClick(e, navigate)}
                            className={`w-full p-4 rounded-xl shadow-sm border flex items-center gap-4 group transition-all text-left ${isDark ? 'bg-neutral-950/40 border-white/5 hover:border-yellow-500/30 hover:bg-neutral-900/40' : 'bg-white/75 border-neutral-200/50 hover:border-yellow-500/20 hover:bg-white'}`}
                          >
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-300">
                                  {getSocialIcon(author.socialLink1, true)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                  <span className="text-[9px] font-bold opacity-45 tracking-[0.2em] mb-0.5 uppercase font-mono">
                                    {getDomainOnly(author.socialLink1)}
                                  </span>
                                  <span className="text-xs sm:text-sm font-bold truncate text-neutral-950 dark:text-white group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors">
                                    {author.socialLabel1 || getSocialFallbackLabel(author.socialLink1)}
                                  </span>
                              </div>
                          </a>
                        )}

                        {author.socialLink2 && (
                          <a 
                            href={author.socialLink2}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => handleInternalLinkClick(e, navigate)}
                            className={`w-full p-4 rounded-xl shadow-sm border flex items-center gap-4 group transition-all text-left ${isDark ? 'bg-neutral-950/40 border-white/5 hover:border-yellow-500/30 hover:bg-neutral-900/40' : 'bg-white/75 border-neutral-200/50 hover:border-yellow-500/20 hover:bg-white'}`}
                          >
                              <div className="w-10 h-10 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-black dark:text-white flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 duration-300">
                                  {getSocialIcon(author.socialLink2, true)}
                              </div>
                              <div className="flex flex-col min-w-0">
                                  <span className="text-[9px] font-bold opacity-45 tracking-[0.2em] mb-0.5 uppercase font-mono">
                                    {getDomainOnly(author.socialLink2)}
                                  </span>
                                  <span className="text-xs sm:text-sm font-bold truncate text-neutral-950 dark:text-white group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors">
                                    {author.socialLabel2 || getSocialFallbackLabel(author.socialLink2)}
                                  </span>
                              </div>
                          </a>
                        )}
                    </div>

                    <div className="mt-8 pt-5 border-t border-neutral-200/50 flex items-center justify-between">
                         <span className="text-[9px] font-bold opacity-30 tracking-[0.2em] uppercase font-mono">Status</span>
                         <span className="text-[9px] font-bold px-2 py-0.5 bg-green-500/10 text-green-600 dark:text-green-400 rounded-md tracking-tight uppercase font-mono">Verified Author</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );

  if (isInternal) {
    return (
      <>
        <AppShell>{mainContent}</AppShell>
        <LimitReachedModal 
          isOpen={limitModal.isOpen} 
          onClose={() => setLimitModal({ ...limitModal, isOpen: false })} 
          type={limitModal.type} 
        />
      </>
    );
  }

  return (
    <>
      <div className={`relative min-h-screen w-full overflow-hidden ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
        <AmbientWave />
        <div className="relative z-10 w-full h-full">
          {mainContent}
        </div>
      </div>
      <LimitReachedModal 
        isOpen={limitModal.isOpen} 
        onClose={() => setLimitModal({ ...limitModal, isOpen: false })} 
        type={limitModal.type} 
      />
    </>
  );
}
