import React from 'react';
import { useSettings } from '../../context/SettingsContext';

interface HeroBannerProps {
  title: string;
  description: React.ReactNode;
  icon: React.ReactNode;
  gradient: string;
}

export function HeroBanner({ title, description, icon, gradient }: HeroBannerProps) {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  return (
    <div className={`w-full overflow-hidden relative mb-8 rounded-3xl ${isDark ? 'bg-neutral-900 border border-white/5' : 'bg-gray-50 border border-gray-100'}`}>
      {/* Background Graphic */}
      <div className={`absolute -right-20 -top-20 md:-right-10 md:-top-10 w-64 h-64 md:w-96 md:h-96 rounded-full blur-[80px] opacity-20 ${gradient}`} style={{pointerEvents: 'none'}} />
      <div className={`absolute -left-20 -bottom-20 md:-left-10 md:-bottom-10 w-64 h-64 md:w-96 md:h-96 rounded-full blur-[80px] opacity-10 ${gradient}`} style={{pointerEvents: 'none'}} />
      
      <div className="p-8 md:p-12 relative z-10 flex flex-col md:flex-row items-center gap-6 md:gap-12">
        <div className={`w-24 h-24 md:w-32 md:h-32 shrink-0 rounded-full flex items-center justify-center bg-white/10 backdrop-blur-md border ${isDark ? 'border-white/10' : 'border-black/5'}`}>
          {icon}
        </div>
        <div className="text-center md:text-left flex-1">
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-4">{title}</h1>
          <p className={`text-lg md:text-xl max-w-2xl ${isDark ? 'text-white/60' : 'text-gray-600'}`}>{description}</p>
        </div>
      </div>
    </div>
  );
}
