import { tr } from '../../lib/t';
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { PenTool, Bold, Italic, Underline as UnderlineIcon, Strikethrough, Link as LinkIcon, Image as ImageIcon, Video, Save, List as ListIcon, ListOrdered, Quote, Heading1, Heading2, Loader2, Unlink, Bookmark, Pencil, Trash2, ArrowLeft, X, Rss, Youtube as YoutubeIcon, Instagram, Twitter, Facebook, Github, Linkedin, Slack, Globe, Check, Pilcrow, ThumbsUp, ThumbsDown, MessageCircle, Send, ArrowBigUp, ArrowBigDown, ShieldAlert, Zap, ArrowRight, User, UserCheck, Sun, Moon, Smartphone, BarChart3, Copy, ExternalLink, Eye } from 'lucide-react';
import { HeroBanner } from './HeroBanner';
import { useSettings } from '../../context/SettingsContext';
import { auth, db, storage, handleFirestoreError, OperationType } from '../../lib/firebase';
import { getCanonicalOrigin, handleInternalLinkClick, normalizeLinks } from '../../lib/utils';
import { collection, addDoc, getDocs, orderBy, query, serverTimestamp, deleteDoc, doc, updateDoc, where, getDoc, limit, setDoc } from 'firebase/firestore';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { usePlan } from '../../hooks/usePlan';
import { LimitReachedModal } from './LimitReachedModal';
import { translateContent } from '../../services/geminiService';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import Gapcursor from '@tiptap/extension-gapcursor';
import Dropcursor from '@tiptap/extension-dropcursor';
import { AppShell } from '../layout/AppShell';
import { RssPage } from './RssPage';
import { useModal } from '../../context/ModalContext';
import { isAdminEmail } from '../../lib/admin';

const MenuBar = ({ editor, uploadImage }: { editor: any, uploadImage: (file: File) => Promise<string | null> }) => {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  if (!editor) {
    return null;
  }

  const btnClass = (isActive: boolean) => 
    `p-2 rounded-lg transition-colors ${isActive ? (isDark ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800') : (isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}`;

  const handleLinkSubmit = () => {
    if (urlInput === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      let finalUrl = urlInput.trim();
      // Handle cases where user might have entered "www.example.com" or just "example.com"
      // We look for common patterns that should be absolute but lack protocol
      const hasProtocol = /^(https?:\/\/|mailto:|tel:)/i.test(finalUrl);
      const isRelative = finalUrl.startsWith('/') || finalUrl.startsWith('#') || finalUrl.startsWith('.');
      
      if (!hasProtocol && !isRelative && finalUrl.length > 0) {
        // If it looks like a domain or starts with www, prepend https://
        finalUrl = 'https://' + finalUrl;
      }
      
      editor.chain().focus().extendMarkRange('link').setLink({ href: finalUrl }).run();
    }
    setShowLinkInput(false);
    setUrlInput('');
  };

  const handleYoutubeSubmit = () => {
    if (urlInput) {
      editor.commands.setYoutubeVideo({
        src: urlInput,
        width: 640,
        height: 480,
      });
    }
    setShowYoutubeInput(false);
    setUrlInput('');
  };

  const addImage = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
       const file = (e.target as HTMLInputElement).files?.[0];
       if (file) {
         try {
           const url = await uploadImage(file);
           if (url) {
             editor.chain().focus().setImage({ src: url }).run();
           }
         } catch (err) {
           console.error(err);
         }
       }
    };
    input.click();
  };

  return (
    <div className={`flex flex-col border-b ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-gray-50'} rounded-t-xl`}>
      <div className="flex flex-wrap gap-1 p-2">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title={tr(settings.language, "Bold", "Fettschrift")}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title={tr(settings.language, "Italic", "Kursiv")}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title={tr(settings.language, "Underline", "Unterstrichen")}>
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={btnClass(editor.isActive('strike'))} title={tr(settings.language, "Strikethrough", "Durchgestrichen")}>
          <Strikethrough className="w-4 h-4" />
        </button>

        <div className={`w-px h-6 mx-1 self-center ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}></div>

        <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={btnClass(editor.isActive('paragraph'))} title={tr(settings.language, "Normal Text", "Normaler Text")}>
          <Pilcrow className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title={tr(settings.language, "Heading 1", "Überschrift 1")}>
          <Heading1 className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title={tr(settings.language, "Heading 2", "Überschrift 2")}>
          <Heading2 className="w-4 h-4" />
        </button>

        <div className={`w-px h-6 mx-1 self-center ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}></div>

        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title={tr(settings.language, "Bullet List", "Aufzählungsliste")}>
          <ListIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title={tr(settings.language, "Numbered List", "Nummerierte Liste")}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title={tr(settings.language, "Quote", "Zitat")}>
          <Quote className="w-4 h-4" />
        </button>

        <div className={`w-px h-6 mx-1 self-center ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}></div>

        <button type="button" onClick={() => {
          const prev = editor.getAttributes('link').href;
          setUrlInput(prev || '');
          setShowLinkInput(true);
          setShowYoutubeInput(false);
        }} className={btnClass(editor.isActive('link'))} title={tr(settings.language, "Insert Link", "Link einfügen")}>
          <LinkIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} className={`p-2 rounded-lg transition-colors ${editor.isActive('link') ? (isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900') : 'opacity-30 cursor-not-allowed'}`} title={tr(settings.language, "Remove Link", "Link entfernen")}>
          <Unlink className="w-4 h-4" />
        </button>

        <button type="button" onClick={addImage} className={btnClass(false)} title={tr(settings.language, "Insert Image", "Bild einfügen")}>
          <ImageIcon className="w-4 h-4" />
        </button>
        <button type="button" onClick={() => {
          setUrlInput('');
          setShowYoutubeInput(true);
          setShowLinkInput(false);
        }} className={btnClass(false)} title={tr(settings.language, "Insert YouTube Video", "YouTube Video einfügen")}>
          <Video className="w-4 h-4" />
        </button>
      </div>

      {(showLinkInput || showYoutubeInput) && (
        <div className="flex items-center gap-2 p-2 bg-black/5 dark:bg-white/5 border-t border-gray-200 dark:border-white/10 animate-in slide-in-from-top-1">
          <input 
            type="url" 
            autoFocus
            placeholder={showLinkInput ? tr(settings.language, "URL (e.g. rsser.news or https://...)", "URL (z. B. rsser.news oder https://...)") : tr(settings.language, "YouTube Video URL", "YouTube-Video-URL")}
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') showLinkInput ? handleLinkSubmit() : handleYoutubeSubmit();
              if (e.key === 'Escape') { setShowLinkInput(false); setShowYoutubeInput(false); }
            }}
            className="flex-1 bg-transparent border-none outline-none text-sm px-2 h-8"
          />
          <button onClick={showLinkInput ? handleLinkSubmit : handleYoutubeSubmit} className="px-4 py-1 bg-yellow-500 text-black text-xs font-bold rounded-full">
            OK
          </button>
          <button onClick={() => { setShowLinkInput(false); setShowYoutubeInput(false); }} className={`px-4 py-1 text-xs font-bold rounded-full ${isDark ? 'bg-white/10 text-white' : 'bg-gray-200 text-gray-700'}`}>
            {tr(settings.language, "Cancel", "Abbrechen")}
          </button>
        </div>
      )}
    </div>
  );
};

function getSocialIcon(url: string, isGrayscale = false) {
  if (!url) return <LinkIcon className="w-5 h-5" />;
  const lurl = url.toLowerCase();
  if (lurl.includes('youtube.com') || lurl.includes('youtu.be')) return <YoutubeIcon className={`w-5 h-5 ${isGrayscale ? '' : 'text-red-500'}`} />;
  if (lurl.includes('instagram.com')) return <Instagram className={`w-5 h-5 ${isGrayscale ? '' : 'text-pink-500'}`} />;
  if (lurl.includes('twitter.com') || lurl.includes('x.com')) return <Twitter className={`w-5 h-5 ${isGrayscale ? '' : 'text-neutral-400'}`} />;
  if (lurl.includes('facebook.com')) return <Facebook className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-600'}`} />;
  if (lurl.includes('github.com')) return <Github className="w-5 h-5" />;
  if (lurl.includes('linkedin.com')) return <Linkedin className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-700'}`} />;
  if (lurl.includes('slack.com')) return <Slack className={`w-5 h-5 ${isGrayscale ? '' : 'text-purple-500'}`} />;
  if (lurl.includes('bsky.app')) return <Globe className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-400'}`} />;
  return <Globe className={`w-5 h-5 ${isGrayscale ? '' : 'text-blue-500'}`} />;
}

function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')    // Remove non-word chars
    .replace(/[\s_-]+/g, '-')     // Replace spaces/underscores with -
    .replace(/^-+|-+$/g, '');     // Trim dashes from ends
}

const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {
    console.warn("Clipboard API failed, trying fallback:", e);
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.width = '2em';
    textarea.style.height = '2em';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textarea);
    return successful;
  } catch (err) {
    console.error("Fallback copy failed:", err);
    return false;
  }
};

function getLanguageLabel(lang: string, activeLang: string) {
  switch (lang.toLowerCase()) {
    case 'en': return { flag: '🇺🇸', label: tr(activeLang, 'English', 'Englisch') };
    case 'fr': return { flag: '🇫🇷', label: tr(activeLang, 'French', 'Französisch') };
    case 'es': return { flag: '🇪🇸', label: tr(activeLang, 'Spanish', 'Spanisch') };
    case 'it': return { flag: '🇮🇹', label: tr(activeLang, 'Italiano', 'Italienisch') };
    case 'pt': return { flag: '🇵🇹', label: tr(activeLang, 'Portuguese', 'Portugiesisch') };
    case 'de':
    default: return { flag: '🇩🇪', label: tr(activeLang, 'German', 'Deutsch') };
  }
}

export function BlogPage() {
  const { settings, toggleTheme, setTheme } = useSettings();
  const { canWriteBlog, isAtLimit } = usePlan();
  const { showAlert, showConfirm } = useModal();
  const [limitModal, setLimitModal] = useState<{isOpen: boolean, type: any}>({ isOpen: false, type: 'rss' });
  const location = useLocation();
  const navigate = useNavigate();
  const { userId: userIdParam, slug: slugParam, articleId: articleIdParam, id: idParam } = useParams();

  const [currentUser, setCurrentUser] = useState<any>(auth.currentUser);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
    });
    return () => unsubscribe();
  }, []);

  const segments = location.pathname.split('/').filter(Boolean);
  const isMyBlogs = location.pathname.includes('/my');
  const isWrite = location.pathname.includes('/write');
  const isArticle = !!(userIdParam || articleIdParam || slugParam || idParam) || 
                    segments.includes('article') || 
                    segments.includes('blog') || 
                    segments.includes('p');
  const isSubscribed = !isMyBlogs && !isWrite && !isArticle && segments[0] === 'blogs' && (!segments[1] || segments[1] === 'subscribed');

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
    location.pathname === '/blogs/my' ||
    location.pathname === '/blogs/write' ||
    location.pathname === '/blogs/subscribed' ||
    (document.referrer && document.referrer.includes(window.location.host) && (auth.currentUser || location.pathname.includes('/dashboard')))
  );

  const isDark = settings.theme === 'dark';
  const isEn = settings.language === 'en';
  const [blogs, setBlogs] = useState<any[]>([]);
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [coverImageOffset, setCoverImageOffset] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startOffset, setStartOffset] = useState(50);
  const [isSaving, setIsSaving] = useState(false);
  const [publishPublicly, setPublishPublicly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBlogId, setEditingBlogId] = useState<string | null>(null);
  const [isLoadedPublished, setIsLoadedPublished] = useState<boolean>(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Translation state variables
  const [translations, setTranslations] = useState<Record<string, { title: string, content: string }>>({});
  const [isTranslating, setIsTranslating] = useState(false);
  const [lastTranslationTime, setLastTranslationTime] = useState<number | null>(null);

  const [singleArticle, setSingleArticle] = useState<any>(null);
  const [isArticleLoading, setIsArticleLoading] = useState(false);
  const [selectedArticleLanguage, setSelectedArticleLanguage] = useState<string | null>(null);

  // URL Shortener / analytics states
  const [shortenedUrls, setShortenedUrls] = useState<Record<string, any>>({});
  const [isShortening, setIsShortening] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const lang = params.get('lang');
    if (lang) {
      setSelectedArticleLanguage(lang);
    } else {
      setSelectedArticleLanguage(null);
    }
  }, [articleIdParam, slugParam, idParam, location.search]);

  useEffect(() => {
    const fetchSingleShortenedUrl = async () => {
      if (singleArticle && currentUser && singleArticle.authorId === currentUser.uid) {
        try {
          const q = query(collection(db, 'shortenedUrls'), where('blogId', '==', singleArticle.id));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            setShortenedUrls(prev => ({ ...prev, [singleArticle.id]: data }));
          }
        } catch (err) {
          console.error("Error loading single shortened URL:", err);
        }
      }
    };
    fetchSingleShortenedUrl();
  }, [singleArticle, currentUser]);

  const getArticleDisplayContent = () => {
    if (!singleArticle) return { title: '', content: '' };
    
    const originalLang = singleArticle.language || 'de';
    const activeLang = selectedArticleLanguage || (singleArticle.translations && singleArticle.translations[settings.language || 'de'] ? (settings.language || 'de') : originalLang);

    if (activeLang === originalLang) {
      return {
        title: singleArticle.title || '',
        content: singleArticle.content || ''
      };
    }
    if (singleArticle.translations && singleArticle.translations[activeLang]) {
      return {
        title: singleArticle.translations[activeLang].title || singleArticle.title,
        content: singleArticle.translations[activeLang].content || singleArticle.content
      };
    }
    return {
      title: singleArticle.title || '',
      content: singleArticle.content || ''
    };
  };

  const displayContent = getArticleDisplayContent();

  const originalLang = singleArticle?.language || 'de';
  const availableLangs = singleArticle ? Array.from(new Set([originalLang, ...Object.keys(singleArticle.translations || {})])) : [];
  const activeLang = singleArticle ? (selectedArticleLanguage || (singleArticle.translations && singleArticle.translations[settings.language || 'de'] ? (settings.language || 'de') : originalLang)) : 'de';

  const [comments, setComments] = useState<any[]>([]);
  const [commenterAvatars, setCommenterAvatars] = useState<Record<string, string>>({});
  const [deletingCommentId, setDeletingCommentId] = useState<string | null>(null);
  const [votes, setVotes] = useState<{ up: number, down: number }>({ up: 0, down: 0 });
  const [userVote, setUserVote] = useState<'up' | 'down' | null>(null);
  const [commentText, setCommentText] = useState('');
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [userPlan, setUserPlan] = useState<'free' | 'monthly' | 'yearly' | null>(null);
  const [userProfile, setUserProfile] = useState<{ displayName?: string; bio?: string } | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const hasCompleteProfile = !!(userProfile && userProfile.displayName?.trim() && userProfile.bio?.trim());

  useEffect(() => {
    if (displayContent.title) {
      document.title = `${displayContent.title} | RSSer News`;
    } else if (isArticle && isArticleLoading) {
       document.title = `Laden... | RSSer News`;
    } else if (!isSubscribed) {
       document.title = `Blogs | RSSer News`;
    }
  }, [displayContent.title, isArticle, isArticleLoading, isSubscribed]);
  const [copyArticleSuccess, setCopyArticleSuccess] = useState(false);
  const [copiedLang, setCopiedLang] = useState<string | null>(null);
  const [hasHistory, setHasHistory] = useState(false);
  const [showLinkMenu, setShowLinkMenu] = useState(false);
  const linkMenuRef = React.useRef<HTMLDivElement>(null);
  const mobileLinkMenuRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showLinkMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const clickedInsideDesktop = linkMenuRef.current && linkMenuRef.current.contains(target);
      const clickedInsideMobile = mobileLinkMenuRef.current && mobileLinkMenuRef.current.contains(target);
      if (!clickedInsideDesktop && !clickedInsideMobile) {
        setShowLinkMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showLinkMenu]);

  useEffect(() => {
    // Check if we have history to go back to (internal navigation)
    // We check if referrer exists and belongs to our host
    const isInternalRef = document.referrer && document.referrer.includes(window.location.host);
    const hasInternalState = !!location.state?.internal;
    
    if (isInternalRef || hasInternalState || window.history.length > 2) {
      setHasHistory(true);
    }
  }, [location.state]);

  const handleFlagShareClick = async (lCode: string, langISO: string) => {
    if (!singleArticle) return;
    const isAuthor = currentUser && singleArticle.authorId === currentUser.uid;
    
    try {
      if (isAuthor) {
        let shortData = shortenedUrls[singleArticle.id];
        if (!shortData) {
          shortData = await handleCreateShortlink(singleArticle);
        }
        if (shortData && shortData.id) {
          const withLang = `${getCanonicalOrigin()}/s/${shortData.id}+${lCode}`;
          const ok = await copyTextToClipboard(withLang);
          if (ok) {
            setCopiedLang(lCode);
            setTimeout(() => setCopiedLang(null), 2000);
          }
        }
      } else {
        const articleUrl = `${getCanonicalOrigin()}/blogs/user/${singleArticle.authorId}/p/${singleArticle.slug || singleArticle.id}?lang=${langISO}`;
        const ok = await copyTextToClipboard(articleUrl);
        if (ok) {
          setCopiedLang(lCode);
          setTimeout(() => setCopiedLang(null), 2000);
        }
      }
    } catch (err) {
      console.error("Error in handleFlagShareClick:", err);
    }
  };

  useEffect(() => {
    if (isArticle && !isInternal) {
      const savedSettings = localStorage.getItem('rsser-settings');
      if (!savedSettings) {
        setTheme('dark');
      }
    }
  }, [isArticle, isInternal, setTheme]);

  useEffect(() => {
    if (isArticle) {
      const fetchArticle = async () => {
        setIsArticleLoading(true);
        // Extract ID or Slug from URL parameters or fallback to last segment
        const articleIdOrSlug = slugParam || articleIdParam || idParam || segments[segments.length - 1]?.split('?')[0];
        
        let userIdFromUrl = userIdParam;
        if (!userIdFromUrl && segments.includes('user')) {
          const userIndex = segments.indexOf('user');
          if (userIndex !== -1 && userIndex + 1 < segments.length) {
            userIdFromUrl = segments[userIndex + 1];
          }
        }

        if (!articleIdOrSlug) {
          setIsArticleLoading(false);
          return;
        }

        try {
          // 0. If userId is provided in URL, try direct access by ID or lookup by Slug
          if (userIdFromUrl) {
            try {
              // Try ID first
              const blogDocRef = doc(db, 'users', userIdFromUrl, 'blogs', articleIdOrSlug);
              const blogSnap = await getDoc(blogDocRef);
              
              let foundData = null;
              let foundId = null;

              if (blogSnap.exists()) {
                foundData = blogSnap.data();
                foundId = blogSnap.id;
              } else {
                // If not found by ID, try Slug lookup
                const blogsRef = collection(db, 'users', userIdFromUrl, 'blogs');
                // Use a query that matches security rules (published == true)
                const qSlug = query(blogsRef, where('slug', '==', articleIdOrSlug), where('published', '==', true), limit(1));
                const slugSnaps = await getDocs(qSlug);
                
                if (slugSnaps.empty) {
                  // Final check for the author themselves (who might be viewing their own unpublished draft)
                  if (auth.currentUser && auth.currentUser.uid === userIdFromUrl) {
                    const qDraft = query(blogsRef, where('slug', '==', articleIdOrSlug), limit(1));
                    const draftSnaps = await getDocs(qDraft);
                    if (!draftSnaps.empty) {
                      const d = draftSnaps.docs[0];
                      foundData = d.data();
                      foundId = d.id;
                    }
                  }
                } else {
                  const d = slugSnaps.docs[0];
                  foundData = d.data();
                  foundId = d.id;
                }
              }

              if (foundData) {
                // Verify if published
                const isAuthor = auth.currentUser && auth.currentUser.uid === userIdFromUrl;
                if (!foundData.published && !isAuthor) {
                   console.log("Article found but not published and user not authorized.");
                   setSingleArticle(null);
                   setIsArticleLoading(false);
                   return;
                } else {
                  const authorSnap = await getDoc(doc(db, 'users', userIdFromUrl));
                  const authorData = authorSnap.exists() ? authorSnap.data() : {};
                  
                  setSingleArticle({
                    id: foundId,
                    ...foundData,
                    authorName: authorData.displayName || "Unknown",
                    authorAvatar: authorData.avatarUrl || authorData.avatar,
                    authorBio: authorData.bio,
                    authorDetailedBio: authorData.detailedBio,
                    authorBanner: authorData.bannerUrl || authorData.banner,
                    authorBannerOffset: authorData.bannerOffset !== undefined ? authorData.bannerOffset : 50,
                    authorSocialLink1: authorData.socialLink1,
                    authorSocialLink2: authorData.socialLink2,
                    authorId: userIdFromUrl,
                    language: authorData.blogLanguage || 'de'
                  });
                  setIsArticleLoading(false);
                  return;
                }
              }
            } catch (err) {
              console.warn("Direct fetch by userId/slug failed:", err);
            }
          }

          // 1. Try publicSources by blogId field or slug field
          const publicSourcesRef = collection(db, 'publicSources');
          const qId = query(publicSourcesRef, where('blogId', '==', articleIdOrSlug));
          let snaps = await getDocs(qId);

          if (snaps.empty) {
            const qSlug = query(publicSourcesRef, where('slug', '==', articleIdOrSlug));
            snaps = await getDocs(qSlug);
          }
          
          // 2. Try publicSources by url field (fallback for legacy or different origins)
          if (snaps.empty) {
             const q2 = query(publicSourcesRef, where('url', '==', getCanonicalOrigin() + '/blogs/article/' + articleIdOrSlug));
             snaps = await getDocs(q2);
          }
          if (snaps.empty) {
             const q3 = query(publicSourcesRef, where('url', '==', getCanonicalOrigin() + '/blog/' + articleIdOrSlug));
             snaps = await getDocs(q3);
          }

          // 3. Try by document ID in publicSources
          if (snaps.empty) {
            const legacyDoc = await getDoc(doc(db, 'publicSources', articleIdOrSlug));
            if (legacyDoc.exists()) {
              snaps = { empty: false, docs: [legacyDoc] } as any;
            }
          }

          if (!snaps.empty) {
            const publicData = snaps.docs[0].data();
            const userId = publicData.addedBy;
            const actualBlogId = publicData.blogId;
            if (userId && actualBlogId) {
              const blogSnap = await getDoc(doc(db, 'users', userId, 'blogs', actualBlogId));
              if (blogSnap.exists()) {
                setSingleArticle({ 
                  id: blogSnap.id, 
                  ...blogSnap.data(),
                  authorName: publicData.authorName,
                  authorAvatar: publicData.authorAvatar,
                  authorBio: publicData.authorBio,
                  authorDetailedBio: publicData.authorDetailedBio,
                  authorBanner: publicData.authorBanner,
                  authorBannerOffset: publicData.authorBannerOffset !== undefined ? publicData.authorBannerOffset : 50,
                  authorSocialLink1: publicData.authorSocialLink1,
                  authorSocialLink2: publicData.authorSocialLink2,
                  authorId: userId,
                  language: publicData.language
                });
                setIsArticleLoading(false);
                return;
              }
            }
          }

          // 4. Last ditch effort: check current user's blogs if they are the author
          if (auth.currentUser) {
            const myBlogSnap = await getDoc(doc(db, 'users', auth.currentUser.uid, 'blogs', articleIdOrSlug));
            if (myBlogSnap.exists()) {
               const myBlogData = myBlogSnap.data();
               const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
               const userData = userSnap.exists() ? userSnap.data() : {};
               setSingleArticle({
                  id: myBlogSnap.id,
                  ...myBlogData,
                  authorName: userData.displayName || auth.currentUser.displayName,
                  authorAvatar: userData.avatarUrl || userData.avatar,
                  authorBio: userData.bio,
                  authorDetailedBio: userData.detailedBio,
                  authorBanner: userData.bannerUrl || userData.banner,
                  authorBannerOffset: userData.bannerOffset !== undefined ? userData.bannerOffset : 50,
                  authorSocialLink1: userData.socialLink1,
                  authorSocialLink2: userData.socialLink2,
                  authorId: auth.currentUser.uid,
                  language: userData.blogLanguage || userData.language || 'de'
               });
               setIsArticleLoading(false);
               return;
            }
          }
          
          setSingleArticle(null);
        } catch (err) {
          console.error("Error fetching single article:", err);
          setSingleArticle(null);
        } finally {
          setIsArticleLoading(false);
        }
      };
      fetchArticle();
    }
  }, [isArticle, location.pathname]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2],
        },
      }),
      Typography,
      Placeholder.configure({
        placeholder: tr(settings.language, 'Write something great...', 'Schreibe etwas Großartiges...'),
      }),
      Underline,
      Image.configure({
         HTMLAttributes: {
           class: 'block w-full h-auto object-cover rounded-3xl my-14 mx-auto'
         }
      }),
      Link.configure({
        openOnClick: false,
        linkOnPaste: true,
        autolink: true,
        validate: href => /^https?:\/\//.test(href) || href.startsWith('/') || href.startsWith('mailto:') || href.startsWith('tel:'),
        HTMLAttributes: {
           class: 'text-yellow-500 hover:text-yellow-600 underline transition-colors font-bold',
           target: '_blank',
           rel: 'noopener noreferrer'
        }
      }),
      Youtube.configure({
        inline: false,
        width: 1280,
        height: 720,
        HTMLAttributes: {
           class: 'w-full aspect-video rounded-3xl overflow-hidden my-14 mx-auto'
        }
      }),
    ],
    content: tr(settings.language, '<p>The beginning of something great...</p>', '<p>Der Anfang von etwas Großartigem...</p>'),
    editorProps: {
      attributes: {
        class: `prose ${isDark ? 'prose-invert' : ''} max-w-none prose-p:text-lg prose-p:leading-relaxed prose-p:opacity-90 prose-headings:font-black prose-headings:tracking-tight prose-img:rounded-3xl prose-img:my-14 prose-img:mx-auto prose-img:w-full prose-a:text-yellow-500 hover:prose-a:text-yellow-600 font-medium prose-blockquote:border-yellow-500 prose-blockquote:bg-yellow-500/5 prose-blockquote:p-6 prose-blockquote:rounded-r-xl focus:outline-none min-h-[60vh] p-6 md:p-12`,
      },
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain');
        if (text && /^(www\.|[a-zA-Z0-9-]+\.[a-zA-Z]{2,})/.test(text.trim())) {
          // If the pasted text looks like a URL but has no protocol, we could handle it here
          // but Tiptap's link extension with linkOnPaste usually handles it.
          // However, we want to ensure it's absolute.
        }
        return false;
      },
    },
  });

  const loadShortenedUrls = async () => {
    if (!auth.currentUser) return;
    try {
      const q = query(collection(db, 'shortenedUrls'), where('userId', '==', auth.currentUser.uid));
      const snap = await getDocs(q);
      const dataMap: Record<string, any> = {};
      snap.forEach(d => {
        const item = d.data();
        dataMap[item.blogId] = item;
      });
      setShortenedUrls(dataMap);
    } catch (err) {
      console.error("Error loading shortened URLs:", err);
    }
  };

  const handleCreateShortlink = async (blog: any) => {
    if (!auth.currentUser) return null;
    setIsShortening(prev => ({ ...prev, [blog.id]: true }));
    try {
      const longUrl = `${getCanonicalOrigin()}/blogs/user/${auth.currentUser.uid}/p/${blog.slug || blog.id}`;
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalUrl: longUrl,
          blogId: blog.id,
          userId: auth.currentUser.uid
        })
      });
      if (response.ok) {
        const data = await response.json();
        setShortenedUrls(prev => ({ ...prev, [blog.id]: data }));
        return data;
      } else {
        await showAlert(
          tr(settings.language, "Failed to create short link.", "Fehler beim Erstellen des Kurzlinks."),
          tr(settings.language, "Error", "Fehler")
        );
      }
    } catch (err) {
      console.error("Error shortening URL:", err);
    } finally {
      setIsShortening(prev => ({ ...prev, [blog.id]: false }));
    }
    return null;
  };

  const loadBlogs = async () => {
    if (!auth.currentUser) return;
    try {
      const blogsRef = collection(db, 'users', auth.currentUser.uid, 'blogs');
      const q = query(blogsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const blogsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setBlogs(blogsData);
      await loadShortenedUrls();
    } catch(err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const fetchUserPlanAndProfile = async () => {
      if (auth.currentUser) {
        setIsProfileLoading(true);
        try {
          const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          let planVal: 'free' | 'monthly' | 'yearly' = 'free';
          if (userSnap.exists()) {
            const data = userSnap.data();
            planVal = (data.plan || 'free') as 'free' | 'monthly' | 'yearly';
            setUserProfile({
              displayName: data.displayName || '',
              bio: data.bio || ''
            });
          } else {
            setUserProfile({});
          }

          if (isAdminEmail(auth.currentUser?.email)) {
            planVal = 'yearly';
          }
          setUserPlan(planVal);
        } catch (err) {
          console.error("Error fetching user plan and profile:", err);
          if (isAdminEmail(auth.currentUser?.email)) {
            setUserPlan('yearly');
          }
        } finally {
          setIsProfileLoading(false);
        }
      } else {
        setUserPlan(null);
        setUserProfile(null);
        setIsProfileLoading(false);
      }
    };
    fetchUserPlanAndProfile();
  }, [auth.currentUser]);

  useEffect(() => {
    if (isMyBlogs && auth.currentUser) {
      loadBlogs();
    }
  }, [isMyBlogs, auth.currentUser]);

  useEffect(() => {
    const fetchSocialData = async () => {
      if (!singleArticle?.id || !singleArticle?.authorId) return;
      
      const blogId = singleArticle.id;
      const authorId = singleArticle.authorId;

      try {
        // Fetch Votes
        const votesRef = collection(db, 'users', authorId, 'blogs', blogId, 'votes');
        const votesSnap = await getDocs(votesRef);
        let up = 0;
        let down = 0;
        let myVote: any = null;

        votesSnap.forEach((doc) => {
          const data = doc.data();
          if (data.type === 'up') up++;
          if (data.type === 'down') down++;
          if (auth.currentUser && doc.id === auth.currentUser.uid) {
            myVote = data.type;
          }
        });
        setVotes({ up, down });
        setUserVote(myVote);

        // Fetch Comments
        const commentsRef = collection(db, 'users', authorId, 'blogs', blogId, 'comments');
        const q = query(commentsRef, orderBy('timestamp', 'desc'));
        const commentsSnap = await getDocs(q);
        const commentsData = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setComments(commentsData);

        // Fetch missing commenter profiles (for avatars)
        const missingUserIds = Array.from(new Set(
          commentsData
            .filter((c: any) => !c.userAvatar)
            .map((c: any) => c.userId)
            .filter(Boolean)
        ));

        if (missingUserIds.length > 0) {
          const fetchedAvatars: Record<string, string> = {};
          await Promise.all(missingUserIds.map(async (uid: any) => {
            try {
              const uSnap = await getDoc(doc(db, 'users', uid));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                const url = uData.avatarUrl || uData.avatar;
                if (url) {
                  fetchedAvatars[uid] = url;
                }
              }
            } catch (e) {
              console.error("Error fetching user profile for comment avatar:", e);
            }
          }));
          setCommenterAvatars(prev => ({ ...prev, ...fetchedAvatars }));
        }

      } catch (err) {
        console.error("Error fetching social data:", err);
      }
    };

    if (singleArticle) {
      fetchSocialData();
    }
  }, [singleArticle, auth.currentUser]);

  const handleVote = async (type: 'up' | 'down') => {
    if (!auth.currentUser || !singleArticle) return;
    if (isVoting) return;

    setIsVoting(true);
    const voteRef = doc(db, 'users', singleArticle.authorId, 'blogs', singleArticle.id, 'votes', auth.currentUser.uid);
    
    try {
      if (userVote === type) {
        // Remove vote
        await deleteDoc(voteRef);
        setUserVote(null);
        setVotes(prev => ({ ...prev, [type]: Math.max(0, prev[type] - 1) }));
      } else {
        // Add or change vote
        const oldVote = userVote;
        
        await setDoc(voteRef, {
          userId: auth.currentUser.uid,
          type,
          timestamp: serverTimestamp()
        });

        setUserVote(type);
        setVotes(prev => {
          const next = { ...prev, [type]: prev[type] + 1 };
          if (oldVote) {
            next[oldVote] = Math.max(0, next[oldVote] - 1);
          }
          return next;
        });
      }
    } catch (err) {
      console.error("Error voting:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${singleArticle.authorId}/blogs/${singleArticle.id}/votes/${auth.currentUser.uid}`);
    } finally {
      setIsVoting(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !singleArticle || !commentText.trim() || isCommentSubmitting) return;

    // Check if paying user (or author or admin)
    const isAuthor = auth.currentUser.uid === singleArticle.authorId;
    const isPaying = userPlan === 'monthly' || userPlan === 'yearly';
    const isAdmin = isAdminEmail(auth.currentUser.email);

    if (!isPaying && !isAuthor && !isAdmin) {
      await showAlert(
        tr(settings.language, "Commenting is reserved for paying members.", "Kommentieren ist zahlenden Mitgliedern vorbehalten."),
        tr(settings.language, "Member Feature", "Mitglieder-Funktion")
      );
      return;
    }

    setIsCommentSubmitting(true);
    const commentsRef = collection(db, 'users', singleArticle.authorId, 'blogs', singleArticle.id, 'comments');

    try {
      const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userSnap.exists() ? userSnap.data() : {};

      const newComment = {
        userId: auth.currentUser.uid,
        userName: userData.displayName || auth.currentUser.displayName || "Unknown",
        userAvatar: userData.avatarUrl || userData.avatar || auth.currentUser.photoURL || null,
        text: commentText.trim(),
        timestamp: serverTimestamp()
      };

      const docRef = await addDoc(commentsRef, newComment);
      setComments(prev => [{ id: docRef.id, ...newComment, timestamp: new Date() }, ...prev]);
      setCommentText('');
    } catch (err) {
      console.error("Error adding comment:", err);
      handleFirestoreError(err, OperationType.WRITE, `users/${singleArticle.authorId}/blogs/${singleArticle.id}/comments`);
    } finally {
      setIsCommentSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!auth.currentUser || !singleArticle) return;
    const isAdmin = isAdminEmail(auth.currentUser.email);
    if (!isAdmin) return;

    const confirmed = await showConfirm(
      tr(settings.language, "Do you really want to delete this comment?", "Möchtest du diesen Kommentar wirklich löschen?"),
      tr(settings.language, "Delete Comment", "Kommentar löschen"),
      tr(settings.language, "Delete", "Löschen")
    );
    if (!confirmed) return;

    try {
      const commentRef = doc(db, 'users', singleArticle.authorId, 'blogs', singleArticle.id, 'comments', commentId);
      await deleteDoc(commentRef);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setDeletingCommentId(null);
      await showAlert(
        tr(settings.language, "Comment deleted successfully.", "Kommentar erfolgreich gelöscht."),
        tr(settings.language, "Success", "Erfolg")
      );
    } catch (err) {
      console.error("Error deleting comment:", err);
      handleFirestoreError(err, OperationType.DELETE, `users/${singleArticle.authorId}/blogs/${singleArticle.id}/comments/${commentId}`);
    }
  };

  useEffect(() => {
    if (isWrite && location.state?.blog && editor) {
      const blog = location.state.blog;
      setTitle(blog.title);
      setCoverImage(blog.coverImage);
      setCoverImageOffset(blog.coverImageOffset !== undefined ? blog.coverImageOffset : 50);
      editor.commands.setContent(normalizeLinks(blog.content));
      setEditingBlogId(blog.id);
      setTranslations(blog.translations || {});
      setIsLoadedPublished(!!blog.published);
    } else if (isWrite && editor) {
      setTitle('');
      setCoverImage('');
      setCoverImageOffset(50);
      editor.commands.setContent(tr(settings.language, '<p>The beginning of something great...</p>', '<p>Der Anfang von etwas Großartigem...</p>'));
      setEditingBlogId(null);
      setTranslations({});
      setIsLoadedPublished(false);
    }
  }, [isWrite, location.state, editor]);

  const handleSave = async (isPublished: boolean = true, customTranslations?: any) => {
    if (!auth.currentUser || !editor) return;
    const rawContent = editor.getHTML();
    const content = normalizeLinks(rawContent);
    
    if (!title.trim() || editor.getText().trim() === '') {
      await showAlert(
        tr(settings.language, "Title and content cannot be empty.", "Titel und Inhalt dürfen nicht leer sein."),
        tr(settings.language, "Incomplete Post", "Unvollständiger Beitrag")
      );
      return;
    }

    if (isPublished && !coverImage.trim()) {
      await showAlert(
        tr(settings.language, "To publish, you must provide a cover image.", "Um zu veröffentlichen, musst du ein Artikelbild angeben."),
        tr(settings.language, "Cover Image Required", "Artikelbild erforderlich")
      );
      return;
    }

    setIsSaving(true);
    try {
      let blogId = editingBlogId;
      const slug = generateSlug(title);
      
      // Fetch user profile for language
      let blogLanguage = 'de';
      try {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
        if (userSnap.exists()) {
          blogLanguage = userSnap.data().blogLanguage || 'de';
        }
      } catch (err) {
        console.error("Error fetching language for blog:", err);
      }

      let blogData: any = {
          title,
          slug,
          coverImage,
          coverImageOffset,
          content,
          published: isPublished,
          language: blogLanguage,
          translations: customTranslations || translations || {}
        };
      
      if (!editingBlogId) {
        blogData.createdAt = serverTimestamp();
      }

      if (editingBlogId) {
        await updateDoc(doc(db, 'users', auth.currentUser.uid, 'blogs', editingBlogId), {
          title,
          slug,
          coverImage,
          coverImageOffset,
          content,
          published: isPublished,
          language: blogLanguage,
          translations: customTranslations || translations || {}
        });
      } else {
        blogData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'users', auth.currentUser.uid, 'blogs'), blogData);
        blogId = docRef.id;
        setEditingBlogId(blogId);
      }
      
      if (isPublished && blogId) {
         const publicSourcesRef = collection(db, 'publicSources');
         const q = query(publicSourcesRef, where('blogId', '==', blogId));
         const snapshot = await getDocs(q);
         
         // Fetch user profile for bio, images and language
         let authorBio = '';
         let authorDetailedBio = '';
         let authorAvatar = '';
         let authorBanner = '';
         let authorBannerOffset = 50;
         let authorSocialLink1 = '';
         let authorSocialLink2 = '';
         let authorName = auth.currentUser.displayName || 'Unknown';
         
         try {
           const userSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
           if (userSnap.exists()) {
             const userData = userSnap.data();
             authorBio = userData.bio || '';
             authorDetailedBio = userData.detailedBio || '';
             authorAvatar = userData.avatarUrl || '';
             authorBanner = userData.bannerUrl || '';
             authorBannerOffset = userData.bannerOffset !== undefined ? userData.bannerOffset : 50;
             authorSocialLink1 = userData.socialLink1 || '';
             authorSocialLink2 = userData.socialLink2 || '';
             blogLanguage = userData.blogLanguage || 'de';
             if (userData.displayName) {
               authorName = userData.displayName;
             }
           }
         } catch (err) {
           console.error("Error fetching author profile:", err);
         }
         
         const publicData = {
              title,
              slug,
              url: getCanonicalOrigin() + '/blogs/user/' + auth.currentUser.uid + '/p/' + slug,
              category: 'Blogs',
              type: 'blogs',
              imageUrl: coverImage,
              coverImageOffset,
              addedBy: auth.currentUser.uid,
              authorName,
              authorBio,
              authorDetailedBio,
              authorAvatar,
              authorBanner,
              authorBannerOffset,
              authorSocialLink1,
              authorSocialLink2,
              language: blogLanguage,
              addedAt: new Date().toISOString(),
              blogId,
              translations: translations || {}
            };
         
         console.log("DEBUG: Publishing blog to publicSources:", blogId, publicData);

         if (!snapshot.empty) {
             const docToUpdate = snapshot.docs[0];
             await updateDoc(doc(db, 'publicSources', docToUpdate.id), publicData);
             console.log("DEBUG: Updated existing public source");
         } else {
             await addDoc(publicSourcesRef, publicData);
             console.log("DEBUG: Added new public source");
         }
      }
      
      setIsLoadedPublished(isPublished);
      loadBlogs();
      await showAlert(
        tr(settings.language, isPublished ? "Blog post saved successfully! Your post is now live." : "Blog post saved as draft.", isPublished ? "Blog Beitrag erfolgreich gespeichert! Dein Beitrag ist jetzt live." : "Blog Beitrag als Entwurf gespeichert."),
        tr(settings.language, "Saved", "Gespeichert")
      );
    } catch(err) {
      console.error("error saving blog", err);
      await showAlert(
        tr(settings.language, "There was an error saving the blog.", "Es gab einen Fehler beim Speichern des Blogs."),
        tr(settings.language, "Error", "Fehler")
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishWithTranslation = async () => {
    if (!editor) return;
    const rawContent = editor.getHTML();
    const plainText = editor.getText();
    
    if (!title.trim()) {
      await showAlert(
        tr(settings.language, "Please enter a title first.", "Bitte gib zuerst einen Titel ein."),
        tr(settings.language, "Title Required", "Titel erforderlich")
      );
      return;
    }
    
    if (plainText.trim().length < 20) {
      await showAlert(
        tr(settings.language, "Please write some more content before translating.", "Bitte schreibe etwas mehr Inhalt, bevor du übersetzt."),
        tr(settings.language, "Content Too Short", "Inhalt zu kurz")
      );
      return;
    }

    if (!coverImage.trim()) {
      await showAlert(
        tr(settings.language, "To publish, you must provide a cover image.", "Um zu veröffentlichen, musst du ein Artikelbild angeben."),
        tr(settings.language, "Cover Image Required", "Artikelbild erforderlich")
      );
      return;
    }

    // Overflow protection: Check text length
    if (plainText.length > 10000) {
      await showAlert(
        tr(settings.language, "Content exceeds the 10,000 character limit for AI translation.", "Der Inhalt überschreitet das Limit von 10.000 Zeichen für die KI-Übersetzung."),
        tr(settings.language, "Limit Exceeded", "Limit überschritten")
      );
      return;
    }

    // Cooldown check (15 seconds)
    if (lastTranslationTime && Date.now() - lastTranslationTime < 15000) {
      const remaining = Math.ceil((15000 - (Date.now() - lastTranslationTime)) / 1000);
      await showAlert(
        tr(settings.language, `Please wait ${remaining} seconds before translating again.`, `Bitte warte noch ${remaining} Sekunden vor der nächsten Übersetzung.`),
        tr(settings.language, "Please Wait", "Bitte warten")
      );
      return;
    }

    const confirmMsg = tr(
      settings.language,
      "This will translate your post into all platform languages (DE/EN/FR/ES) using Gemini AI and publish it immediately.\n\nDo you want to proceed?",
      "Dein Beitrag wird per Gemini-KI in alle Plattform-Sprachen (DE/EN/FR/ES) übersetzt und anschließend direkt veröffentlicht.\n\nMöchtest du fortfahren?"
    );

    const confirmed = await showConfirm(
      confirmMsg,
      tr(settings.language, "Publish & Translate", "Veröffentlichen & Übersetzen"),
      tr(settings.language, "Translate & Publish Now", "Jetzt übersetzen & veröffentlichen")
    );
    if (!confirmed) return;

    setIsTranslating(true);
    try {
      // Determine blog language (source language) from profile or default
      let blogLanguage = 'de';
      try {
        const userSnap = await getDoc(doc(db, 'users', auth.currentUser!.uid));
        if (userSnap.exists()) {
          blogLanguage = userSnap.data().blogLanguage || 'de';
        }
      } catch (err) {
        console.error("Error fetching language for translation:", err);
      }

      // Filter target languages (translate to other languages)
      const targetLangs = ['de', 'en', 'fr', 'es'].filter(l => l !== blogLanguage);

      // Translate title and content in parallel!
      const [titleTranslations, contentTranslations] = await Promise.all([
        translateContent(title, targetLangs),
        translateContent(rawContent, targetLangs)
      ]);

      const newTranslations: Record<string, { title: string, content: string }> = { ...translations };
      
      targetLangs.forEach(lang => {
        newTranslations[lang] = {
          title: titleTranslations[lang] || title,
          content: contentTranslations[lang] || rawContent
        };
      });

      setTranslations(newTranslations);
      setLastTranslationTime(Date.now());
      
      // Auto-publish the post with the newly translated content!
      await handleSave(true, newTranslations);
    } catch (err: any) {
      console.error("AI Translation Error:", err);
      await showAlert(
        tr(
          settings.language,
          `Translation failed: ${err.message}`,
          `Übersetzung fehlgeschlagen: ${err.message}`
        ),
        tr(settings.language, "Translation Error", "Übersetzungsfehler")
      );
    } finally {
      setIsTranslating(false);
    }
  };

  const handleEdit = (blog: any) => {
    navigate('/blogs/write', { state: { blog } });
  };

  const handleDelete = async (blogId: string) => {
    if (!auth.currentUser) return;
    const confirmed = await showConfirm(
      tr(settings.language, "Do you really want to delete this blog post?", "Möchtest du diesen Blog-Beitrag wirklich löschen?"),
      tr(settings.language, "Delete Post", "Beitrag löschen"),
      tr(settings.language, "Delete", "Löschen")
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'users', auth.currentUser.uid, 'blogs', blogId));
      loadBlogs();
      await showAlert(
        tr(settings.language, "Blog post deleted successfully.", "Blog-Beitrag erfolgreich gelöscht."),
        tr(settings.language, "Success", "Erfolg")
      );
    } catch(err) {
      console.error("error deleting blog", err);
      await showAlert(
        tr(settings.language, "There was an error deleting the blog.", "Es gab einen Fehler beim Löschen des Blogs."),
        tr(settings.language, "Error", "Fehler")
      );
    }
  };

  const compressImage = (file: File, maxDim = 1200): Promise<Blob | File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = document.createElement('img');
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
              if (blob) {
                if (blob.size >= file.size) {
                  resolve(file);
                } else {
                  resolve(blob);
                }
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (file: File) => {
    if (!auth.currentUser) return null;
    const storageRef = ref(storage, `blogs/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
    const compressedFile = await compressImage(file);
    const snapshot = await uploadBytes(storageRef, compressedFile);
    return await getDownloadURL(snapshot.ref);
  };

  const mainContent = (
    <div className={`flex flex-col w-full relative ${isArticle ? 'min-h-screen' : 'h-full overflow-hidden'}`}>
      <div className={`flex-1 ${isArticle ? '' : 'overflow-y-auto hide-scrollbar'}`}>
        {isSubscribed ? (
           <RssPage type="blogs" />
        ) : isArticle ? (
          <div className="flex-1 overflow-y-auto">
            {isArticleLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-12 h-12 animate-spin text-yellow-500 mb-4" />
                <p className="opacity-50">{tr(settings.language, "Loading post...", "Lade Beitrag...")}</p>
              </div>
            ) : singleArticle ? (
              <div className="max-w-4xl mx-auto px-4 pt-2 md:pt-4 pb-8 md:pb-12 relative">
                {isInternal && hasHistory && (
                  <button 
                    onClick={() => navigate(-1)}
                    className={`mb-6 flex items-center gap-2 px-4 py-2 rounded-full transition-colors ${isDark ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'}`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    {tr(settings.language, 'Back', 'Zurück')}
                  </button>
                )}

                <div className="relative">
                  {/* Flag Bar (Language Switcher) */}
                  {availableLangs.length > 1 && (
                    <div className={`flex flex-row items-center justify-center gap-2 p-2.5 rounded-2xl border transition-all xl:absolute xl:right-[calc(100%+16px)] xl:top-6 xl:flex-col xl:w-16 xl:p-3 xl:mb-0 z-50 ${
                      isDark 
                        ? 'bg-neutral-900 border-white/10 text-white xl:bg-neutral-900/80 xl:backdrop-blur-md xl:shadow-2xl' 
                        : 'bg-white border-gray-200 text-gray-900 xl:bg-white/80 xl:backdrop-blur-md xl:shadow-xl shadow-gray-200/50'
                    } w-full mb-4`}>
                      {availableLangs.map((lang) => {
                        const { flag, label } = getLanguageLabel(lang, settings.language);
                        const isSelected = activeLang === lang;
                        return (
                          <button
                            key={lang}
                            onClick={() => setSelectedArticleLanguage(lang)}
                            className={`w-10 h-10 xl:w-11 xl:h-11 rounded-xl border flex items-center justify-center transition-all hover:-translate-y-0.5 shrink-0 ${
                              isSelected
                                ? 'bg-yellow-500 border-yellow-500 text-black shadow scale-105'
                                : isDark 
                                  ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white' 
                                  : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-black'
                            }`}
                            title={label}
                          >
                            <span className="text-lg xl:text-xl leading-none select-none">{flag}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Desktop Action Bar (Right side) */}
                  <div className={`hidden xl:flex xl:flex-col items-center justify-center gap-4 p-3 rounded-2xl border xl:absolute xl:left-[calc(100%+16px)] xl:top-6 xl:w-16 xl:shadow-2xl z-50 ${
                    isDark 
                      ? 'border-white/10 bg-neutral-900/80 backdrop-blur-md text-white' 
                      : 'border-gray-200 bg-white/80 backdrop-blur-md text-gray-900 shadow-xl shadow-gray-200/50'
                  }`}>
                    <div className="relative" ref={linkMenuRef}>
                      <button 
                        onClick={() => setShowLinkMenu(!showLinkMenu)}
                        className={`p-2.5 rounded-xl border flex items-center justify-center relative overflow-hidden transition-all hover:-translate-y-0.5 ${
                          showLinkMenu
                            ? 'bg-yellow-500 border-yellow-500 text-black'
                            : isDark 
                              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                              : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                        }`}
                        title={tr(activeLang, 'Share & Shortlink Options', 'Teilen & Kurzlink Optionen')}
                      >
                          <LinkIcon className="w-4 h-4" />
                      </button>

                      {/* Dropdown Menu expanding to the left */}
                      {showLinkMenu && (
                        <div className={`absolute right-[calc(100%+24px)] -top-3 z-[100] w-72 rounded-2xl border p-4 shadow-2xl ${
                          isDark 
                            ? 'border-white/10 bg-neutral-900 text-white' 
                            : 'border-gray-200 bg-white text-gray-900 shadow-xl shadow-gray-200/50'
                        }`}>
                          <div className="text-center py-1">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                              {tr(activeLang, 'Which language version?', 'Welche Sprachversion?')}
                            </p>
                            
                            {isShortening[singleArticle?.id] ? (
                              <div className="flex flex-col items-center justify-center py-3 gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                <span className="text-[11px] font-medium opacity-70">
                                  {tr(activeLang, 'Creating shortlink...', 'Erstelle Kurzlink...')}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-3">
                                {[
                                  { code: 'D', iso: 'de', flag: '🇩🇪', label: 'Deutsch' },
                                  { code: 'E', iso: 'en', flag: '🇬🇧', label: 'English' },
                                  { code: 'F', iso: 'fr', flag: '🇫🇷', label: 'Français' },
                                  { code: 'S', iso: 'es', flag: '🇪🇸', label: 'Español' }
                                ].map((l) => (
                                  <button
                                    key={l.code}
                                    onClick={() => handleFlagShareClick(l.code, l.iso)}
                                    className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl border text-xl transition-all hover:scale-110 active:scale-95 shadow-sm relative ${
                                      isDark 
                                        ? 'bg-neutral-800 border-white/10 hover:bg-neutral-700 hover:border-white/20 text-white' 
                                        : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
                                    }`}
                                    title={`${l.label} (${l.code})`}
                                  >
                                    <span>{l.flag}</span>
                                    <span className="text-[9px] font-bold opacity-60 mt-0.5">
                                      {currentUser && singleArticle?.authorId === currentUser.uid ? `+${l.code}` : l.code}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}

                            {copiedLang && (
                              <div className="text-xs text-green-500 font-bold mt-3 animate-pulse">
                                {tr(activeLang, 'Link copied!', 'Link kopiert!')}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={async () => {
                        const rssUrl = `${getCanonicalOrigin()}/api/rss/user/${singleArticle.authorId}`;
                        const ok = await copyTextToClipboard(rssUrl);
                        if (ok) {
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }
                      }}
                      className={`p-2.5 rounded-xl border flex items-center justify-center group/rss relative overflow-hidden transition-all hover:-translate-y-0.5 ${
                        isDark 
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                          : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                      }`}
                      title={tr(activeLang, 'Copy RSS Feed URL', 'RSS Feed URL kopieren')}
                    >
                        <Rss className="w-4 h-4" />
                        {copySuccess && (
                          <div className="absolute inset-0 bg-green-500 text-white flex items-center justify-center text-[8px] font-black">OK!</div>
                        )}
                    </button>

                    <button 
                      onClick={toggleTheme}
                      className={`p-2.5 rounded-xl border flex items-center justify-center transition-all hover:-translate-y-0.5 ${
                        isDark 
                          ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                          : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                      }`}
                      title={isDark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
                    >
                        {isDark ? <Sun className="w-4 h-4 text-white" /> : <Moon className="w-4 h-4 text-black" />}
                    </button>

                    {singleArticle.authorSocialLink1 && (
                       <a 
                          href={singleArticle.authorSocialLink1} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`p-2.5 rounded-xl border transition-all hover:-translate-y-0.5 flex items-center justify-center ${
                            isDark 
                              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                              : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                          }`}
                          title={new URL(singleArticle.authorSocialLink1).hostname}
                       >
                          {getSocialIcon(singleArticle.authorSocialLink1, true)}
                       </a>
                    )}

                    {singleArticle.authorSocialLink2 && (
                       <a 
                          href={singleArticle.authorSocialLink2} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`p-2.5 rounded-xl border transition-all hover:-translate-y-0.5 flex items-center justify-center ${
                            isDark 
                              ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                              : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                          }`}
                          title={new URL(singleArticle.authorSocialLink2).hostname}
                       >
                          {getSocialIcon(singleArticle.authorSocialLink2, true)}
                       </a>
                    )}
                  </div>

                  <div className={`relative overflow-hidden rounded-3xl border ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'}`}>
                    {singleArticle.coverImage && (
                      <div className="w-full aspect-[21/9] overflow-hidden relative border-b border-gray-200 dark:border-white/10">
                        <img 
                          src={singleArticle.coverImage} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          referrerPolicy="no-referrer" 
                          style={{ objectPosition: `50% ${singleArticle.coverImageOffset !== undefined ? singleArticle.coverImageOffset : 50}%` }}
                        />
                      </div>
                    )}

                  {/* Author Header Section (Formerly footer card, now at top) */}
                  <div className={`relative overflow-hidden group border-b transition-colors ${
                    isDark 
                      ? 'bg-neutral-950 text-white border-white/10' 
                      : 'bg-gray-50 text-gray-900 border-gray-200'
                  }`}>
                      <div className="relative px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-6">
                          <div 
                              className="flex items-center gap-5 cursor-pointer group/author"
                              onClick={() => {
                                if (!singleArticle.authorId) return;
                                const profileUrl = `/blogs/author/${singleArticle.authorId}`;
                                navigate(profileUrl, { state: { internal: true } });
                              }}
                          >
                              <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-yellow-500 shrink-0">
                                  {singleArticle.authorAvatar ? (
                                    <img src={singleArticle.authorAvatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-yellow-500 flex items-center justify-center text-black font-bold">
                                      {singleArticle.authorName?.charAt(0).toUpperCase()}
                                    </div>
                                  )}
                              </div>
                              <div>
                                  <h4 className="font-black text-sm uppercase tracking-tight group-hover/author:underline">{singleArticle.authorName}</h4>
                                  <p className={`text-[10px] uppercase font-black tracking-widest ${isDark ? 'opacity-40' : 'opacity-60'}`}>
                                    {singleArticle.createdAt?.toDate ? new Date(singleArticle.createdAt.toDate()).toLocaleDateString() : 'Vor kurzem'}
                                  </p>
                              </div>
                          </div>



                          {/* Mobile-only Icon Bar (Hidden on desktop xl:) */}
                          <div className="flex xl:hidden flex-wrap items-center justify-center gap-3">
                              <div className="relative" ref={mobileLinkMenuRef}>
                                <button 
                                  onClick={() => setShowLinkMenu(!showLinkMenu)}
                                  className={`p-3 rounded-xl border flex items-center justify-center relative overflow-hidden transition-all hover:-translate-y-1 ${
                                    showLinkMenu
                                      ? 'bg-yellow-500 border-yellow-500 text-black'
                                      : isDark 
                                        ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                                        : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                                  }`}
                                  title={tr(activeLang, 'Share & Shortlink Options', 'Teilen & Kurzlink Optionen')}
                                >
                                    <LinkIcon className="w-5 h-5" />
                                </button>
                                
                                {/* Dropdown Menu for mobile expanding leftwards/aligned */}
                                {showLinkMenu && (
                                  <div className={`absolute right-0 top-14 z-[100] w-72 rounded-2xl border p-4 shadow-2xl ${
                                    isDark 
                                      ? 'border-white/10 bg-neutral-900 text-white' 
                                      : 'border-gray-200 bg-white text-gray-900 shadow-xl shadow-gray-200/50'
                                  }`}>
                                    <div className="text-center py-1">
                                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-3">
                                        {tr(activeLang, 'Which language version?', 'Welche Sprachversion?')}
                                      </p>
                                      
                                      {isShortening[singleArticle?.id] ? (
                                        <div className="flex flex-col items-center justify-center py-3 gap-2">
                                          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                                          <span className="text-[11px] font-medium opacity-70">
                                            {tr(activeLang, 'Creating shortlink...', 'Erstelle Kurzlink...')}
                                          </span>
                                        </div>
                                      ) : (
                                        <div className="flex items-center justify-center gap-3">
                                          {[
                                            { code: 'D', iso: 'de', flag: '🇩🇪', label: 'Deutsch' },
                                            { code: 'E', iso: 'en', flag: '🇬🇧', label: 'English' },
                                            { code: 'F', iso: 'fr', flag: '🇫🇷', label: 'Français' },
                                            { code: 'S', iso: 'es', flag: '🇪🇸', label: 'Español' }
                                          ].map((l) => (
                                            <button
                                              key={l.code}
                                              onClick={() => handleFlagShareClick(l.code, l.iso)}
                                              className={`w-12 h-12 flex flex-col items-center justify-center rounded-2xl border text-xl transition-all hover:scale-110 active:scale-95 shadow-sm relative ${
                                                isDark 
                                                  ? 'bg-neutral-800 border-white/10 hover:bg-neutral-700 hover:border-white/20 text-white' 
                                                  : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300 text-gray-700'
                                              }`}
                                              title={`${l.label} (${l.code})`}
                                            >
                                              <span>{l.flag}</span>
                                              <span className="text-[9px] font-bold opacity-60 mt-0.5">
                                                {currentUser && singleArticle?.authorId === currentUser.uid ? `+${l.code}` : l.code}
                                              </span>
                                            </button>
                                          ))}
                                        </div>
                                      )}

                                      {copiedLang && (
                                        <div className="text-xs text-green-500 font-bold mt-3 animate-pulse">
                                          {tr(activeLang, 'Link copied!', 'Link kopiert!')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              <button 
                                onClick={async () => {
                                  const rssUrl = `${getCanonicalOrigin()}/api/rss/user/${singleArticle.authorId}`;
                                  const ok = await copyTextToClipboard(rssUrl);
                                  if (ok) {
                                    setCopySuccess(true);
                                    setTimeout(() => setCopySuccess(false), 2000);
                                  }
                                }}
                                className={`p-3 rounded-xl border flex items-center justify-center group/rss relative overflow-hidden transition-all hover:-translate-y-1 ${
                                  isDark 
                                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                                    : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                                }`}
                                title={tr(activeLang, 'Copy RSS Feed URL', 'RSS Feed URL kopieren')}
                              >
                                  <Rss className="w-5 h-5" />
                                  {copySuccess && (
                                    <div className="absolute inset-0 bg-green-500 text-white flex items-center justify-center text-[8px] font-black">OK!</div>
                                  )}
                              </button>

                              <button 
                                onClick={toggleTheme}
                                className={`p-3 rounded-xl border flex items-center justify-center transition-all hover:-translate-y-1 ${
                                  isDark 
                                    ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                                    : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                                }`}
                                title={isDark ? "Hellen Modus aktivieren" : "Dunklen Modus aktivieren"}
                              >
                                  {isDark ? <Sun className="w-5 h-5 text-white" /> : <Moon className="w-5 h-5 text-black" />}
                              </button>

                              {singleArticle.authorSocialLink1 && (
                                 <a 
                                    href={singleArticle.authorSocialLink1} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`p-3 rounded-xl border transition-all hover:-translate-y-1 ${
                                      isDark 
                                        ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                                        : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                                    }`}
                                    title={new URL(singleArticle.authorSocialLink1).hostname}
                                 >
                                    {getSocialIcon(singleArticle.authorSocialLink1, true)}
                                 </a>
                              )}

                              {singleArticle.authorSocialLink2 && (
                                 <a 
                                    href={singleArticle.authorSocialLink2} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`p-3 rounded-xl border transition-all hover:-translate-y-1 ${
                                      isDark 
                                        ? 'border-white/10 bg-white/5 hover:bg-white/10 text-white' 
                                        : 'border-gray-200 bg-gray-100 hover:bg-gray-200 text-black'
                                    }`}
                                    title={new URL(singleArticle.authorSocialLink2).hostname}
                                 >
                                    {getSocialIcon(singleArticle.authorSocialLink2, true)}
                                 </a>
                              )}
                          </div>
                      </div>
                  </div>

                  <div className="p-6 md:p-12">
                    <h1 className="text-2xl md:text-5xl font-black mb-8 leading-[1.1] tracking-tighter">
                      {displayContent.title}
                    </h1>

                    <div 
                      className={`prose ${isDark ? 'prose-invert' : ''} max-w-none 
                        prose-p:text-lg prose-p:leading-relaxed prose-p:opacity-90
                        prose-headings:font-black prose-headings:tracking-tight
                        prose-img:rounded-3xl prose-img:my-14 prose-img:mx-auto prose-img:w-full
                        prose-a:text-yellow-500 hover:prose-a:text-yellow-600 font-medium
                        prose-blockquote:border-yellow-500 prose-blockquote:bg-yellow-500/5 prose-blockquote:p-6 prose-blockquote:rounded-r-xl
                      `}
                      dangerouslySetInnerHTML={{ __html: normalizeLinks(displayContent.content) }}
                      onClick={(e) => handleInternalLinkClick(e, navigate)}
                    />

                    {/* Social Actions (Voting) */}
                    <div className={`mt-12 pt-8 border-t ${isDark ? 'border-white/10' : 'border-gray-100'} flex items-center justify-between`}>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => handleVote('up')}
                          disabled={isVoting}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                            userVote === 'up'
                              ? 'bg-green-500 text-white'
                              : isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <ThumbsUp className={`w-5 h-5 ${userVote === 'up' ? 'fill-current' : ''}`} />
                          <span className="font-bold">{votes.up}</span>
                        </button>
                        <button
                          onClick={() => handleVote('down')}
                          disabled={isVoting}
                          className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all ${
                            userVote === 'down'
                              ? 'bg-red-500 text-white'
                              : isDark ? 'bg-white/5 hover:bg-white/10 text-white border border-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                          }`}
                        >
                          <ThumbsDown className={`w-5 h-5 ${userVote === 'down' ? 'fill-current' : ''}`} />
                          <span className="font-bold">{votes.down}</span>
                        </button>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-50 text-sm font-bold uppercase tracking-wider">
                        <MessageCircle className="w-4 h-4" />
                        {comments.length} {tr(settings.language, 'Comments', 'Kommentare')}
                      </div>
                    </div>

                    {/* Comments Section */}
                    <div className="mt-12 space-y-8">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase tracking-tight flex items-center gap-3">
                          {tr(settings.language, 'Discussion', 'Diskussion')}
                          <span className="text-sm px-2 py-0.5 rounded-md bg-yellow-500 text-black">{comments.length}</span>
                        </h3>
                      </div>

                      {/* Comment Form */}
                      {auth.currentUser ? (
                        (userPlan === 'monthly' || userPlan === 'yearly' || auth.currentUser.uid === singleArticle.authorId) ? (
                          <form onSubmit={handleAddComment} className="relative">
                            <textarea
                              value={commentText}
                              onChange={(e) => setCommentText(e.target.value)}
                              placeholder={tr(settings.language, "Write a comment...", "Schreibe einen Kommentar...")}
                              className={`w-full p-4 rounded-2xl border min-h-[100px] transition-all focus:ring-2 focus:ring-yellow-500 outline-none resize-none ${
                                isDark ? 'bg-white/5 border-white/10 text-white placeholder:text-white/20' : 'bg-white border-gray-200 placeholder:text-gray-400'
                              }`}
                            />
                            <button
                              type="submit"
                              disabled={isCommentSubmitting || !commentText.trim()}
                              className="absolute bottom-4 right-4 p-2 bg-yellow-500 text-black rounded-xl hover:bg-yellow-600 disabled:opacity-50 disabled:hover:bg-yellow-500 transition-colors"
                            >
                              {isCommentSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                            </button>
                          </form>
                        ) : (
                          <div className={`p-6 rounded-2xl border ${isDark ? 'bg-yellow-500/5 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'} text-center`}>
                            <p className="font-bold mb-3">{tr(settings.language, "Only paying members can comment.", "Nur zahlende Mitglieder können kommentieren.")}</p>
                            <button 
                              onClick={() => navigate('/dashboard?showPricing=true')}
                              className="px-6 py-2 bg-yellow-500 text-black font-black rounded-full uppercase text-[10px] tracking-wider transition-transform hover:scale-105 active:scale-95"
                            >
                              {tr(settings.language, "Upgrade now", "Jetzt upgraden")}
                            </button>
                          </div>
                        )
                      ) : (
                        <div className={`p-8 rounded-3xl border text-center transition-all hover:scale-[1.01] ${isDark ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200'}`}>
                          <h4 className="text-lg font-black mb-2 tracking-tight">{tr(settings.language, "Join the discussion!", "Möchtest Du Dich an der Diskussion beteiligen?")}</h4>
                          <p className="opacity-60 mb-8 text-sm max-w-md mx-auto">{tr(settings.language, "Sign in or join RSSer to write comments and share your thoughts.", "Melde dich an oder tritt RSSer bei, um Kommentare zu schreiben und deine Gedanken zu teilen.")}</p>
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button 
                              onClick={() => navigate('/login')}
                              className={`w-full sm:w-auto px-8 py-3 rounded-full font-black uppercase text-[10px] tracking-[0.2em] transition-all hover:scale-105 active:scale-95 ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}
                            >
                              {tr(settings.language, "Sign In", "Anmelden")}
                            </button>
                            <button 
                              onClick={() => {
                                // Link to Landingpage (Prices)
                                const landingUrl = `${getCanonicalOrigin()}/#pricing`;
                                window.open(landingUrl, '_blank');
                              }}
                              className="w-full sm:w-auto px-8 py-3 bg-yellow-500 text-black rounded-full font-black uppercase text-[10px] tracking-[0.2em] hover:bg-yellow-600 transition-all hover:scale-105 active:scale-95"
                            >
                              {tr(settings.language, "Discover RSSer", "RSSer entdecken")}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Comments List */}
                      <div className="space-y-6 pt-4">
                        {comments.map((comment) => {
                          const effectiveAvatar = comment.userAvatar || commenterAvatars[comment.userId] || (auth.currentUser && comment.userId === auth.currentUser.uid ? auth.currentUser.photoURL : null);
                          const isAdmin = isAdminEmail(auth.currentUser?.email);

                          return (
                            <div key={comment.id} className={`flex gap-4 p-4 rounded-2xl transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}>
                              <div className="w-10 h-10 rounded-full overflow-hidden border border-yellow-500 shrink-0">
                                {effectiveAvatar ? (
                                  <img src={effectiveAvatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-yellow-500 flex items-center justify-center text-black font-bold text-sm">
                                    {comment.userName?.charAt(0).toUpperCase()}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-sm">{comment.userName}</span>
                                    <span className="text-[10px] opacity-40 uppercase font-black tracking-widest">
                                      {comment.timestamp?.toDate ? new Date(comment.timestamp.toDate()).toLocaleString() : tr(settings.language, 'Just now', 'Gerade eben')}
                                    </span>
                                  </div>

                                  {/* Admin Delete Action */}
                                  {isAdmin && (
                                    <div className="flex items-center gap-2">
                                      {deletingCommentId === comment.id ? (
                                        <div className="flex items-center gap-1.5 text-xs">
                                          <span className="opacity-60 text-[9px] uppercase font-bold tracking-wider">{tr(settings.language, "Delete?", "Löschen?")}</span>
                                          <button 
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="px-2 py-0.5 rounded bg-red-600 text-white font-bold hover:bg-red-700 transition-colors text-[9px] uppercase"
                                          >
                                            {tr(settings.language, "Yes", "Ja")}
                                          </button>
                                          <button 
                                            onClick={() => setDeletingCommentId(null)}
                                            className="px-2 py-0.5 rounded bg-neutral-500 text-white font-bold hover:bg-neutral-600 transition-colors text-[9px] uppercase"
                                          >
                                            {tr(settings.language, "No", "Nein")}
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setDeletingCommentId(comment.id)}
                                          className="p-1.5 rounded-lg text-neutral-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                          title={tr(settings.language, "Delete Comment", "Kommentar löschen")}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <p className={`text-sm leading-relaxed opacity-90 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                                  {comment.text}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                        {comments.length === 0 && (
                          <div className="py-12 text-center opacity-30 italic font-medium">
                            {tr(settings.language, "No comments yet. Be the first to share your thoughts!", "Noch keine Kommentare. Sei der Erste, der seine Gedanken teilt!")}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Simple Dark Footer */}
                  <div className={`relative overflow-hidden py-12 px-8 flex flex-col items-center justify-center text-center gap-4 ${isDark ? 'bg-black/40 border-t border-white/5' : 'bg-gray-900 text-white'}`}>
                    {/* Banner background strip in footer */}
                    <div className="absolute inset-0 opacity-[0.1] pointer-events-none">
                      {singleArticle.authorBanner && (
                        <img 
                          src={singleArticle.authorBanner} 
                          alt="" 
                          className="w-full h-full object-cover" 
                          style={{ objectPosition: `50% ${singleArticle.authorBannerOffset !== undefined ? singleArticle.authorBannerOffset : 50}%` }}
                        />
                      )}
                    </div>
                    
                    <div className="relative z-10 flex flex-col items-center justify-center text-center gap-4">
                      <a 
                        href="https://rsser.news" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="flex items-center gap-2 mb-2 group transition-transform hover:scale-105"
                      >
                         <div className="w-8 h-8 rounded-lg bg-[#FF4500] flex items-center justify-center text-white">
                           <Rss className="w-4 h-4" />
                         </div>
                         <span className="font-black tracking-tighter text-lg">RSSer</span>
                      </a>
                      <p className="text-xs uppercase font-black tracking-[0.3em] opacity-40">{tr(settings.language, "YOUR FEED, YOUR RULES.", "DEIN FEED, DEINE REGELN.")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                 <X className="w-16 h-16 text-red-500 mb-4 opacity-20" />
                 <h2 className="text-xl font-bold">{tr(settings.language, "Post not found", "Beitrag nicht gefunden")}</h2>
                 <p className="opacity-50">{tr(settings.language, "This post does not exist or has been deleted.", "Dieser Beitrag existiert nicht oder wurde gelöscht.")}</p>
                 <button onClick={() => navigate('/blogs', { state: { internal: true } })} className="mt-6 px-6 py-2 bg-yellow-500 text-black font-bold rounded-full">
                    {tr(settings.language, "To Blog Overview", "Zur Blog-Übersicht")}
                 </button>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 md:p-8 max-w-[2400px] mx-auto flex flex-col gap-8">
            {isWrite ? (
              isProfileLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Loader2 className="w-12 h-12 animate-spin text-yellow-500 mb-4" />
                  <p className="opacity-50">{tr(settings.language, "Checking profile...", "Überprüfe Profil...")}</p>
                </div>
              ) : !canWriteBlog ? (
                <div className={`p-12 rounded-[2.5rem] border text-center ${isDark ? 'bg-neutral-900 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-6 mx-auto">
                    <ShieldAlert className="w-10 h-10 text-orange-500" />
                  </div>
                  <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">Feature Restricted</h2>
                  <p className="text-gray-500 max-w-sm mx-auto mb-8 font-medium">{tr(settings.language, "Writing blog posts is reserved for paying members (Monthly/Yearly).", "Das Schreiben von Blog-Artikeln ist zahlenden Mitgliedern (Monatlich/Jährlich) vorbehalten.")}</p>
                  <button 
                    onClick={() => {
                      window.location.hash = 'pricing';
                      window.location.href = '/#pricing';
                    }}
                    className="px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 mx-auto"
                  >
                    <Zap className="w-5 h-5 fill-white" />
                    {tr(settings.language, "Upgrade Now", "Jetzt Upgraden")}
                  </button>
                </div>
              ) : !hasCompleteProfile ? (
                <div className={`p-12 rounded-[2.5rem] border text-center ${isDark ? 'bg-neutral-900 border-white/10' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="w-20 h-20 rounded-full bg-yellow-500/10 flex items-center justify-center mb-6 mx-auto">
                    <UserCheck className="w-10 h-10 text-yellow-500" />
                  </div>
                  <h2 className="text-3xl font-black mb-4 uppercase tracking-tighter">
                    {tr(settings.language, "Profile Required", "Profil erforderlich")}
                  </h2>
                  <p className="text-gray-500 max-w-md mx-auto mb-8 font-medium">
                    {tr(settings.language, "Before you can write and publish blog articles, you must set up your author profile (Name & Biography).", "Bevor du Blog-Artikel verfassen und veröffentlichen kannst, musst du zuerst dein Autoren-Profil einrichten (Name & Kurzbeschreibung).")}
                  </p>
                  <button 
                    onClick={() => navigate('/profile')}
                    className="px-10 py-4 bg-yellow-500 hover:bg-yellow-600 text-black rounded-2xl font-black uppercase tracking-widest transition-all active:scale-95 flex items-center gap-3 mx-auto"
                  >
                    <User className="w-5 h-5" />
                    {tr(settings.language, "Set up Profile Now", "Profil jetzt einrichten")}
                  </button>
                </div>
              ) : (
                <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">
                  <div className={`flex flex-col border ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'} rounded-3xl overflow-hidden relative`}>

            {coverImage ? (
              <div className="flex flex-col relative">
                <div 
                  className={`relative w-full h-48 md:h-64 rounded-t-xl overflow-hidden group ${coverImage ? 'cursor-ns-resize' : ''}`}
                  onMouseDown={(e) => {
                    if (!coverImage) return;
                    setIsDragging(true);
                    setStartY(e.clientY);
                    setStartOffset(coverImageOffset);
                  }}
                  onMouseMove={(e) => {
                    if (!isDragging) return;
                    const deltaY = e.clientY - startY;
                    const containerHeight = e.currentTarget.clientHeight;
                    const percentageChange = (deltaY / containerHeight) * 100;
                    const newOffset = Math.max(0, Math.min(100, startOffset - percentageChange));
                    setCoverImageOffset(newOffset);
                  }}
                  onMouseUp={() => setIsDragging(false)}
                  onMouseLeave={() => setIsDragging(false)}
                  onTouchStart={(e) => {
                    if (!coverImage) return;
                    setIsDragging(true);
                    setStartY(e.touches[0].clientY);
                    setStartOffset(coverImageOffset);
                  }}
                  onTouchMove={(e) => {
                    if (!isDragging) return;
                    const deltaY = e.touches[0].clientY - startY;
                    const containerHeight = e.currentTarget.clientHeight;
                    const percentageChange = (deltaY / containerHeight) * 100;
                    const newOffset = Math.max(0, Math.min(100, startOffset - percentageChange));
                    setCoverImageOffset(newOffset);
                  }}
                  onTouchEnd={() => setIsDragging(false)}
                >
                  <img 
                    src={coverImage} 
                    alt="Cover" 
                    className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-700 group-hover:scale-105" 
                    referrerPolicy="no-referrer" 
                    style={{ objectPosition: `50% ${coverImageOffset}%` }}
                  />
                  {/* Language status flags overlay in top-left corner of the Cover Image container */}
                  <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 flex-wrap">
                    {['de', 'en', 'fr', 'es'].map(lang => {
                      const isSource = lang === (userProfile as any)?.blogLanguage || (lang === 'de' && !(userProfile as any)?.blogLanguage);
                      const isTranslated = isSource || !!translations[lang];
                      return (
                        <div 
                          key={lang} 
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md transition-all shadow-sm ${
                            isSource 
                              ? 'bg-yellow-500/90 text-black border-yellow-400/30' 
                              : isTranslated 
                                ? 'bg-black/60 text-white border-green-500/40' 
                                : 'bg-black/60 text-white/40 border-white/10'
                          }`}
                          title={
                            isSource 
                              ? tr(settings.language, 'Original Language', 'Originalsprache')
                              : isTranslated 
                                ? tr(settings.language, 'Translated', 'Übersetzt') 
                                : tr(settings.language, 'Not translated yet', 'Noch nicht übersetzt')
                          }
                        >
                          <span className="text-sm">
                            {getLanguageLabel(lang, settings.language).flag}
                          </span>
                          <span className="uppercase text-[9px] tracking-wider">{lang}</span>
                          {!isSource && isTranslated && <Check className="w-3 h-3 stroke-[3] text-green-400" />}
                        </div>
                      );
                    })}
                  </div>

                  {/* COVER UPLOAD BUTTON - TOP RIGHT (NEXT TO TRASH) */}
                  {!isDragging && (
                    <div 
                      className="absolute top-4 right-14 z-40 opacity-0 group-hover:opacity-100 transition-opacity"
                      onMouseDown={e => e.stopPropagation()}
                      onTouchStart={e => e.stopPropagation()}
                    >
                      <label className="flex items-center gap-2 px-3.5 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-white cursor-pointer hover:bg-black/80 transition-colors border border-white/20">
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-[10px] uppercase font-black tracking-widest">
                          {tr(settings.language, 'Change', 'Ändern')}
                        </span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              try {
                                const url = await handleImageUpload(file);
                                if (url) setCoverImage(url);
                              } catch (err) {
                                console.error(err);
                                await showAlert(
                                  tr(settings.language, "Error uploading image. Please try another image.", "Fehler beim Hochladen des Bildes. Bitte versuche ein anderes Bild."),
                                  tr(settings.language, "Upload Error", "Upload-Fehler")
                                );
                              }
                            }
                          }} 
                        />
                      </label>
                    </div>
                  )}

                  {coverImage && !isDragging && (
                    <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-[9px] font-black px-3 py-1.5 rounded-full text-white/70 uppercase tracking-[0.2em] pointer-events-none">
                       {tr(settings.language, 'Drag to reposition image', 'Ziehen zum Neupositionieren')}
                    </div>
                  )}

                  {!isDragging && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCoverImage('');
                      }}
                      className="absolute top-4 right-4 bg-black/50 hover:bg-red-500 text-white p-2 rounded-full transition-colors opacity-0 group-hover:opacity-100 z-40"
                      title={tr(settings.language, 'Remove cover image', 'Artikelbild entfernen')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div 
                className={`w-full h-48 md:h-64 rounded-t-xl flex flex-col items-center justify-center gap-3 border-b border-dashed relative ${isDark ? 'border-white/20 bg-white/5' : 'border-gray-300 bg-gray-50'}`}
              >
                {/* Language status flags overlay in top-left corner of the Cover Image placeholder */}
                <div className="absolute top-4 left-4 z-40 flex items-center gap-1.5 flex-wrap">
                  {['de', 'en', 'fr', 'es'].map(lang => {
                    const isSource = lang === (userProfile as any)?.blogLanguage || (lang === 'de' && !(userProfile as any)?.blogLanguage);
                    const isTranslated = isSource || !!translations[lang];
                    return (
                      <div 
                        key={lang} 
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border backdrop-blur-md transition-all shadow-sm ${
                          isSource 
                            ? 'bg-yellow-500/90 text-black border-yellow-400/30' 
                            : isTranslated 
                              ? 'bg-black/60 text-white border-green-500/40' 
                              : 'bg-black/60 text-white/40 border-white/10'
                        }`}
                        title={
                          isSource 
                            ? tr(settings.language, 'Original Language', 'Originalsprache')
                            : isTranslated 
                              ? tr(settings.language, 'Translated', 'Übersetzt') 
                              : tr(settings.language, 'Not translated yet', 'Noch nicht übersetzt')
                        }
                      >
                        <span className="text-sm">
                          {getLanguageLabel(lang, settings.language).flag}
                        </span>
                        <span className="uppercase text-[9px] tracking-wider">{lang}</span>
                        {!isSource && isTranslated && <Check className="w-3 h-3 stroke-[3] text-green-400" />}
                      </div>
                    );
                  })}
                </div>

                <div className={`p-4 rounded-full ${isDark ? 'bg-white/10' : 'bg-white'}`}>
                  <ImageIcon className={`w-8 h-8 ${isDark ? 'text-white/50' : 'text-gray-400'}`} />
                </div>
                <label className="bg-yellow-500 hover:bg-yellow-600 text-black px-6 py-2 rounded-full font-bold transition-all text-sm cursor-pointer">
                  {tr(settings.language, 'Add cover image', 'Artikelbild hinzufügen')}
                  <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      try {
                        const url = await handleImageUpload(file);
                        if (url) setCoverImage(url);
                      } catch (err) {
                        console.error(err);
                        await showAlert(
                          tr(settings.language, "Error uploading image. Please try another image.", "Fehler beim Hochladen des Bildes. Bitte versuche ein anderes Bild."),
                          tr(settings.language, "Upload Error", "Upload-Fehler")
                        );
                      }
                    }
                  }} />
                </label>
              </div>
            )}
            
            <div className="p-4 md:p-6 border-b border-gray-200 dark:border-white/10">
              <input 
                type="text" 
                placeholder={tr(settings.language, "Title of your post...", "Titel deines Beitrags...")} 
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`w-full text-lg md:text-xl font-bold bg-transparent outline-none tracking-tight leading-[1.2] ${isDark ? 'text-white placeholder:text-white/20' : 'text-gray-900 placeholder:text-gray-300'}`}
              />
            </div>
            
            {/* Action Buttons Panel (Replacing KI-Übersetzungs-Center) */}
            <div className="px-4 md:px-6 py-10 md:py-12 border-b border-gray-200 dark:border-white/10">
              <div className={`p-4 md:p-6 rounded-3xl border flex flex-col md:flex-row gap-4 items-center justify-between ${
                isDark ? 'bg-neutral-900/50 border-white/10' : 'bg-gray-50 border-gray-100'
              }`}>
                <div className="flex flex-col space-y-1.5 flex-1 w-full md:w-auto">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-yellow-500" />
                    <h4 className="font-extrabold text-sm md:text-base">
                      {tr(settings.language, "Publishing & Translations", "Veröffentlichung & Übersetzungen")}
                    </h4>
                  </div>
                  <p className={`text-xs ${isDark ? 'text-white/60' : 'text-gray-500'}`}>
                    {isLoadedPublished 
                      ? tr(settings.language, "This post is currently published in all languages.", "Dieser Beitrag ist aktuell in allen Sprachen veröffentlicht.")
                      : tr(settings.language, "This post is currently a draft. Publish to translate it with Gemini AI.", "Dieser Beitrag ist aktuell ein Entwurf. Veröffentliche ihn, um ihn per Gemini-KI zu übersetzen.")
                    }
                  </p>
                  
                  {/* Character count bar */}
                  <div className="text-[10px] opacity-60 font-medium">
                    {editor ? (
                      <>
                        {tr(settings.language, "Character count: ", "Zeichenanzahl: ")}
                        <span className={editor.getText().length > 10000 ? "text-red-500 font-bold" : "font-bold"}>
                          {editor.getText().length}
                        </span> / 10.000
                      </>
                    ) : (
                      tr(settings.language, "Loading Editor...", "Lade Editor...")
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto shrink-0 justify-end">
                  {/* Draft Button */}
                  <button 
                    onClick={() => handleSave(false)}
                    disabled={isSaving || isTranslating || !title.trim() || editor?.getText().trim() === ''}
                    className={`flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto ${
                      isDark 
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-white border border-white/10' 
                        : 'bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 shadow-sm'
                    }`}
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bookmark className="w-4 h-4" />}
                    {isLoadedPublished 
                      ? tr(settings.language, "Convert to Draft", "In Entwurf umwandeln") 
                      : tr(settings.language, "Save Draft", "Entwurf speichern")}
                  </button>

                  {/* Publish Button */}
                  <button 
                    onClick={handlePublishWithTranslation}
                    disabled={isSaving || isTranslating || !title.trim() || !editor || editor.getText().trim().length < 20}
                    className="flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-black px-7 py-3 rounded-full font-black text-sm transition-all disabled:opacity-50 shrink-0 w-full sm:w-auto shadow-md shadow-yellow-500/10 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isTranslating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {tr(settings.language, "Translating & Publishing...", "Übersetze & Veröffentliche...")}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        {isLoadedPublished 
                          ? tr(settings.language, "Update & Translate", "Aktualisieren & Übersetzen") 
                          : tr(settings.language, "Publish", "Veröffentlichen")}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sticky top-0 z-20">
              <MenuBar editor={editor} uploadImage={handleImageUpload} />
            </div>
            <div className={`w-full overflow-hidden border ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'} rounded-3xl`}>
                <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      ) ) : (
        <div className="max-w-[1400px] mx-auto w-full flex flex-col gap-8">
          <HeroBanner
            title={tr(settings.language, "My Posts", "Meine Beiträge")}
            description={tr(settings.language, "Here you find an overview of all your written posts.", "Hier findest du alle deine verfassten Beiträge in der Übersicht.")}
            icon={<ListIcon className="w-12 h-12 text-yellow-500" />}
            gradient="bg-yellow-500"
          />

          {auth.currentUser && (
            <div className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center gap-6 ${isDark ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-200'}`}>
              <div className={`p-4 rounded-full ${isDark ? 'bg-orange-500/10' : 'bg-orange-50'}`}>
                <Rss className="w-8 h-8 text-orange-500" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-bold text-lg mb-1">{tr(settings.language, "Your Public RSS Feed", "Dein öffentlicher RSS-Feed")}</h3>
                <p className="text-sm opacity-60 mb-3">{tr(settings.language, "Anyone can subscribe to your blog with this URL.", "Jeder kann deinen Blog mit dieser URL abonnieren.")}</p>
                <div className={`flex items-center gap-2 p-2 rounded-xl border ${isDark ? 'bg-black/20 border-white/10' : 'bg-gray-50 border-gray-200'} text-xs font-mono break-all`}>
                  <span className="flex-1 overflow-hidden text-ellipsis">
                    {getCanonicalOrigin()}/api/rss/user/{auth.currentUser.uid}
                  </span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(`${getCanonicalOrigin()}/api/rss/user/${auth.currentUser?.uid}`);
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                    }}
                    className="p-2 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors flex items-center gap-1 font-sans font-bold text-[10px] uppercase text-orange-500"
                  >
                    <LinkIcon className="w-3 h-3" />
                    {copySuccess ? tr(settings.language, "Copied!", "Kopiert!") : tr(settings.language, "Copy", "Kopieren")}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-yellow-500" />
            </div>
          ) : blogs.length > 0 ? (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-6">
                {blogs.map((blog) => {
                  const hasImage = !!blog.coverImage;
                  const blogDate = blog.createdAt?.toDate 
                    ? new Date(blog.createdAt.toDate()).toLocaleDateString() 
                    : (tr(settings.language, 'Recently', 'Vor kurzem'));
                    
                  // Strip HTML tags for clean description snippet
                  const cleanSnippet = blog.content 
                    ? blog.content.replace(/<[^>]*>?/gm, ' ')
                    : '';

                  return (
                    <div 
                      key={blog.id} 
                      className={`group relative overflow-hidden flex flex-col rounded-2xl border transition-all duration-300 hover:-translate-y-1 ${
                        isDark 
                          ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' 
                          : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'
                      }`}
                    >
                      {/* Image block (exactly like Image 2) */}
                      {hasImage ? (
                        <div className="aspect-video w-full overflow-hidden bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative glanz-image-container">
                          <img 
                            src={blog.coverImage} 
                            alt={blog.title} 
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                            referrerPolicy="no-referrer"
                          />
                          
                          {/* Flag Overlay top-left */}
                          {blog.language && (
                            <div className="absolute top-3 left-3 z-10 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-lg text-sm flex items-center justify-center leading-none border border-white/10">
                              {getLanguageLabel(blog.language, settings.language).flag}
                            </div>
                          )}
                          
                          {/* Published/Draft badge bottom-right (like SCHON GESEHEN) */}
                          <div className="absolute bottom-3 right-3 z-10">
                            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white border border-white/15 shadow-sm backdrop-blur-md ${
                              blog.published 
                                ? 'bg-green-600/75' 
                                : 'bg-orange-600/75'
                            }`}>
                              {blog.published ? tr(settings.language, 'Published', 'Veröffentlicht') : tr(settings.language, 'Draft', 'Entwurf')}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video w-full flex flex-col items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden">
                          <PenTool className="w-10 h-10 opacity-20" />
                          
                          {/* Published/Draft badge bottom-right */}
                          <div className="absolute bottom-3 right-3 z-10">
                            <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider text-white border border-white/15 shadow-sm backdrop-blur-md ${
                              blog.published 
                                ? 'bg-green-600/75' 
                                : 'bg-orange-600/75'
                            }`}>
                              {blog.published ? tr(settings.language, 'Published', 'Veröffentlicht') : tr(settings.language, 'Draft', 'Entwurf')}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Inner Content exactly like Image 2 */}
                      <div className="p-5 flex flex-col flex-1 gap-3">
                        {/* Author metadata row */}
                        <div className="flex justify-between items-center text-xs opacity-70">
                          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-yellow-600 dark:text-yellow-400">
                            {auth.currentUser?.photoURL ? (
                              <img 
                                src={auth.currentUser.photoURL} 
                                alt="" 
                                className="w-5 h-5 rounded-full object-cover border border-yellow-500/20" 
                                referrerPolicy="no-referrer" 
                              />
                            ) : (
                              <User className="w-5 h-5 opacity-60" />
                            )}
                            <span className="truncate max-w-[140px]">
                              {auth.currentUser?.displayName || 'Du'}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono opacity-60">{blogDate}</span>
                        </div>
                        
                        {/* Title */}
                        <h3 className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-gray-900'} group-hover:text-yellow-500 transition-colors line-clamp-2`}>
                          {blog.title}
                        </h3>
                        
                        {/* Snippet */}
                        {cleanSnippet && (
                          <p className={`text-xs opacity-60 line-clamp-2 leading-relaxed ${isDark ? 'text-neutral-300' : 'text-neutral-600'}`}>
                            {cleanSnippet}
                          </p>
                        )}
                        
                        {/* Translations list if any */}
                        {blog.translations && Object.keys(blog.translations).length > 0 ? (
                          <div className="flex items-center gap-1.5 pt-0.5 mt-auto h-7">
                            <span className="text-[9px] uppercase font-bold tracking-widest opacity-40 font-mono">
                              {tr(settings.language, 'Translations:', 'Übersetzungen:')}
                            </span>
                            <div className="flex gap-1">
                              {Object.keys(blog.translations).map(lang => (
                                <span 
                                  key={lang} 
                                  className="text-[11px] bg-neutral-100 dark:bg-white/5 border border-neutral-200/30 dark:border-white/5 px-1 rounded"
                                  title={getLanguageLabel(lang, settings.language).label}
                                >
                                  {getLanguageLabel(lang, settings.language).flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="h-7 mt-auto" />
                        )}

                        {/* Clicks Statistics for the post creator */}
                        <div className="flex items-center gap-2 mt-2 py-1.5 px-3 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-neutral-900/50 text-[10px] font-mono select-none w-full justify-between shrink-0">
                          <span title="Internal clicks" className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <span>📱</span> Int: <strong className={isDark ? 'text-white' : 'text-black'}>{(shortenedUrls[blog.id] && shortenedUrls[blog.id].internalClicks) || 0}</strong>
                          </span>
                          <span className="opacity-20">|</span>
                          <span title="External clicks" className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                            <span>🌐</span> Ext: <strong className={isDark ? 'text-white' : 'text-black'}>{(shortenedUrls[blog.id] && shortenedUrls[blog.id].externalClicks) || 0}</strong>
                          </span>
                          <span className="opacity-20">|</span>
                          <span title="Total clicks" className="flex items-center gap-1 text-orange-500 font-bold">
                            <span>📊</span> Total: <strong className="text-orange-500">{(shortenedUrls[blog.id] && shortenedUrls[blog.id].clicks) || 0}</strong>
                          </span>
                        </div>
                        
                        {/* Edit Action Button - ONLY EDIT BUTTON as requested */}
                        <div className="pt-2">
                          <button 
                            onClick={() => handleEdit(blog)} 
                            className={`w-full flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl transition-all duration-200 border cursor-pointer active:scale-95 ${
                              isDark 
                                ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700/50 hover:border-yellow-500/20' 
                                : 'bg-neutral-50 hover:bg-neutral-100 text-neutral-800 border-neutral-200/50 hover:border-yellow-500/20'
                            }`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{tr(settings.language, 'Edit', 'Bearbeiten')}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center py-20 text-center">
                 <PenTool className={`w-16 h-16 mb-4 ${isDark ? 'text-white/20' : 'text-gray-300'}`} />
                 <h3 className="text-xl font-bold mb-2">{tr(settings.language, 'No posts yet', 'Noch keine Beiträge')}</h3>
                 <p className={`${isDark ? 'text-white/50' : 'text-gray-500'}`}>{tr(settings.language, "You haven't written any blog posts yet.", "Du hast bisher noch keine Blogbeiträge verfasst.")}</p>
             </div>
          )}
        </div>
      )}
          </div>
        )}

        <LimitReachedModal 
          isOpen={limitModal.isOpen} 
          onClose={() => setLimitModal({ ...limitModal, isOpen: false })} 
          type={limitModal.type} 
        />
      </div>
    </div>
  );

  // If it's a standalone article view from outside, don't wrap in AppShell
  if (isArticle && !isInternal) {
    const bgImage = singleArticle?.coverImage;
    return (
      <div className={`min-h-screen relative ${isDark ? 'dark bg-[#0a0a0a] text-white' : 'bg-[#f8f9fa] text-gray-900'}`}>
        {bgImage && (
          <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden select-none">
            <img 
              src={bgImage} 
              alt="" 
              className="w-full h-full object-cover scale-105 filter blur-[6px] opacity-50 transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className={`absolute inset-0 ${isDark ? 'bg-[#0a0a0a]/75 backdrop-blur-[1px]' : 'bg-[#f8f9fa]/80 backdrop-blur-[1px]'}`} />
          </div>
        )}
        <div className="relative z-10 w-full min-h-screen">
          {mainContent}
        </div>
      </div>
    );
  }

  return <AppShell>{mainContent}</AppShell>;
}
