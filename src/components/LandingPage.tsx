import { Check, X, Loader2 } from 'lucide-react';
import { tr } from '../lib/t';
import * as React from 'react';
import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Radio, Mic, Video, Rss, Play, Lightbulb, User, Settings, Database, Languages, Filter, Grid3X3, Presentation, Newspaper, ListOrdered, Globe, Heart, History, Smartphone, Shield, Sparkles, Bookmark, Lock, Zap, Cloud } from 'lucide-react';
import { useSettings } from '../context/SettingsContext';
import { FaqSection } from './FaqSection';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection } from 'firebase/firestore';
import { useNavigate, useLocation } from 'react-router-dom';
export function LandingPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const { settings } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAuthChecking, setIsAuthChecking] = useState(() => {
    if (window.location.hash || location.hash) return false;
    return localStorage.getItem('rsser_logged_in') === 'true';
  });
  const [sourcesCount, setSourcesCount] = useState<number>(() => {
    // Elegant, stable time-based simulated count that slowly grows over the days, starting from a baseline
    const baseDate = 1782384000000; // Around late June 2026
    const now = Date.now();
    const dynamicGrowth = Math.max(0, Math.floor((now - baseDate) / (1000 * 60 * 60 * 4))); // 1 new source every 4 hours
    return 394 + dynamicGrowth;
  });
  const isEn = settings.language === 'en';

  useEffect(() => {
    let timerId: any;
    const increment = () => {
      setSourcesCount(prev => prev + 1);
      const nextDelay = Math.floor(Math.random() * 2000) + 1500; // 1.5s to 3.5s delay
      timerId = setTimeout(increment, nextDelay);
    };

    timerId = setTimeout(increment, Math.floor(Math.random() * 2000) + 1500);
    return () => clearTimeout(timerId);
  }, []);

  useEffect(() => {
    document.title = "RSSer News";
  }, []);

  useEffect(() => {
    if (loading) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 2, 90)); // Simulate progress up to 90%
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
      setTimeout(() => setProgress(0), 300);
    }
  }, [loading]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        localStorage.setItem('rsser_logged_in', 'true');
        // Only redirect if we are not trying to view a specific section (hash)
        // Check window.location.hash as well to be safe
        if (location.hash || window.location.hash) {
          setIsAuthChecking(false);
          return;
        }

        let startPage = '/discover';
        try {
          const cachedSettings = localStorage.getItem('rsser-settings');
          if (cachedSettings) {
            const parsed = JSON.parse(cachedSettings);
            if (parsed && parsed.startPage) startPage = parsed.startPage;
          }
        } catch (e) {}

        navigate(startPage, { replace: true });
      } else {
        localStorage.removeItem('rsser_logged_in');
        setIsAuthChecking(false);
      }
    });
    return () => unsubscribe();
  }, [navigate, location.hash]);

  useEffect(() => {
    if (location.hash === '#pricing') {
      const element = document.getElementById('pricing');
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 500);
      }
    } else if (location.hash === '#warteliste-form') {
      const element = document.getElementById('warteliste-form');
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth' }), 500);
      }
    }
  }, [location.hash]);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await fetch('/api/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (response.ok) {
        setMessage(tr(settings.language, 'Thanks for subscribing!', 'Danke für deine Anmeldung!'));
        setEmail('');
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        setMessage(tr(settings.language, 'Registration failed. Please try again later.', 'Fehler bei der Anmeldung. Bitte versuche es später erneut.'));
      }
    } catch (error) {
      setMessage(tr(settings.language, 'An error occurred.', 'Ein Fehler ist aufgetreten.'));
    } finally {
      setLoading(false);
    }
  };

  if (isAuthChecking) {
    return (
      <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0a0a0a] flex flex-col items-center justify-center text-neutral-900 dark:text-white transition-colors duration-150">
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <img 
            src="/RSSerLogo.png" 
            alt="RSSer Logo" 
            className="w-16 h-16 rounded-2xl object-contain mb-2 shadow-sm drop-shadow-sm" 
            style={{ imageRendering: '-webkit-optimize-contrast' }}
          />
          <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-orange)]" />
          <p className="text-xs font-mono tracking-[0.25em] uppercase text-neutral-500 dark:text-white/60">
            {tr(settings.language, "CONNECTING...", "VERBINDEN...")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-white dark:bg-[#0a0a0a] text-black dark:text-white font-sans relative w-full overflow-hidden">
      {/* Hero Section */}
      <section className="relative h-[600px] w-full flex items-center justify-center text-white overflow-hidden">
        <video
          key={settings.language + "-hero-v999"}
          autoPlay
          loop
          muted
          playsInline
          src={`/HeroVideo.mp4?v=fresh_999`}
          className="absolute inset-0 w-full h-full object-cover blur-[6px]"
        />
        <div className="absolute inset-0 bg-black/40" /> {/* Dark overlay */}

        {/* Mascot */}
        <img
          src="/RSS_Bot_Leer.png"
          alt="RSSer Bot"
          className="absolute top-[22%] left-1/2 -translate-x-1/2 h-auto z-5 hidden md:block opacity-100"
        />

        {/* Text Content */}
        <div className="relative z-10 text-center px-6">
          <div className="flex items-center justify-center gap-3 mb-6 cursor-pointer relative" onClick={() => navigate('/login')}>
            <img src="/RSSerLogo.png" alt="RSSer Logo" className="w-16 h-16 rounded-xl object-contain" style={{ imageRendering: '-webkit-optimize-contrast' }} />
            <span className="text-5xl font-bold tracking-tight">RSSer News</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-6">
            <span style={{ color: 'var(--brand-orange)' }}>{tr(settings.language, 'YOUR', 'DEIN')}</span> {tr(settings.language, 'Feed', 'Feed')}, <span style={{ color: 'var(--brand-orange)' }}>{tr(settings.language, 'YOUR', 'DEINE')}</span> {tr(settings.language, 'Rules.', 'Regeln.')}
          </h1>
          <p className="text-xl md:text-2xl text-white/90 max-w-2xl mx-auto mb-6">
            {tr(settings.language, 'The ultimate home for RSS, Podcasts, YouTube and Radio. (Without the noise of the World Wide Web)', 'Das ultimative Zuhause für RSS, Podcasts, YouTube und Radio. (Ohne den Lärm des World wide Webs)')}
          </p>
          <div className="inline-flex items-center gap-2.5 px-4.5 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm font-semibold shadow-lg shadow-black/20 text-white select-none transition-all hover:scale-[1.02]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            <span>
              {settings.language === 'de' ? (
                `Über ${sourcesCount.toLocaleString()} aktive Medienquellen verfügbar & ständig wachsend...`
              ) : settings.language === 'fr' ? (
                `Plus de ${sourcesCount.toLocaleString()} sources de médias actives disponibles et en croissance...`
              ) : settings.language === 'es' ? (
                `Más de ${sourcesCount.toLocaleString()} fuentes de medios activas disponibles y creciendo...`
              ) : (
                `Over ${sourcesCount.toLocaleString()} active media sources available & growing...`
              )}
            </span>
          </div>
        </div>

        {/* Straight cut bottom */}
      </section>

      <main className="max-w-7xl mx-auto mt-[-100px] relative z-20 px-6 grid grid-cols-12 gap-6">
        {/* Feature Grid */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { icon: Rss, title: "RSS Reader", desc: tr(settings.language, "Never miss an article from your favorite feeds and sources.", "Verpasse nie wieder einen Artikel deiner Lieblingsquellen und Feeds.") },
            { icon: Mic, title: "Podcasts", desc: tr(settings.language, "Your favorite shows in one place.", "Deine Lieblingsshows an einem Ort.") },
            { icon: Radio, title: "Live Radio", desc: tr(settings.language, "Your stations, seamless and ad-free.", "Deine Sender, nahtlos und werbefrei.") },
            { icon: Video, title: "YouTube", desc: tr(settings.language, "Enjoy videos without the noise.", "Videos genießen ohne den Lärm.") },
            { icon: Shield, title: tr(settings.language, "100% Free & Private", "100% Kostenlos & Privat"), desc: tr(settings.language, "No subscriptions, no paywalls, completely tracker-free.", "Keine Abos, keine Bezahlschranken, völlig tracker-frei.") },
            { icon: Sparkles, title: tr(settings.language, "Fast & Clean", "Blitzschnell & Schlank"), desc: tr(settings.language, "Lean architecture focused on what matters: your content.", "Schlanke Plattform, fokussiert auf das Wesentliche: deine Inhalte.") },
            { icon: User, title: tr(settings.language, "User-centric", "Nutzerzentriert"), desc: tr(settings.language, "Your experience, your feeds - fully controlled by you.", "Dein Erlebnis, deine Feeds - völlig kontrolliert von dir.") },
            { icon: Settings, title: tr(settings.language, "All-in-one", "Komplettlösung"), desc: tr(settings.language, "Everything you need for your news and entertainment feed in one place.", "Alles, was Du für deinen News und Entertainment Feed brauchst, an einem Ort.") },
          ].map((feat, i) => (
            <div key={i} className="p-8 rounded-2xl glass-effect transition-all duration-300 hover:-translate-y-2 hover:border-[var(--brand-orange)] border">
              <feat.icon className="w-10 h-10 text-[var(--brand-orange)] mb-6" />
              <h3 className="text-xl font-bold mb-2 text-black dark:text-white">{feat.title}</h3>
              <p className="text-gray-600 dark:text-gray-300 text-sm">{feat.desc}</p>
            </div>
          ))}
        </div>

        {/* Intro Tiles */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          <div className="p-8 rounded-2xl glass-effect border">
            <Lightbulb className="w-10 h-10 text-[var(--brand-orange)] mb-4" />
            <h2 className="text-2xl font-bold mb-2 text-black dark:text-white">{tr(settings.language, 'Understand RSS', 'RSS verstehen')}</h2>
            <p className="text-sm opacity-80 text-gray-800 dark:text-gray-200">{tr(settings.language, 'RSS is not a relic, but your liberation from the algorithm. Find out how to use courier services for your sources.', 'RSS ist kein Relikt, sondern deine Befreiung vom Algorithmus. Erfahre, wie du Kurier-Dienste für deine Quellen nutzt.')}</p>
          </div>
          <div className="p-8 rounded-2xl glass-effect flex-1 flex flex-col justify-between border">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--brand-orange)] font-bold">
                {tr(settings.language, "Mind Control vs. Freedom", "Bewusste Kuration")}
              </span>
              <h3 className="text-lg font-bold mt-2.5 mb-3 text-black dark:text-white leading-snug">
                {tr(settings.language, "The Algorithm is NOT your friend.", "Der Algorithmus ist NICHT dein Freund.")}
              </h3>
              <p className="text-xs opacity-75 text-gray-600 dark:text-gray-300 leading-relaxed">
                {tr(
                  settings.language,
                  "Social media feeds are designed to keep you angry, active, and scrolling. RSSer lets you choose exactly what reaches your mind, when it reaches you.",
                  "Social-Media-Feeds sind darauf ausgelegt, dich emotional geladen und endlos am Scrollen zu halten. RSSer überlässt dir die volle Kontrolle darüber, was wann deinen Kopf erreicht."
                )}
              </p>
            </div>
            
            <div className="pt-4 mt-4 border-t border-black/5 dark:border-white/10 flex items-center justify-between text-[10px] font-mono tracking-wider uppercase opacity-40">
              <span>{tr(settings.language, "Manifesto // 01", "Manifest // 01")}</span>
              <span className="font-sans italic font-semibold text-[var(--brand-orange)] tracking-normal normal-case text-xs">
                {tr(settings.language, "Take charge.", "Nimm das Steuer selbst in die Hand.")}
              </span>
            </div>
          </div>
        </div>

        {/* Video Card */}
        <div className="col-span-12 lg:col-span-8 group relative overflow-hidden rounded-2xl glass-effect border">
          <div className="aspect-video w-full bg-black overflow-hidden rounded-t-2xl flex items-center justify-center">
            <video
              key={settings.language + "-main-v999"}
              className="w-full h-full object-cover"
              controls
              playsInline
              src={
                settings.language === 'fr' ? '/F.mp4?v=fresh_999' :
                settings.language === 'en' ? '/E.mp4?v=fresh_999' :
                settings.language === 'es' ? '/S.mp4?v=fresh_999' :
                '/D.mp4?v=fresh_999'
              }
            >
              {tr(settings.language, 'Your browser does not support the video tag.', 'Dein Browser unterstützt dieses Video nicht.')}
            </video>
          </div>
          <div className="p-8">
            <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">{tr(settings.language, 'Why RSS is key today', 'Warum RSS heutzutage der Schlüssel ist')}</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {tr(settings.language, 'In a world full of noise and unsolicited recommendation algorithms, RSSer gives you the opportunity to control your digital content yourself. Find out how you can regain full control and focus with this technology.', 'In einer Welt voller Lärm und ungefragter Empfehlungs-Algorithmen bietet RSSer dir die Möglichkeit, deine digitalen Inhalte selbst zu bestimmen. Finde heraus, wie du mit dieser Technologie wieder die volle Kontrolle und Fokus zurückgewinnst.')}
            </p>
          </div>
        </div>

        {/* Popular Sources Scroller */}
        <div className="col-span-12 py-8 glass-effect rounded-2xl my-8 overflow-hidden">
          <h2 className="text-2xl font-bold mb-8 text-center">{tr(settings.language, 'Subscribe to your favorite sources', 'Abonniere deine Lieblingsquellen')}</h2>
          <div className="relative flex overflow-hidden">
            <div className="flex gap-8 animate-scroll whitespace-nowrap">
              {[...Array(2)].map((_, setIndex) => (
                <div key={setIndex} className="flex gap-8">
                  {[
                    { name: "NY Times", domain: "nytimes.com" },
                    { name: "Heise", domain: "heise.de" },
                    { name: "Spiegel", domain: "spiegel.de" },
                    { name: "BBC News", domain: "bbc.com" },
                    { name: "The Verge", domain: "theverge.com" },
                    { name: "Zeit", domain: "zeit.de" },
                    { name: "Guardian", domain: "theguardian.com" },
                    { name: "CNN", domain: "cnn.com" },
                    { name: "Wired", domain: "wired.com" },
                    { name: "NZZ", domain: "nzz.ch" },
                    { name: "Golem", domain: "golem.de" },
                    { name: "Washington Post", domain: "washingtonpost.com" },
                    { name: "TechCrunch", domain: "techcrunch.com" },
                    { name: "Bloomberg", domain: "bloomberg.com" },
                    { name: "Welt", domain: "welt.de" },
                    { name: "FAZ", domain: "faz.net" },
                    { name: "Forbes", domain: "forbes.com" },
                    { name: "AP News", domain: "ap.org" },
                    { name: "HuffPost", domain: "huffpost.com" }
                  ].map((source, i) => (
                    <div key={`${setIndex}-${i}`} className="inline-flex flex-shrink-0 w-32 h-32 flex flex-col items-center justify-center p-3 transition-all duration-300 hover:scale-105 cursor-pointer">
                      <img src={`https://t3.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${source.domain}&size=128`} alt={source.name} className="w-16 h-16 object-contain mb-2" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%239ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'; }} />
                      <span className="text-xs font-bold text-gray-500 truncate w-full text-center">{source.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>



        <section className="col-span-12 py-16">
          <h2 className="text-3xl font-bold mb-12 text-center">
             <span className="text-[var(--brand-orange)]">{tr(settings.language, "Control, ", "Kontrolle, ")}</span>
             <span className="text-black dark:text-white">{tr(settings.language, "Focus", "Fokus")}</span>
             <span className="text-[var(--brand-orange)]">{tr(settings.language, ", Freedom", ", Freiheit")}</span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6 text-black dark:text-white">
            {[
                { icon: Database, title: tr(settings.language, "Content DB", "Inhalts-DB") },
                { icon: Languages, title: tr(settings.language, "Multilingual", "Mehrsprachig") },
                { icon: Filter, title: tr(settings.language, "Filter", "Filter") },
                { icon: Grid3X3, title: tr(settings.language, "Magazine Grid", "Magazin-Ansicht") },
                { icon: Presentation, title: tr(settings.language, "Slideshow", "Slideshow") },
                { icon: Newspaper, title: tr(settings.language, "News Hub", "Newszentrale") },
                { icon: ListOrdered, title: tr(settings.language, "Top Lists", "Top Listen") },
                { icon: Bookmark, title: tr(settings.language, "Bookmarks & Favorites", "Lesezeichen & Favoriten") },
                { icon: Globe, title: tr(settings.language, "Everywhere", "Läuft überall") },
                { icon: Heart, title: tr(settings.language, "Designed for YOU", "Für DICH entwickelt") },
                { icon: History, title: tr(settings.language, "Back to roots", "Zurück zu den Wurzeln") },
                { icon: Smartphone, title: tr(settings.language, "Always with you", "Immer dabei") },
                { icon: Lock, title: tr(settings.language, "Privacy first", "Privatsphäre zuerst") },
                { icon: Zap, title: tr(settings.language, "Lightning fast", "Blitzschnell") },
                { icon: Cloud, title: tr(settings.language, "Secure in Cloud", "Sicher in der Cloud") },
            ].map((tile, i) => (
              <div key={i} className="p-4 rounded-xl glass-effect border flex flex-col items-center text-center gap-3">
                <tile.icon className="w-8 h-8 text-[var(--brand-orange)]" />
                <span className="font-semibold text-sm">{tile.title}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison Section */}
        <section className="col-span-12 py-16 border-t border-black/5 dark:border-white/10">
          <h2 className="text-3xl font-bold mb-4 text-center">
            {tr(settings.language, "Why RSSer Outperforms Others", "Warum RSSer die Nase vorn hat")}
          </h2>
          <p className="text-gray-600 dark:text-gray-300 text-center max-w-2xl mx-auto mb-12 text-sm sm:text-base">
            {tr(
              settings.language,
              "A direct comparison between RSSer and traditional RSS readers like Feedly or Inoreader. See why RSSer is the ultimate modern news experience.",
              "Ein direkter Vergleich zwischen RSSer und traditionellen RSS-Readern wie Feedly oder Inoreader. Erfahre, warum RSSer das ultimative, moderne Nachrichtenerlebnis bietet."
            )}
          </p>

          <div className="w-full overflow-x-auto rounded-2xl glass-effect border shadow-xl">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02]">
                  <th className="p-5 font-bold text-gray-400 text-xs sm:text-sm uppercase tracking-wider w-1/4">
                    {tr(settings.language, "Feature", "Funktion")}
                  </th>
                  <th className="p-5 font-bold text-[var(--brand-orange)] text-xs sm:text-sm uppercase tracking-wider bg-[var(--brand-orange)]/5 w-1/4 text-center border-x border-black/5 dark:border-white/5">
                    RSSer News
                  </th>
                  <th className="p-5 font-bold text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm uppercase tracking-wider w-1/4 text-center">
                    Feedly
                  </th>
                  <th className="p-5 font-bold text-blue-600 dark:text-blue-400 text-xs sm:text-sm uppercase tracking-wider w-1/4 text-center">
                    Inoreader
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {[
                  {
                    name: tr(settings.language, "Media Diversity (All-in-One)", "Medienvielfalt (Alles-in-Einem)"),
                    desc: tr(settings.language, "Integrate RSS, Podcasts, Live-Radio and YouTube in a single, beautiful dashboard.", "Integriere RSS, Podcasts, Live-Radio und YouTube in einem einzigen, schönen Dashboard."),
                    rsser: { val: tr(settings.language, "All integrated seamlessly", "Alles nahtlos integriert"), ok: true },
                    feedly: { val: tr(settings.language, "RSS & YouTube only", "Nur RSS & YouTube"), ok: false },
                    inoreader: { val: tr(settings.language, "RSS, YouTube & simple Podcasts", "RSS, YouTube & einfache Podcasts"), ok: false, partial: true }
                  },
                  {
                    name: tr(settings.language, "Integrated Media Player", "Integrierter Mediaplayer"),
                    desc: tr(settings.language, "Continuous background audio playback for podcasts and live radio with playlist queue.", "Kontinuierliche Hintergrund-Wiedergabe für Podcasts und Radio mit Playlist-Warteschlange."),
                    rsser: { val: tr(settings.language, "Yes, with global player bar", "Ja, mit globaler Player-Leiste"), ok: true },
                    feedly: { val: tr(settings.language, "No (external links only)", "Nein (nur externe Links)"), ok: false },
                    inoreader: { val: tr(settings.language, "Rudimentary player only", "Nur rudimentärer Player"), ok: false, partial: true }
                  },
                  {
                    name: tr(settings.language, "Absolute Privacy & Tracker-free", "100% Tracking-Freiheit & Datenschutz"),
                    desc: tr(settings.language, "No advertising banners, no profiling cookies, and complete protection of your reading habits.", "Keine Werbebanner, keine Profilierungs-Cookies und absoluter Schutz deiner Lesegewohnheiten."),
                    rsser: { val: tr(settings.language, "Yes, strictly tracker-free", "Ja, strikt tracker-frei"), ok: true },
                    feedly: { val: tr(settings.language, "Ads & trackers in free mode", "Werbung & Tracker im Free-Modus"), ok: false },
                    inoreader: { val: tr(settings.language, "Ads & trackers in free mode", "Werbung & Tracker im Free-Modus"), ok: false }
                  },
                  {
                    name: tr(settings.language, "100% Free & Unlimited", "100% Kostenlos & Unbegrenzt"),
                    desc: tr(settings.language, "No subscriptions, no paywalls, unlimited sources and full layout freedom.", "Keine Abos, keine Paywalls, unbegrenzte Quellen und volle Gestaltungsfreiheit."),
                    rsser: { val: tr(settings.language, "100% Free for everyone (Forever)", "100% Kostenlos für alle (Für immer)"), ok: true },
                    feedly: { val: tr(settings.language, "Expensive plans ($8.25 - $12+/mo)", "Teure Pro-Pläne ($8.25 - $12+/Mo)"), ok: false },
                    inoreader: { val: tr(settings.language, "Very complex, high pricing tiers", "Sehr teuer und komplexe Abostufen"), ok: false }
                  }
                ].map((row, idx) => (
                  <tr key={idx} className="hover:bg-black/[0.01] dark:hover:bg-white/[0.01] transition-colors">
                    <td className="p-5">
                      <div className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">{row.name}</div>
                      <div className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs leading-normal">{row.desc}</div>
                    </td>
                    <td className="p-5 bg-[var(--brand-orange)]/5 border-x border-black/5 dark:border-white/5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        <Check className="w-5 h-5 text-green-500 stroke-[3.5]" />
                        <span className="text-[11px] sm:text-xs font-semibold text-gray-900 dark:text-white">{row.rsser.val}</span>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        {row.feedly.ok ? (
                          <Check className="w-5 h-5 text-green-500 stroke-[2.5]" />
                        ) : (
                          <X className="w-5 h-5 text-red-400/80 stroke-[2]" />
                        )}
                        <span className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">{row.feedly.val}</span>
                      </div>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex flex-col items-center justify-center gap-1.5">
                        {row.inoreader.ok ? (
                          <Check className="w-5 h-5 text-green-500 stroke-[2.5]" />
                        ) : row.inoreader.partial ? (
                          <Check className="w-5 h-5 text-yellow-500 stroke-[2]" />
                        ) : (
                          <X className="w-5 h-5 text-red-400/80 stroke-[2]" />
                        )}
                        <span className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400">{row.inoreader.val}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <FaqSection />

        {/* How it works */}
        <div className="col-span-12 py-16">
          <h2 className="text-3xl font-bold mb-12 text-center">{tr(settings.language, 'How RSSer works', 'So funktioniert RSSer')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { title: tr(settings.language, "Subscribe to sources", "Quellen abonnieren"), desc: tr(settings.language, "Link all your feeds, podcasts, and YouTube channels in one central place.", "Verknüpfe all deine Feeds, Podcasts und YouTube-Kanäle an einem zentralen Ort.") },
              { title: tr(settings.language, "Consolidate", "Konsolidieren"), desc: tr(settings.language, "RSSer brings order to the flood of information and creates a clear overview.", "RSSer bringt Ordnung in die Informationsflut und schafft einen klaren Überblick.") },
              { title: tr(settings.language, "Enjoy", "Genießen"), desc: tr(settings.language, "Consume your content without distraction, tracking, or algorithm noise.", "Konsumiere deine Inhalte ohne Ablenkung, Tracking oder Algorithmus-Lärm.") },
            ].map((step, i) => (
              <div key={i} className="p-8 rounded-2xl glass-effect text-center border">
                <div className="w-16 h-16 rounded-full bg-[var(--brand-orange)] text-white flex items-center justify-center text-2xl font-bold mx-auto mb-6">
                  {i + 1}
                </div>
                <h3 className="text-xl font-bold mb-3 text-black dark:text-white">{step.title}</h3>
                <p className="text-gray-600 dark:text-gray-300">{step.desc}</p>
              </div>
            ))}
          </div>
          
          {/* Newsletter Form */}
          <div id="warteliste-form" className="mt-12 p-8 rounded-2xl glass-effect text-center border w-full scroll-mt-[25vh]">
            <h3 className="text-2xl font-bold mb-4 text-[var(--brand-orange)]">{tr(settings.language, "Newsletter", "Newsletter")}</h3>
            <p className="text-gray-600 dark:text-white mb-6">{tr(settings.language, "Sign up to receive exclusive insights and updates from RSSer. Always stay up to date.", "Melde dich an, um exklusive Einblicke und Updates von RSSer zu erhalten. Bleibe immer auf dem Laufenden.")}</p>
            <form onSubmit={handleSubscribe} className="flex gap-2">
              <div className="relative flex-grow">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr(settings.language, "Your email address", "Deine Email Adresse")}
                  className="w-full p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[var(--brand-orange)]"
                  disabled={loading}
                  required
                />
                <div 
                  className="absolute bottom-0 left-0 h-1 bg-[var(--brand-orange)] transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <button 
                type="submit" 
                className="bg-[var(--brand-orange)] text-white px-6 py-3 rounded-lg font-bold hover:bg-orange-600 transition disabled:opacity-50"
                disabled={loading}
              >
                {tr(settings.language, "Subscribe", "Anmelden")}
              </button>
            </form>
            {message && <p className="mt-4 text-sm font-semibold">{message}</p>}
          </div>
        </div>

        {/* Main Section Image */}
        <div className="col-span-12 flex justify-center my-2 ml-[-2rem]">
          <img
            src={settings.theme === 'dark' ? '/MainImageDark.png' : '/MainImage.png'}
            alt="Main Section"
            className="w-full max-w-5xl h-auto rounded-xl"
          />
        </div>

        <div className="col-span-12 text-center py-6">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {tr(settings.language, 'Runs on ', 'Läuft auf ')}<span className="font-bold text-[var(--brand-orange)]">{tr(settings.language, 'ALL', 'ALLEN')}</span>{tr(settings.language, ' your devices, always up to date everywhere thanks to ', ' deinen Endgeräten, überall aktuell dank ')}<span className="font-bold text-[var(--brand-orange)]">CLOUDSYNC</span>{tr(settings.language, ' on redundant ', ' auf redundanten ')}
            <span className="font-medium">
              <span style={{ color: '#4285F4' }}>G</span><span style={{ color: '#EA4335' }}>o</span><span style={{ color: '#FBBC05' }}>o</span><span style={{ color: '#4285F4' }}>g</span><span style={{ color: '#34A853' }}>l</span><span style={{ color: '#EA4335' }}>e</span>
            </span>{tr(settings.language, ' servers', ' Servern')}
          </p>

        </div>

        {/* 100% Free Section */}
        <div id="pricing" className="col-span-12 pt-12 pb-36 scroll-mt-24">
          <div className="max-w-3xl mx-auto p-8 sm:p-12 rounded-3xl glass-effect border text-center relative overflow-hidden">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--brand-orange)]/10 text-[var(--brand-orange)] font-bold text-xs uppercase tracking-widest mb-6">
              <Shield className="w-4 h-4" />
              {tr(settings.language, "100% Free & Open", "100% Kostenlos & Offen")}
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 text-black dark:text-white">
              {tr(settings.language, "No Paywalls. No Subscriptions. Just News.", "Keine Paywalls. Keine Abos. Nur News.")}
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto mb-8 leading-relaxed">
              {tr(
                settings.language,
                "RSSer is built for readers. Enjoy unlimited RSS feeds, podcasts, radio stations, and YouTube channels completely free of charge, with zero tracking and zero ads.",
                "RSSer wurde für Leser gebaut. Genieße unbegrenzte RSS-Feeds, Podcasts, Radio-Sender und YouTube-Kanäle völlig kostenlos, ohne Tracking und ohne Werbung."
              )}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-10 text-sm font-semibold text-gray-700 dark:text-gray-200">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 stroke-[3]" />
                <span>{tr(settings.language, "Unlimited Feeds", "Unbegrenzte Feeds")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 stroke-[3]" />
                <span>{tr(settings.language, "Podcasts & Radio", "Podcasts & Radio")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 stroke-[3]" />
                <span>{tr(settings.language, "CloudSync", "CloudSync")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 stroke-[3]" />
                <span>{tr(settings.language, "100% Tracker-Free", "100% Werbefrei")}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="bg-[var(--brand-orange)] hover:bg-orange-600 text-white font-black text-sm tracking-wider uppercase py-4 px-10 rounded-full shadow-lg shadow-orange-500/25 transition-all hover:scale-105 active:scale-95"
            >
              {tr(settings.language, "START NOW FOR FREE", "JETZT KOSTENLOS STARTEN")}
            </button>
          </div>
        </div>

      </main>

    </div>
  );
}
