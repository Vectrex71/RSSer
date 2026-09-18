import { tr } from '../lib/t';
import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../context/SettingsContext';

const faqDataDe = [
  { question: "Was ist die RSSer Plattform?", answer: "RSSer ist eine moderne Content-Plattform, die auf der bewährten RSS-Technologie basiert. Wir machen daten-basierten Content-Konsum wieder transparent, direkt und nutzerzentriert – weg von algorithmischen Feeds, hin zu echtem Interesse." },
  { question: "Warum RSS statt Algorithmen?", answer: "Algorithmen von sozialen Netzwerken bestimmen, was du siehst, um dich möglichst lange auf der Plattform zu halten. RSS hingegen gibt dir die volle Kontrolle: Du entscheidest selbst, welche Quellen du konsumierst – ganz ohne die Ablenkungen und den Lärm der großen Web-Plattformen." },
  { question: "Kann ich YouTube Kanäle integrieren?", answer: "Ja, RSSer erlaubt es dir, YouTube-Kanäle wie RSS-Feeds zu abonnieren, sodass du neue Videos sofort siehst, ohne vom Algorithmus abgelenkt zu werden." },
  { question: "Kann ich Podcasts hören?", answer: "Ja, du kannst deine bevorzugten Podcast-Feeds direkt in RSSer einbinden und direkt abspielen." },
  { question: "Ab wann kann ich RSSer nutzen?", answer: <>Die Plattform ist bereits live und kann sofort ausprobiert werden! Du kannst dich zudem für unseren <a href="#warteliste-form" className="text-[var(--brand-orange)] underline">Newsletter</a> anmelden, um immer auf dem Laufenden zu bleiben.</> },
  { question: "Kann ich Radio Stationen folgen und hören?", answer: "Absolut! RSSer unterstützt das Einbinden von Radio-Streams, damit du deine Lieblingssender direkt in der App hören kannst." },
  { question: "Bekomme ich wirklich einen Blog?", answer: "Ja, mit RSSer erhältst du einen Blog auf unserer Blogging-Plattform mit einem Rich Multimedia WYSIWYG Editor, mit dem Du deine Gedanken direkt veröffentlichen kannst. Jeder kann dich von innerhalb und auch ausserhalb der Plattform abonnieren und lesen." },
  { question: "Warum eine komplett neue Version von RSSer?", answer: "Die neue Version bietet eine modernere Benutzererfahrung, bessere Performance und erweiterte Funktionen zur Verwaltung deiner Inhalte." },
];

const faqDataEn = [
  { question: "What is the RSSer Platform?", answer: "RSSer is a modern content platform based on proven RSS technology. We are making data-based content consumption transparent, direct, and user-centric again - away from algorithmic feeds and towards genuine interest." },
  { question: "Why RSS instead of algorithms?", answer: "Algorithmic social networks dictate what you see to keep you on the platform as long as possible. RSS gives you full control: You decide which sources you want to consume - entirely without distractions and the noise of the large web platforms." },
  { question: "Can I integrate YouTube channels?", answer: "Yes, RSSer allows you to subscribe to YouTube channels like RSS feeds, so you can see new videos instantly without being bothered by the algorithm." },
  { question: "Can I listen to podcasts?", answer: "Yes, you can easily integrate and stream your favorite podcast feeds directly in RSSer." },
  { question: "When can I use RSSer?", answer: <>The platform is already live and can be tried out immediately! You can also subscribe to our <a href="#warteliste-form" className="text-[var(--brand-orange)] underline">Newsletter</a> to stay up to date.</> },
  { question: "Can I follow and listen to radio stations?", answer: "Absolutely! RSSer supports integrating radio streams so you can listen to your favorite stations directly in the app." },
  { question: "Do I really get a blog?", answer: "Yes, with RSSer you get a blog on our blogging platform with a rich multimedia WYSIWYG editor that you can use to publish your thoughts instantly. Anyone can subscribe to and read you from inside and outside the platform." },
  { question: "Why a completely new version of RSSer?", answer: "The new version offers a more modern user experience, better performance, and advanced capabilities for managing your content." },
];

const faqDataFr = [
  { question: "Qu'est-ce que la plateforme RSSer ?", answer: "RSSer est une plateforme de contenu moderne basée sur la technologie RSS éprouvée. Nous rendons la consommation de contenu basée sur les données à nouveau transparente, directe et centrée sur l'utilisateur – loin des flux algorithmiques, vers un intérêt réel." },
  { question: "Pourquoi RSS au lieu des algorithmes ?", answer: "Les algorithmes des réseaux sociaux dictent ce que vous voyez pour vous garder sur la plateforme aussi longtemps que possible. RSS vous donne un contrôle total : vous décidez quelles sources vous voulez consommer – sans aucune distraction ni le bruit des grandes plateformes web." },
  { question: "Puis-je intégrer des chaînes YouTube ?", answer: "Oui, RSSer vous permet de vous abonner à des chaînes YouTube comme des flux RSS, afin que vous puissiez voir les nouvelles vidéos instantanément sans être dérangé par l'algorithme." },
  { question: "Puis-je écouter des podcasts ?", answer: "Oui, vous pouvez facilement intégrer et diffuser vos flux de podcasts préférés directement dans RSSer." },
  { question: "Quand puis-je utiliser RSSer ?", answer: <>La plateforme est déjà en ligne et peut être testée immédiatement ! Vous pouvez également vous inscrire à notre <a href="#warteliste-form" className="text-[var(--brand-orange)] underline">Newsletter</a> pour rester informé.</> },
  { question: "Puis-je suivre et écouter des stations de radio ?", answer: "Absolument ! RSSer prend en charge l'intégration de flux radio afin que vous puissiez écouter vos stations préférées directement dans l'application." },
  { question: "Ai-je vraiment droit à un blog ?", answer: "Oui, avec RSSer, vous obtenez un blog sur notre plateforme de blogging avec un éditeur WYSIWYG multimédia riche que vous pouvez utiliser pour publier vos pensées instantanément. Tout le monde peut s'abonner et vous lire de l'intérieur et de l'extérieur de la plateforme." },
  { question: "Pourquoi une version complètement nouvelle de RSSer ?", answer: "La nouvelle version offre une expérience utilisateur plus moderne, de meilleures performances et des fonctionnalités avancées pour gérer votre contenu." },
];

const faqDataEs = [
  { question: "¿Qué es la plataforma RSSer?", answer: "RSSer es una plataforma de contenido moderna basada en la tecnología RSS probada. Hacemos que el consumo de contenido basado en datos sea transparente, directo y centrado en el usuario nuevamente: lejos de las fuentes algorítmicas, hacia un interés genuino." },
  { question: "¿Por qué RSS en lugar de algoritmos?", answer: "Las redes sociales algorítmicas dictan lo que ves para mantenerte en la plataforma el mayor tiempo posible. RSS te da control total: tú decides qué fuentes quieres consumir, sin distracciones ni el ruido de las grandes plataformas web." },
  { question: "¿Puedo integrar canales de YouTube?", answer: "Sí, RSSer te permite suscribirte a canales de YouTube como canales RSS, para que puedas ver nuevos videos al instante sin que te moleste el algoritmo." },
  { question: "¿Puedo escuchar podcasts?", answer: "Sí, puedes integrar y transmitir fácilmente tus canales de podcasts favoritos directamente en RSSer." },
  { question: "¿Cuándo puedo usar RSSer?", answer: <>¡La plataforma ya está en línea y se puede probar de inmediato! También puedes suscribirte a nuestro <a href="#warteliste-form" className="text-[var(--brand-orange)] underline">Boletín informativo</a> para mantenerte al día.</> },
  { question: "¿Puedo seguir y escuchar estaciones de radio?", answer: "¡Absolutamente! RSSer admite la integración de transmisiones de radio para que puedas escuchar tus emisoras favoritas directamente en la aplicación." },
  { question: "¿Realmente obtengo un blog?", answer: "Sí, con RSSer obtienes un blog en nuestra plataforma de blogs con un editor multimedia WYSIWYG rico que puedes usar para publicar tus pensamientos al instante. Cualquiera puede suscribirse y leerte desde dentro y fuera de la plataforma." },
  { question: "¿Por qué una versión completamente nueva de RSSer?", answer: "La nueva versión ofrece una experiencia de usuario más moderna, mejor rendimiento y capacidades avanzadas para administrar tu contenido." },
];

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const { settings } = useSettings();
  const faqData = settings.language === 'fr' ? faqDataFr : 
                  settings.language === 'es' ? faqDataEs : 
                  settings.language === 'en' ? faqDataEn : faqDataDe;

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section className="col-span-12 py-16">
      <h2 className="text-3xl font-bold mb-12 text-center">{tr(settings.language, 'Frequently Asked Questions (FAQ)', 'Häufig gestellte Fragen (FAQ)')}</h2>
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
        {faqData.map((item, i) => (
          <div key={i} className="glass-effect rounded-2xl border overflow-hidden">
            <button
              onClick={() => toggle(i)}
              className="w-full flex items-center justify-between p-6 text-left font-bold"
            >
              {item.question}
              {openIndex === i ? <Minus className="text-[var(--brand-orange)]" /> : <Plus className="text-[var(--brand-orange)]" />}
            </button>
            <AnimatePresence>
              {openIndex === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-6 text-gray-600 overflow-hidden"
                >
                  <div className="pb-6">{item.answer}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </section>
  );
}
