import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';

export function WartelistePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div id="warteliste-container" className="flex-1 bg-white dark:bg-black pt-24 pb-12 px-6 flex items-center justify-center transition-colors duration-300">
      <div id="warteliste-card" className="max-w-xl w-full mx-auto bg-white dark:bg-[#0f172a] p-12 rounded-3xl border border-gray-200 dark:border-gray-800 text-center transition-colors duration-300">
        <h1 id="warteliste-title" className="text-4xl font-bold mb-6 text-black dark:text-white">Newsletter</h1>
        <p id="warteliste-desc" className="text-xl text-gray-700 dark:text-gray-300 mb-8">
          Melde dich hier für unseren <a href="/#warteliste-form" className="text-[var(--brand-orange)] underline">Newsletter</a> an, um keine Updates zu verpassen.
        </p>
        <div id="back-link-container" className="mt-8">
            <button 
              onClick={() => navigate('/')}
              className="inline-block bg-[var(--brand-orange)] text-white px-8 py-3 rounded-full font-bold hover:bg-orange-600 transition-colors"
            >
              {t('back-to-home')}
            </button>
        </div>
      </div>
    </div>
  );
}
