import React from 'react';
import { tr } from '../../lib/t';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';

export interface DiscoverFilterBarProps {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  selectedLanguage: string;
  onSelectLanguage: (lang: string) => void;
  sortBy: 'default' | 'abc' | 'subscribed';
  onSelectSort: (sort: 'default' | 'abc' | 'subscribed') => void;
  colorTheme?: 'orange' | 'purple' | 'red' | 'blue' | 'emerald' | 'yellow';
  totalCount?: number;
  hideLanguage?: boolean;
}

export const DiscoverFilterBar: React.FC<DiscoverFilterBarProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  selectedLanguage,
  onSelectLanguage,
  sortBy,
  onSelectSort,
  colorTheme = 'orange',
  totalCount,
  hideLanguage = false,
}) => {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const isDark = settings.theme === 'dark';

  const themeClasses = {
    orange: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-orange-600 dark:text-orange-400',
    },
    purple: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-purple-600 dark:text-purple-400',
    },
    red: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-red-600 dark:text-red-400',
    },
    blue: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-blue-600 dark:text-blue-400',
    },
    emerald: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-emerald-600 dark:text-emerald-400',
    },
    yellow: {
      activePill: 'bg-neutral-900 text-white dark:bg-white dark:text-black shadow-xs',
      badgeText: 'text-amber-600 dark:text-amber-400',
    },
  }[colorTheme];

  return (
    <div className="space-y-3 mb-6">
      {/* Category Pills Track */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {categories.map((cat, idx) => {
            const isSelected = selectedCategory === cat;
            const catStr = typeof cat === 'string' ? cat : String(cat);
            return (
              <button
                key={`cat-${catStr}-${idx}`}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all duration-150 ${
                  isSelected
                    ? themeClasses.activePill
                    : isDark
                    ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 text-neutral-300 hover:text-white border'
                    : 'border-gray-200 bg-white/70 hover:bg-white/85 text-slate-700 hover:text-slate-900 border'
                }`}
              >
                {t('cat-' + catStr, catStr)}
              </button>
            );
          })}
        </div>
      )}

      {/* Sub-toolbar: Languages & Sort Control */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Language Filter */}
        {!hideLanguage ? (
          <div className="flex items-center gap-1 flex-wrap">
            {['Alle', 'de', 'en', 'fr', 'es'].map((lang) => {
              const isSelected = selectedLanguage === lang;
              const label =
                lang === 'Alle'
                  ? t('cat-Alle', 'Alle')
                  : lang === 'de'
                  ? '🇩🇪 DE'
                  : lang === 'en'
                  ? '🇬🇧 EN'
                  : lang === 'fr'
                  ? '🇫🇷 FR'
                  : '🇪🇸 ES';

              return (
                <button
                  key={lang}
                  type="button"
                  onClick={() => onSelectLanguage(lang)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    isSelected
                      ? isDark
                        ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                        : 'bg-white text-slate-900 border border-slate-300 shadow-2xs'
                      : isDark
                      ? 'text-neutral-500 hover:text-neutral-300'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        ) : (
          <div />
        )}

        {/* Right Cluster: Results Counter + Sort Segment */}
        <div className="flex items-center gap-3 ml-auto">
          {typeof totalCount === 'number' && (
            <span className="text-xs font-medium text-neutral-400 dark:text-neutral-500 hidden sm:inline">
              {totalCount} {totalCount === 1 ? tr(settings.language, 'Source', 'Quelle') : tr(settings.language, 'Sources', 'Quellen')}
            </span>
          )}

          {/* Compact Sort Segmented Control */}
          <div
            className={`flex items-center rounded-lg p-0.5 border ${
              isDark
                ? 'bg-neutral-900 border-neutral-800'
                : 'bg-slate-100 border-slate-200'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectSort('default')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                sortBy === 'default'
                  ? isDark
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'bg-white text-slate-900 shadow-2xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tr(settings.language, 'Featured', 'Beliebt')}
            </button>
            <button
              type="button"
              onClick={() => onSelectSort('abc')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                sortBy === 'abc'
                  ? isDark
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'bg-white text-slate-900 shadow-2xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              A-Z
            </button>
            <button
              type="button"
              onClick={() => onSelectSort('subscribed')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                sortBy === 'subscribed'
                  ? isDark
                    ? 'bg-neutral-800 text-white shadow-xs'
                    : 'bg-white text-slate-900 shadow-2xs'
                  : isDark
                  ? 'text-neutral-400 hover:text-neutral-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {tr(settings.language, 'Subscribed', 'Abonniert')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
