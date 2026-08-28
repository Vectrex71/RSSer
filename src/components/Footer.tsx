import { tr } from '../lib/t';
import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';

export function Footer() {
  const { settings } = useSettings();
  const isEn = settings.language === 'en';
  return (
    <footer className="py-6 px-6 bg-gray-200 dark:bg-black text-gray-700 dark:text-gray-300 text-sm flex flex-col items-center justify-center gap-2 mt-auto">
      <div className="flex items-center gap-6">
        <Link to="/datenschutz" className="hover:text-[var(--brand-orange)]">{tr(settings.language, 'Privacy Policy', 'Datenschutz')}</Link>
        <Link to="/impressum" className="hover:text-[var(--brand-orange)]">{tr(settings.language, 'Imprint', 'Impressum')}</Link>
        <a href="https://www.hj-wuethrich.cv" target="_blank" rel="noopener noreferrer" title="HJ Wuethrich CV" className="hover:opacity-80 transition-opacity">
          <img src="/SynthekDesign.png" alt="Synthek Design" className="h-4 w-auto cursor-pointer" onError={(e) => { e.currentTarget.style.display='none'; e.currentTarget.parentElement!.innerHTML = '<span class="font-bold">CV</span>'; }} />
        </a>
      </div>
    </footer>
  );
}
