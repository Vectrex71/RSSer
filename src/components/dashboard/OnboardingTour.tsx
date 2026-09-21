import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { useSettings } from '../../context/SettingsContext';
import { useTranslation } from '../../hooks/useTranslation';
import { ChevronRight, ChevronLeft, X, Check } from 'lucide-react';

interface TourStep {
  targetId: string | null;
  placement: 'right' | 'bottom' | 'left' | 'center';
  title: {
    de: string;
    en: string;
    fr: string;
    es: string;
  };
  text: {
    de: string;
    en: string;
    fr: string;
    es: string;
  };
}

export function OnboardingTour() {
  const { settings, setSidebarVisible, setHasSeenTour } = useSettings();
  const lang = settings.language || 'de';
  const location = useLocation();
  
  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [tooltipSize, setTooltipSize] = useState({ width: 320, height: 180 });
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const steps: TourStep[] = [
    {
      targetId: null,
      placement: 'center',
      title: {
        de: 'Willkommen bei RSSer News! 🚀',
        en: 'Welcome to RSSer News! 🚀',
        fr: 'Bienvenue sur RSSer News ! 🚀',
        es: '¡Bienvenido a RSSer News! 🚀'
      },
      text: {
        de: 'Lass uns eine kurze interaktive Tour machen, um die wichtigsten Bereiche und Funktionen kennenzulernen. Es dauert nur eine Minute!',
        en: "Let's take a quick interactive tour to explore the main areas and features. It only takes a minute!",
        fr: "Faisons une courte visite interactive pour découvrir les principales zones et fonctionnalités. Cela ne prend qu'une minute !",
        es: 'Hagamos un breve recorrido interactivo para conocer las principales áreas y funciones. ¡Solo te llevará un minuto!'
      }
    },
    {
      targetId: 'sidebar-navigation',
      placement: 'right',
      title: {
        de: 'Deine Medien-Bibliothek 📚',
        en: 'Your Media Library 📚',
        fr: 'Votre bibliothèque multimédia 📚',
        es: 'Tu biblioteca de medios 📚'
      },
      text: {
        de: 'Hier findest du alle deine abonnierten Quellen, perfekt sortiert nach Kategorien: RSS-Feeds, Podcasts, YouTube-Kanäle und Radiosender!',
        en: 'Here you will find all your subscribed sources, perfectly organized by categories: RSS feeds, podcasts, YouTube channels, and radio stations!',
        fr: 'Ici vous trouverez toutes vos sources d\'abonnements, parfaitement organisées par catégories : flux RSS, podcasts, chaînes YouTube et stations de radio !',
        es: 'Aquí encontrarás todas tus fuentes suscritas, perfectamente organizadas por categorías: canales RSS, podcasts, canales de YouTube y estaciones de radio.'
      }
    },
    {
      targetId: 'discover-nav',
      placement: 'right',
      title: {
        de: 'Quellen organisieren 🔍',
        en: 'Organize Sources 🔍',
        fr: 'Organiser les sources 🔍',
        es: 'Organizar fuentes 🔍'
      },
      text: {
        de: 'Stöbere in unserer riesigen, kuratierten Sammlung aus globalen und lokalen Medien, um ganz einfach neue Feeds und Kanäle mit einem Klick zu abonnieren!',
        en: 'Browse our massive, curated collection of global and local media to easily subscribe to new feeds and channels with a single click!',
        fr: 'Parcourez notre vaste collection de médias mondiaux et locaux pour vous abonner facilement à de nouveaux flux et chaînes en un seul clic !',
        es: '¡Explora nuestra enorme colección seleccionada de medios globales y locales para suscribirte fácilmente a nuevas fuentes y canales con un solo clic!'
      }
    },
    {
      targetId: 'header-search',
      placement: 'bottom',
      title: {
        de: 'Globale Suche 🔎',
        en: 'Global Search 🔎',
        fr: 'Recherche globale 🔎',
        es: 'Búsqueda global 🔎'
      },
      text: {
        de: 'Suche blitzschnell nach bestimmten Stichworten in all deinen abonnierten Artikeln, Beiträgen oder direkt nach neuen Sendern und Podcasts.',
        en: 'Search lightning-fast for specific keywords across all your subscribed articles, posts, or look up new stations and podcasts directly.',
        fr: 'Recherchez à la vitesse de l\'éclair des mots-clés spécifiques dans tous vos articles abonnés, ou recherchez directement de nouvelles stations et podcasts.',
        es: 'Busca a la velocidad del rayo palabras clave específicas en todos tus artículos suscritos, o busca directamente nuevas estaciones y podcasts.'
      }
    },
    {
      targetId: 'theme-toggle',
      placement: 'bottom',
      title: {
        de: 'Tag- und Nachtmodus 🌗',
        en: 'Day & Night Mode 🌗',
        fr: 'Mode jour et nuit 🌗',
        es: 'Modo día y noche 🌗'
      },
      text: {
        de: 'Wechsle jederzeit ganz einfach zwischen unserem eleganten hellen Design und dem augenschonenden Dunkelmodus für die späten Stunden.',
        en: 'Easily switch at any time between our elegant light design and the eye-friendly dark mode for the late hours.',
        fr: 'Basculez facilement à tout moment entre notre design clair élégant et le mode sombre agréable pour les yeux pour les heures tardives.',
        es: 'Cambia fácilmente en cualquier momento entre nuestro elegante diseño claro y el modo oscuro para las horas nocturnas.'
      }
    },
    {
      targetId: 'news-button',
      placement: 'right',
      title: {
        de: 'Neuigkeiten & Updates 📢',
        en: 'News & Updates 📢',
        fr: 'Nouvelles & Mises à jour 📢',
        es: 'Noticias y actualizaciones 📢'
      },
      text: {
        de: 'Hier informieren wir dich regelmäßig über neue Features, praktische Updates und wichtige Systemankündigungen direkt von unserem Team.',
        en: 'Here we regularly inform you about new features, practical updates, and important system announcements directly from our team.',
        fr: 'Ici nous vous informons régulièrement des nouvelles fonctionnalités, des mises à jour pratiques et des annonces système importantes directement de notre équipe.',
        es: 'Aquí te informamos periódicamente sobre nuevas funciones, actualizaciones prácticas y anuncios importantes del sistema directamente de nuestro equipo.'
      }
    },
    {
      targetId: 'profile-menu',
      placement: 'bottom',
      title: {
        de: 'Profil & Einstellungen 👤',
        en: 'Profile & Settings 👤',
        fr: 'Profil & Paramètres 👤',
        es: 'Perfil y ajustes 👤'
      },
      text: {
        de: 'Passe die App an deine Vorlieben an: Wähle deine Startseite, importiere/exportiere OPML-Dateien oder kontaktiere den Support.',
        en: 'Customize the app to your preferences: choose your start page, import/export OPML files, or contact support.',
        fr: 'Personnalisez l\'application selon vos préférences : choisissez votre page de démarrage, importez/exportez des fichiers OPML ou contactez l\'assistance.',
        es: 'Personaliza la aplicación a tus preferencias: elige tu página de inicio, importa/exporta archivos OPML o contacta con soporte.'
      }
    },
    {
      targetId: null,
      placement: 'center',
      title: {
        de: 'Bereit zum Start! 🎉',
        en: 'Ready to Start! 🎉',
        fr: 'Prêt à démarrer ! 🎉',
        es: '¡Listo para empezar! 🎉'
      },
      text: {
        de: 'Du bist jetzt bestens vorbereitet. Genieße dein personalisiertes Nachrichtenerlebnis mit RSSer News! Bei Fragen steht dir unser Support jederzeit zur Verfügung.',
        en: 'You are now fully prepared. Enjoy your personalized news experience with RSSer News! If you have any questions, our support is always there to help.',
        fr: 'Vous êtes maintenant parfaitement préparé. Profitez de votre expérience d\'actualités personnalisée avec RSSer News ! Si vous avez des questions, notre support est toujours là pour vous aider.',
        es: 'Ya estás totalmente preparado. ¡Disfruta de tu experiencia de noticias personalizada con RSSer News! Si tienes alguna pregunta, nuestro soporte siempre estará para ayudarte.'
      }
    }
  ];

  const currentStep = steps[stepIndex];

  useEffect(() => {
    // Listen to manual start requests
    const handleStartTour = () => {
      setIsActive(true);
      setStepIndex(0);
    };
    window.addEventListener('start-onboarding-tour', handleStartTour);

    // Auto trigger for first-time users (delay slightly for beautiful initial experience)
    const hasSeen = settings.hasSeenTour || localStorage.getItem('rsser-tour-seen') === 'true';
    if (!hasSeen) {
      const timer = setTimeout(() => {
        const currentHasSeen = settings.hasSeenTour || localStorage.getItem('rsser-tour-seen') === 'true';
        if (!currentHasSeen) {
          setIsActive(true);
          setStepIndex(0);
        }
      }, 2500);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('start-onboarding-tour', handleStartTour);
      };
    }

    return () => window.removeEventListener('start-onboarding-tour', handleStartTour);
  }, [settings.hasSeenTour]);

  // Listen to pending tour requests on navigation
  useEffect(() => {
    if (sessionStorage.getItem('start-onboarding-tour-pending') === 'true') {
      sessionStorage.removeItem('start-onboarding-tour-pending');
      const timer = setTimeout(() => {
        setIsActive(true);
        setStepIndex(0);
      }, 700); // 700ms delay to allow page assets and layout to render fully
      return () => clearTimeout(timer);
    }
  }, [location.pathname]);

  // Programmatically manage sidebar open/close state during the tour
  useEffect(() => {
    if (!isActive) return;

    const sidebarSteps = ['sidebar-navigation', 'discover-nav', 'news-button'];
    const isSidebarStep = currentStep.targetId && sidebarSteps.includes(currentStep.targetId);

    if (isSidebarStep) {
      if (!settings.sidebarVisible) {
        setSidebarVisible(true);
      }
    } else {
      // For other steps, close the sidebar on mobile so the elements are clearly visible
      if (window.innerWidth < 768) {
        if (settings.sidebarVisible) {
          setSidebarVisible(false);
        }
      }
    }
  }, [stepIndex, isActive, currentStep.targetId, settings.sidebarVisible, setSidebarVisible]);

  // Handle scroll-into-view to make sure the target element is visible during the step
  useEffect(() => {
    if (!isActive || !currentStep.targetId) return;

    // Slight delay to allow any sidebar transition to play before scrolling
    const timer = setTimeout(() => {
      const element = document.getElementById(currentStep.targetId!);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [stepIndex, isActive, currentStep.targetId]);

  // Track element rect dynamically and window width
  useEffect(() => {
    if (!isActive) return;

    const updateRect = () => {
      const currentWidth = window.innerWidth;
      setWindowWidth(currentWidth);

      if (!currentStep.targetId) {
        setRect(null);
        return;
      }
      const element = document.getElementById(currentStep.targetId);
      if (element) {
        setRect(element.getBoundingClientRect());
      } else {
        setRect(null);
      }
    };

    updateRect();
    window.addEventListener('resize', updateRect);
    const interval = setInterval(updateRect, 150); // Faster check (150ms) to adapt to animations smoothly

    return () => {
      window.removeEventListener('resize', updateRect);
      clearInterval(interval);
    };
  }, [isActive, stepIndex, currentStep.targetId]);

  // Track tooltip dimensions for bounds clamping
  useEffect(() => {
    if (tooltipRef.current) {
      setTooltipSize({
        width: tooltipRef.current.offsetWidth,
        height: tooltipRef.current.offsetHeight
      });
    }
  }, [stepIndex, isActive]);

  const handleNext = () => {
    if (stepIndex < steps.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1);
    }
  };

  const handleComplete = () => {
    setIsActive(false);
    localStorage.setItem('rsser-tour-seen', 'true');
    setHasSeenTour(true);
  };

  if (!isActive) return null;

  const isCentered = windowWidth < 768 || !rect || currentStep.placement === 'center';
  const showSpotlight = !!rect && currentStep.targetId !== null;

  // Determine tooltip positioning with safety boundaries
  const getTooltipPosition = () => {
    if (isCentered) {
      return {
        position: 'relative' as const
      };
    }

    const pad = 16;
    let top = 0;
    let left = 0;

    if (currentStep.placement === 'right') {
      left = rect.right + pad;
      top = rect.top + rect.height / 2 - tooltipSize.height / 2;
    } else if (currentStep.placement === 'bottom') {
      left = rect.left + rect.width / 2 - tooltipSize.width / 2;
      top = rect.bottom + pad;
    } else if (currentStep.placement === 'left') {
      left = rect.left - tooltipSize.width - pad;
      top = rect.top + rect.height / 2 - tooltipSize.height / 2;
    }

    // Keep within window boundaries
    left = Math.max(pad, Math.min(windowWidth - tooltipSize.width - pad, left));
    top = Math.max(pad, Math.min(window.innerHeight - tooltipSize.height - pad, top));

    return {
      top: `${top}px`,
      left: `${left}px`,
      position: 'fixed' as const
    };
  };

  const tooltipStyle = getTooltipPosition();

  // Translations for buttons
  const uiLabels = {
    de: { next: 'Weiter', back: 'Zurück', skip: 'Überspringen', finish: 'Fertig' },
    en: { next: 'Next', back: 'Back', skip: 'Skip', finish: 'Finish' },
    fr: { next: 'Suivant', back: 'Retour', skip: 'Passer', finish: 'Terminer' },
    es: { next: 'Siguiente', back: 'Atrás', skip: 'Omitir', finish: 'Terminar' }
  }[lang] || { next: 'Next', back: 'Back', skip: 'Skip', finish: 'Finish' };

  return (
    <div className={`fixed inset-0 z-[9999] overflow-hidden select-none font-sans ${isCentered ? 'flex items-center justify-center p-4' : ''}`}>
      {/* Background Masking / Dimming */}
      {showSpotlight ? (
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="onboarding-mask">
              <rect x="0" y="0" width="100%" height="100%" fill="white" />
              {rect && (
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx="12"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            x="0"
            y="0"
            width="100%"
            height="100%"
            fill="rgba(0, 0, 0, 0.55)"
            mask="url(#onboarding-mask)"
            className="pointer-events-auto"
          />
        </svg>
      ) : (
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] pointer-events-auto" />
      )}

      {/* Interactive elements */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stepIndex}
          ref={tooltipRef}
          style={tooltipStyle}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className={`w-[340px] max-w-[90vw] max-h-[85vh] overflow-y-auto rounded-2xl p-5 border shadow-2xl z-[10000] flex flex-col relative ${
            settings.theme === 'dark'
              ? 'bg-[#18181b] border-white/10 text-white'
              : 'bg-white border-gray-200 text-gray-900'
          }`}
        >
          {/* Arrow indicator */}
          {!isCentered && rect && currentStep.placement !== 'center' && (
            <div
              className={`absolute w-3 h-3 rotate-45 border-l border-t ${
                settings.theme === 'dark'
                  ? 'bg-[#18181b] border-white/10'
                  : 'bg-white border-gray-200'
              }`}
              style={{
                top:
                  currentStep.placement === 'bottom'
                    ? '-6px'
                    : '50%',
                left:
                  currentStep.placement === 'bottom'
                    ? '50%'
                    : currentStep.placement === 'right'
                    ? '-6px'
                    : 'auto',
                right:
                  currentStep.placement === 'left' ? '-6px' : 'auto',
                transform:
                  currentStep.placement === 'bottom'
                    ? 'translateX(-50%) rotate(45deg)'
                    : 'translateY(-50%) rotate(-45deg)',
                borderRight: currentStep.placement === 'right' ? 'none' : undefined,
                borderBottom: currentStep.placement === 'right' ? 'none' : undefined,
                borderLeft: currentStep.placement === 'left' ? 'none' : undefined,
                borderTop: currentStep.placement === 'left' ? 'none' : undefined,
              }}
            />
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-3 shrink-0">
            <span className="text-[10px] uppercase tracking-widest font-mono text-orange-500 font-bold">
              Step {stepIndex + 1} of {steps.length}
            </span>
            <button
              onClick={handleComplete}
              className={`p-1 rounded-full transition-colors ${
                settings.theme === 'dark' ? 'hover:bg-white/5 text-white/40' : 'hover:bg-gray-100 text-gray-400'
              }`}
              title={uiLabels.skip}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title & Description */}
          <div className="flex-1 mb-5">
            <h4 className="text-base font-bold tracking-tight mb-2 leading-tight">
              {currentStep.title[lang] || currentStep.title.de}
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed font-normal">
              {currentStep.text[lang] || currentStep.text.de}
            </p>
          </div>

          {/* Actions Footer */}
          <div className="flex items-center justify-between shrink-0">
            <button
              onClick={handleComplete}
              className="text-xs font-semibold text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              {stepIndex === steps.length - 1 ? '' : uiLabels.skip}
            </button>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <button
                  onClick={handleBack}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${
                    settings.theme === 'dark'
                      ? 'border-white/10 hover:bg-white/5 text-white'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  {uiLabels.back}
                </button>
              )}
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white transition-all shadow-md shadow-orange-500/10"
              >
                {stepIndex === steps.length - 1 ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    {uiLabels.finish}
                  </>
                ) : (
                  <>
                    {uiLabels.next}
                    <ChevronRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
