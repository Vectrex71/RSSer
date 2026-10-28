import { useState, useEffect } from 'react';
import { ExternalLink, X, Globe } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { auth } from '../lib/firebase';
import { isAdminEmail } from '../lib/admin';

interface TranslationContent {
  badge: string;
  prefix: string;
  date: string;
  middle: string;
  suffix: string;
  closeTitle: string;
}

const TRANSLATIONS: Record<string, TranslationContent> = {
  de: {
    badge: 'Hinweis',
    prefix: 'Ab dem ',
    date: '13. November 2026',
    middle: ' zieht RSSer exklusiv auf ',
    suffix: ' um.',
    closeTitle: 'Hinweis ausblenden'
  },
  en: {
    badge: 'Notice',
    prefix: 'From ',
    date: 'November 13, 2026',
    middle: ', RSSer will move exclusively to ',
    suffix: '.',
    closeTitle: 'Dismiss notice'
  },
  es: {
    badge: 'Aviso',
    prefix: 'A partir del ',
    date: '13 de noviembre de 2026',
    middle: ', RSSer se trasladará exclusivamente a ',
    suffix: '.',
    closeTitle: 'Ocultar aviso'
  },
  fr: {
    badge: 'Information',
    prefix: 'À compter du ',
    date: '13 novembre 2026',
    middle: ', RSSer déménagera exclusivement sur ',
    suffix: '.',
    closeTitle: 'Masquer l\'avis'
  }
};

export function DomainMigrationNotice() {
  const { settings } = useSettings();
  const [dismissed, setDismissed] = useState(false);
  const [shouldShow, setShouldShow] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname.toLowerCase();
    const searchParams = new URLSearchParams(window.location.search);

    // 1. Force show via query param (?banner=1, ?preview_banner=true, ?migration=1)
    if (
      searchParams.has('banner') ||
      searchParams.has('preview_banner') ||
      searchParams.has('migration') ||
      searchParams.has('test')
    ) {
      setShouldShow(true);
      return;
    }

    // 2. Always show in preview, staging and development environments
    // This ensures you and testers can always see it immediately in AI Studio, localhost, and run.app
    const isDevOrPreview =
      hostname.includes('run.app') ||
      hostname.includes('localhost') ||
      hostname === '127.0.0.1' ||
      hostname.includes('0.0.0.0') ||
      hostname.includes('googleusercontent') ||
      hostname.includes('webcontainer') ||
      hostname.includes('cloudworkstations') ||
      hostname.includes('aistudio') ||
      window.location.port === '3000';

    if (isDevOrPreview) {
      setShouldShow(true);
      return;
    }

    // 3. In production: Always show when accessed via rsser.news
    if (
      hostname === 'rsser.news' ||
      hostname === 'www.rsser.news' ||
      hostname.endsWith('.rsser.news') ||
      hostname.includes('rsser.news')
    ) {
      setShouldShow(true);
      return;
    }

    // 4. On the destination domain (rsser.syn-labs.app):
    // If the logged-in user is admin (hj.wuethrich@gmail.com), allow seeing it for verification.
    // For normal external visitors on rsser.syn-labs.app in production, it is hidden by default.
    const currentUser = auth.currentUser;
    const isAdmin = currentUser?.email && isAdminEmail(currentUser.email);
    const hasAdminStorage = localStorage.getItem('rsser_logged_in') === 'true';

    if (hostname.includes('syn-labs.app')) {
      if (isAdmin || hasAdminStorage) {
        setShouldShow(true);
        return;
      }
      // Hidden for regular visitors who are already on the new destination domain
      setShouldShow(false);
      return;
    }

    // Default to visible for previewing
    setShouldShow(true);
  }, []);

  if (!shouldShow || dismissed) return null;

  const currentLang = settings?.language || 'de';
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.de;

  const handleDismiss = () => {
    setDismissed(true);
  };

  return (
    <aside
      aria-label="Domain Migration Notice"
      className="w-full bg-[#0b0d12] border-b border-amber-500/20 text-white z-[105] relative shrink-0 transition-all duration-300 select-none shadow-sm"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between sm:justify-center text-xs sm:text-sm font-normal">
        <div className="flex items-center justify-center flex-wrap gap-x-2 gap-y-1 text-center w-full sm:w-auto pr-6 sm:pr-0">
          {/* Notice Badge */}
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold tracking-wide uppercase bg-amber-400/10 text-amber-400 border border-amber-400/30 shrink-0">
            {t.badge}
          </span>

          {/* Migration text translated for current language */}
          <span className="text-gray-200 text-xs sm:text-sm">
            {t.prefix}
            <strong className="font-semibold text-white tracking-wide">
              {t.date}
            </strong>
            {t.middle}
            <a
              href="https://RSSer.syn-labs.app"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#38bdf8] hover:text-[#7dd3fc] underline underline-offset-2 font-medium inline-flex items-center gap-1 transition-colors group"
            >
              <span className="group-hover:underline">rsser.syn-labs.app</span>
              <ExternalLink className="w-3 h-3 inline shrink-0 opacity-80 group-hover:opacity-100" />
            </a>
            {t.suffix}
          </span>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={handleDismiss}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title={t.closeTitle}
          aria-label={t.closeTitle}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </aside>
  );
}
