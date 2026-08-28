import de from '../locales/de.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import { useSettings } from '../context/SettingsContext';

const locales = {
  de,
  en,
  fr,
  es
};

export function useTranslation() {
  const { settings } = useSettings();
  
  const t = (key: string, fallback?: string) => {
    const lang = settings.language || 'de';
    // @ts-ignore
    const translations = locales[lang] || locales.de;
    // @ts-ignore
    return translations[key] || (de as any)[key] || fallback || key;
  };

  return { t };
}
