import data from '../locales/inline_translations.json';

export function tr(lang: string, enVal: string, deVal: string): string {
  if (lang === 'de') return deVal;
  if (lang === 'en') return enVal;
  
  const translations = (data as any)[enVal] || {};
  
  if (lang === 'fr') return translations.fr || enVal;
  if (lang === 'es') return translations.es || enVal;
  
  return enVal;
}
