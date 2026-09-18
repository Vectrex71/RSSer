import React from 'react';
import { Play, Plus, Trash2, Edit3, Loader2, Check, User, ExternalLink, Radio as RadioIcon, Podcast as PodcastIcon, Youtube as YoutubeIcon, Camera as CameraIcon, Rss as RssIcon, FileText } from 'lucide-react';
import { tr } from '../../lib/t';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { getRootDomain } from '../../lib/utils';

export interface DiscoverCardProps {
  item: any;
  category: string;
  isAlreadyAdded: boolean;
  matchingItem?: any;
  isAdding?: boolean;
  isPreviewing?: boolean;
  isAdmin?: boolean;
  onAdd: (item: any, fallbackImage: string | null) => void;
  onDeleteUserSource: (id: string, isRadio: boolean) => void;
  onCardClick: (e: React.MouseEvent, item: any, isAlreadyAdded: boolean) => void;
  onEdit?: (item: any) => void;
  onDeletePublic?: (id: string) => void;
  onPreviewPodcast?: (url: string, title: string, img: string | null) => void;
  onPreviewRadio?: (url: string, title: string, img: string | null) => void;
  onAuthorClick?: (authorId: string) => void;
}

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

export const DiscoverCard: React.FC<DiscoverCardProps> = ({
  item,
  category,
  isAlreadyAdded,
  matchingItem,
  isAdding = false,
  isPreviewing = false,
  isAdmin = false,
  onAdd,
  onDeleteUserSource,
  onCardClick,
  onEdit,
  onDeletePublic,
  onPreviewPodcast,
  onPreviewRadio,
  onAuthorClick,
}) => {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const isDark = settings.theme === 'dark';

  // Compute domain & fallbacks
  const domain = item.url ? getRootDomain(item.url) : null;

  // Compute image based on category
  let calculatedImage: string | null = item.imageUrl || item.faviconUrl || null;

  if (category === 'webcams' && !calculatedImage && item.url) {
    const match = item.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    if (match && match[1]) {
      calculatedImage = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
    }
  }

  if (category === 'podcasts') {
    const lowerTitle = (item.title || '').toLowerCase();
    const lowerUrl = (item.url || '').toLowerCase();
    if (calculatedImage && typeof calculatedImage === 'string' && calculatedImage.includes('mza_11977799580453303866')) {
      calculatedImage = null;
    }
    if (!calculatedImage && (lowerTitle.includes('bits und so') || lowerTitle.includes('bitsundso') || lowerUrl.includes('bitsundso') || lowerUrl.includes('bits-und-so'))) {
      calculatedImage = "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/bf/16/da/bf16da2d-abfa-ee92-a16f-cb9629b35b67/mza_18047970425501861730.png/600x600bb.jpg";
    }
    if (calculatedImage && !calculatedImage.startsWith('/') && !calculatedImage.startsWith('data:') && !calculatedImage.startsWith('blob:') && !calculatedImage.includes('/api/image-proxy')) {
      const knownDirectHosts = [
        'mzstatic.com', 'ytimg.com', 'spotifycdn.com', 'megaphone.fm', 'libsyn.com', 
        'podigee.com', 'podigee.io', 'anchor.fm', 'acast.com', 'fireside.fm', 'blubrry.com', 
        'podbean.com', 'art19.com', 'audioboom.com', 'radiopublic.com', 'captivate.fm', 
        'transistor.fm', 'buzzsprout.com', 'castos.com', 'simplecast.com', 'rss.com', 
        'spreaker.com', 'pinecast.com', 'omnycontent.com', 'omny.fm', 'podiant.co', 
        'squarespace-cdn.com', 'wp.com', 'twimg.com', 'pbs.twimg.com', 'podcaster.de',
        'jiggyboy.com', 'letscast.fm', 'amazonaws.com', 'cloudfront.net', 'podcasts.com'
      ];
      if (!knownDirectHosts.some(host => calculatedImage?.toLowerCase().includes(host))) {
        calculatedImage = `/api/image-proxy?url=${encodeURIComponent(calculatedImage)}`;
      }
    }
  }

  if (!calculatedImage && domain) {
    calculatedImage = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  }

  // Accent color themes
  const accentTheme = {
    feeds: {
      text: 'text-orange-600 dark:text-orange-400',
      bgSubtle: 'bg-orange-50 dark:bg-orange-950/30',
      borderSubtle: 'border-orange-200/60 dark:border-orange-900/40',
      pill: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300',
      button: 'bg-orange-600 hover:bg-orange-700 text-white',
      hoverGlow: 'hover:border-orange-500/40 dark:hover:border-orange-400/30'
    },
    podcasts: {
      text: 'text-purple-600 dark:text-purple-400',
      bgSubtle: 'bg-purple-50 dark:bg-purple-950/30',
      borderSubtle: 'border-purple-200/60 dark:border-purple-900/40',
      pill: 'bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300',
      button: 'bg-purple-600 hover:bg-purple-700 text-white',
      hoverGlow: 'hover:border-purple-500/40 dark:hover:border-purple-400/30'
    },
    youtube: {
      text: 'text-red-600 dark:text-red-400',
      bgSubtle: 'bg-red-50 dark:bg-red-950/30',
      borderSubtle: 'border-red-200/60 dark:border-red-900/40',
      pill: 'bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-300',
      button: 'bg-red-600 hover:bg-red-700 text-white',
      hoverGlow: 'hover:border-red-500/40 dark:hover:border-red-400/30'
    },
    radio: {
      text: 'text-blue-600 dark:text-blue-400',
      bgSubtle: 'bg-blue-50 dark:bg-blue-950/30',
      borderSubtle: 'border-blue-200/60 dark:border-blue-900/40',
      pill: 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300',
      button: 'bg-blue-600 hover:bg-blue-700 text-white',
      hoverGlow: 'hover:border-blue-500/40 dark:hover:border-blue-400/30'
    },
    webcams: {
      text: 'text-emerald-600 dark:text-emerald-400',
      bgSubtle: 'bg-emerald-50 dark:bg-emerald-950/30',
      borderSubtle: 'border-emerald-200/60 dark:border-emerald-900/40',
      pill: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300',
      button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      hoverGlow: 'hover:border-emerald-500/40 dark:hover:border-emerald-400/30'
    },
    blogs: {
      text: 'text-amber-600 dark:text-amber-400',
      bgSubtle: 'bg-amber-50 dark:bg-amber-950/30',
      borderSubtle: 'border-amber-200/60 dark:border-amber-900/40',
      pill: 'bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
      button: 'bg-amber-500 hover:bg-amber-600 text-black font-semibold',
      hoverGlow: 'hover:border-amber-500/40 dark:hover:border-amber-400/30'
    }
  }[category] || {
    text: 'text-orange-600 dark:text-orange-400',
    bgSubtle: 'bg-orange-50 dark:bg-orange-950/30',
    borderSubtle: 'border-orange-200/60 dark:border-orange-900/40',
    pill: 'bg-orange-500/10 text-orange-600 dark:bg-orange-500/20 dark:text-orange-300',
    button: 'bg-orange-600 hover:bg-orange-700 text-white',
    hoverGlow: 'hover:border-orange-500/40 dark:hover:border-orange-400/30'
  };

  // Special Card Layout for Blogs
  if (category === 'blogs') {
    const authorName = item.authorName || item.title || 'Autor';
    const authorBio = item.authorBio || '';
    const authorAvatar = item.authorAvatar;
    const authorBanner = item.authorBanner;

    return (
      <div 
        onClick={(e) => onCardClick(e, item, isAlreadyAdded)}
        className={`group relative flex flex-col rounded-xl border transition-all duration-200 overflow-hidden ${
          isDark 
            ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' 
            : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'
        } ${isAlreadyAdded ? 'cursor-pointer' : ''}`}
      >
        {/* Banner Area */}
        <div 
          onClick={(e) => {
            if (item.addedBy && onAuthorClick) {
              e.preventDefault();
              e.stopPropagation();
              onAuthorClick(item.addedBy);
            }
          }}
          className="relative h-14 w-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 cursor-pointer"
        >
          {authorBanner ? (
            <img 
              loading="lazy" 
              src={authorBanner} 
              alt="" 
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
              referrerPolicy="no-referrer"
              style={{ objectPosition: `50% ${item.authorBannerOffset !== undefined ? item.authorBannerOffset : 50}%` }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-yellow-500/15" />
          )}

          {/* Language Flag Badge */}
          {item.language && (
            <div className="absolute top-1.5 left-1.5 z-10 bg-white/90 dark:bg-black/60 backdrop-blur-xs px-1.5 py-0.5 rounded-full text-[11px] shadow-xs">
              {getFlagEmoji(item.language)}
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="p-2.5 pt-0 flex flex-col flex-1 relative">
          {/* Avatar */}
          <div 
            onClick={(e) => {
              if (item.addedBy && onAuthorClick) {
                e.preventDefault();
                e.stopPropagation();
                onAuthorClick(item.addedBy);
              }
            }}
            className="w-9 h-9 -mt-4.5 rounded-full border-2 border-white dark:border-neutral-900 bg-white dark:bg-neutral-800 overflow-hidden shadow-xs shrink-0 cursor-pointer transition-transform group-hover:scale-105"
          >
            {authorAvatar ? (
              <img loading="lazy" src={authorAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold text-xs">
                {authorName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="mt-1 flex-1 min-w-0">
            <h4 
              onClick={(e) => {
                if (item.addedBy && onAuthorClick) {
                  e.preventDefault();
                  e.stopPropagation();
                  onAuthorClick(item.addedBy);
                }
              }}
              className={`font-semibold text-xs sm:text-sm truncate tracking-tight cursor-pointer hover:underline ${isDark ? 'text-neutral-100' : 'text-neutral-900'}`}
              title={authorName}
            >
              {authorName}
            </h4>
            <p className={`text-[11px] mt-0.5 line-clamp-1 leading-snug ${isDark ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {authorBio || tr(settings.language, 'Community Blog', 'Community Blog')}
            </p>
          </div>

          {/* Footer Action */}
          <div className="mt-2 pt-1.5 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate">
              {tr(settings.language, 'Blog', 'Blog')}
            </span>

            {isAlreadyAdded ? (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (matchingItem) onDeleteUserSource(matchingItem.id, false);
                }}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                title={tr(settings.language, "Unfollow", "Entfolgen")}
              >
                <Check className="w-4 h-4 hover:hidden" />
                <Trash2 className="w-4 h-4 hidden hover:inline" />
              </button>
            ) : (
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAdd(item, calculatedImage);
                }}
                disabled={isAdding}
                className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-amber-500 hover:bg-amber-600 text-black font-semibold transition-all active:scale-95 disabled:opacity-50"
                title={tr(settings.language, "Follow", "Folgen")}
              >
                {isAdding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-4 h-4 stroke-[2.5]" />}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Standard Clean Editorial Card Layout for Feeds, Podcasts, YouTube, Radio, Webcams
  const categoryLabel = item.category ? t('cat-' + item.category, item.category) : t('cat-' + category, category);
  const displayTitle = item.title || 'Ohne Titel';
  const displaySubtitle = category === 'podcasts' 
    ? (item.author || domain || 'Podcast') 
    : (domain || (category === 'webcams' ? 'WebCam Stream' : category === 'youtube' ? 'YouTube Kanal' : ''));

  return (
    <div 
      onClick={(e) => onCardClick(e, item, isAlreadyAdded)}
      className={`group relative flex items-center gap-3 rounded-2xl border transition-all duration-200 p-2.5 sm:p-3 ${
        isDark 
          ? 'border-white/10 bg-neutral-900/60 hover:bg-neutral-850 hover:border-white/20' 
          : 'border-gray-200/90 bg-white hover:bg-neutral-50/90 shadow-xs hover:shadow-sm'
      } ${accentTheme.hoverGlow} ${isAlreadyAdded ? 'cursor-pointer' : ''}`}
    >
      {/* Admin Action Buttons */}
      {isAdmin && (
        <div className="absolute -top-2 right-2 flex items-center gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-neutral-900/90 p-0.5 rounded-lg shadow-md">
          {onEdit && (
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onEdit({ 
                  ...item, 
                  isPublic: true, 
                  isRadio: item.type === 'radio' || item.isRadio,
                  isPodcast: item.type === 'podcasts' || category === 'podcasts' || item.isPodcast,
                  type: item.type || (category === 'podcasts' ? 'podcasts' : category === 'radio' ? 'radio' : category === 'youtube' ? 'youtube' : category === 'webcams' ? 'webcams' : 'feeds')
                }); 
              }} 
              className="p-1 rounded-md hover:bg-white/20 text-white transition-colors" 
              title="Bearbeiten"
            >
              <Edit3 className="w-3 h-3" />
            </button>
          )}
          {onDeletePublic && (
            <button 
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation(); 
                onDeletePublic(item.id); 
              }} 
              className="p-1 rounded-md bg-red-600 hover:bg-red-700 text-white transition-colors" 
              title={tr(settings.language, "Delete", "Löschen")}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Larger Favicon (48x48px) */}
      <div className="relative shrink-0">
        <div className="w-12 h-12 rounded-xl border border-neutral-200/80 dark:border-neutral-750 bg-white dark:bg-neutral-800 flex items-center justify-center overflow-hidden shadow-2xs">
          {calculatedImage ? (
            <img 
              loading="lazy" 
              src={calculatedImage} 
              alt="" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                const fallbackEl = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallbackEl) fallbackEl.style.display = 'flex';
              }}
            />
          ) : null}
          <div 
            className={`w-full h-full flex items-center justify-center font-bold text-base uppercase select-none ${accentTheme.text} ${accentTheme.bgSubtle}`}
            style={{ display: calculatedImage ? 'none' : 'flex' }}
          >
            {displayTitle.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Center Details: Title & Meta Line */}
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <h3 
          className={`font-semibold text-xs sm:text-sm leading-snug line-clamp-1 tracking-tight transition-colors ${
            isDark ? 'text-neutral-100 group-hover:text-white' : 'text-neutral-900 group-hover:text-black'
          }`} 
          title={displayTitle}
        >
          {displayTitle}
        </h3>
        
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400 min-w-0">
          {item.language && (
            <span className="text-xs select-none shrink-0" title={item.language}>
              {getFlagEmoji(item.language)}
            </span>
          )}
          <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded-md ${accentTheme.pill} shrink-0 truncate max-w-[85px]`}>
            {categoryLabel}
          </span>
          {displaySubtitle && (
            <span className="truncate opacity-80 shrink-1" title={displaySubtitle}>
              {displaySubtitle}
            </span>
          )}
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="shrink-0 flex items-center gap-1.5">
        {category === 'podcasts' && onPreviewPodcast && (
          <button 
            type="button"
            title="Folge vorhören" 
            disabled={isPreviewing} 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreviewPodcast(item.url, displayTitle, calculatedImage);
            }} 
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-950/40 transition-colors"
          >
            {isPreviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          </button>
        )}

        {category === 'radio' && onPreviewRadio && (
          <button 
            type="button"
            title="Radio abspielen" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onPreviewRadio(item.url, displayTitle, calculatedImage);
            }} 
            className="inline-flex items-center justify-center w-8 h-8 rounded-xl text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-950/40 transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        {isAlreadyAdded ? (
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (matchingItem) {
                onDeleteUserSource(matchingItem.id, category === 'radio');
              }
            }}
            className="group/btn inline-flex items-center justify-center w-8 h-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-600 dark:hover:text-red-400 transition-all shrink-0"
            title={tr(settings.language, "Remove / Unfollow", "Entfernen / Entfolgen")}
          >
            <Check className="w-4 h-4 group-hover/btn:hidden text-emerald-600 dark:text-emerald-400" />
            <Trash2 className="w-4 h-4 hidden group-hover/btn:inline text-red-600 dark:text-red-400" />
          </button>
        ) : (
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAdd(item, calculatedImage);
            }}
            disabled={isAdding}
            className={`inline-flex items-center justify-center w-8 h-8 rounded-xl transition-all active:scale-95 disabled:opacity-50 shrink-0 ${accentTheme.button}`}
            title={tr(settings.language, "Add / Follow", "Abonnieren")}
          >
            {isAdding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 stroke-[2.5]" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
