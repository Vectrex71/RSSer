import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { AmbientWave } from './layout/AmbientWave';

export function ImpressumPage() {
  const { settings } = useSettings();
  const lang = settings.language;
  const isDark = settings.theme === 'dark';

  const renderContent = () => {
    switch (lang) {
      case 'de':
        return (
          // DEUTSCHE VERSION
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Impressum</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Stand: Juli 2026</p>
            </div>

            {/* Betreiber-Informationen */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Herausgeber und Betreiber der Plattform</h2>
              <p>
                Betreiber und technischer Vertragspartner dieser Webapplikation ist:
              </p>
              <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-5 rounded-2xl font-sans space-y-1">
                <p className="font-bold text-black dark:text-white">Hansjürg Wüthrich</p>
                <p>8320 Fehraltorf</p>
                <p>Schweiz / Switzerland</p>
                <p className="pt-2">E-Mail: <a href="mailto:support@Rsser.news" className="text-[var(--brand-orange)] hover:underline font-medium">support@Rsser.news</a></p>
              </div>
            </section>

            {/* WICHTIGER HAFTUNGSHINWEIS */}
            <section className="space-y-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/15 dark:border-orange-500/10 backdrop-blur-sm p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                ⚠️ Haftungsausschluss für Inhalte (Wichtiger Hinweis)
              </h2>
              <p className="font-medium text-black dark:text-gray-200">
                RSSer ist eine rein technische Infrastruktur- und Aggregations-Plattform. 
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Der Betreiber von RSSer (Hansjürg Wüthrich) ist <strong>ausschließlich für die technische Bereitstellung, Wartung und Funktionalität der Plattform verantwortlich</strong>. 
                Er hat keinerlei Einfluss auf die Inhalte, die über RSS-Feeds, Podcasts, Radios, YouTube-Kanäle, Webcams oder sonstige externe Quellen geladen und dargestellt werden.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Für alle Inhalte, Nachrichten, Texte, Bilder, Audio- und Videodateien sind <strong>ausschließlich die jeweiligen externen Herausgeber, Verfasser bzw. die ursprünglichen Quellen der abonnierten Feeds verantwortlich</strong>. 
                Ebenso sind registrierte Nutzer für die von ihnen selbst im Rahmen der Blog-Funktion erstellten und veröffentlichten Inhalte (User-Generated Content) persönlich und rechtlich vollumfänglich selbst verantwortlich.
              </p>
            </section>

            {/* Ausführliche Haftungsklauseln */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Allgemeiner Haftungsausschluss</h2>
              <p className="text-sm leading-relaxed">
                Der Betreiber übernimmt keinerlei Gewähr hinsichtlich der inhaltlichen Richtigkeit, Genauigkeit, Aktualität, Zuverlässigkeit und Vollständigkeit der übermittelten oder aggregierten Informationen.
              </p>
              <p className="text-sm leading-relaxed">
                Haftungsansprüche gegen den Betreiber wegen Schäden materieller oder immaterieller Art, welche aus dem Zugriff oder der Nutzung bzw. Nichtnutzung der veröffentlichten Informationen, durch Missbrauch der Verbindung oder durch technische Störungen entstanden sind, werden vollumfänglich ausgeschlossen.
              </p>
              <p className="text-sm leading-relaxed">
                Alle Angebote sind unverbindlich. Der Betreiber behält es sich ausdrücklich vor, Teile der Seiten oder das gesamte Angebot ohne gesonderte Ankündigung zu verändern, zu ergänzen, zu löschen oder die Veröffentlichung zeitweise oder endgültig einzustellen.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Haftungsausschluss für Links</h2>
              <p className="text-sm leading-relaxed">
                Verweise und Links auf Webseiten Dritter liegen außerhalb unseres Verantwortungsbereichs. Es wird jegliche Verantwortung für solche Webseiten abgelehnt. Der Zugriff und die Nutzung solcher Webseiten erfolgen auf eigene Gefahr des jeweiligen Nutzers.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Urheberrechte</h2>
              <p className="text-sm leading-relaxed">
                Die Urheber- und alle anderen Rechte an Inhalten, Bildern, Fotos oder anderen Dateien auf dieser Plattform gehören – sofern nicht anders angegeben – den spezifisch genannten Rechtsinhabern oder den Original-Quellen (RSS-Feeds/Publishern). Für die Reproduktion jeglicher Elemente ist die schriftliche Zustimmung der Urheberrechtsträger im Voraus einzuholen.
              </p>
              <p className="text-sm leading-relaxed">
                Als technischer Aggregator respektiert RSSer das Urheberrecht der Verleger vollumfänglich. Sollten Sie Verletzungen Ihrer Rechte feststellen, bitten wir um direkte Kontaktaufnahme unter der oben genannten E-Mail-Adresse, um die betreffenden Feeds oder Inhalte umgehend zu sperren.
              </p>
            </section>
          </div>
        );
      case 'fr':
        return (
          // FRANZÖSISCHE VERSION
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Mentions Légales</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dernière mise à jour : Juillet 2026</p>
            </div>

            {/* Informations sur l'exploitant */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Éditeur et exploitant de la plateforme</h2>
              <p>
                L'exploitant et le partenaire contractuel technique de cette application web est :
              </p>
              <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-5 rounded-2xl font-sans space-y-1">
                <p className="font-bold text-black dark:text-white">Hansjürg Wüthrich</p>
                <p>8320 Fehraltorf</p>
                <p>Suisse / Switzerland</p>
                <p className="pt-2">E-mail : <a href="mailto:support@Rsser.news" className="text-[var(--brand-orange)] hover:underline font-medium">support@Rsser.news</a></p>
              </div>
            </section>

            {/* EXCLUSION DE RESPONSABILITÉ POUR LES CONTENUS */}
            <section className="space-y-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/15 dark:border-orange-500/10 backdrop-blur-sm p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                ⚠️ Exclusion de responsabilité pour les contenus (Avis important)
              </h2>
              <p className="font-medium text-black dark:text-gray-200">
                RSSer est une plateforme d'infrastructure et d'agrégation purement technique.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                L'exploitant de RSSer (Hansjürg Wüthrich) est <strong>exclusivement responsable de la mise à disposition technique, de la maintenance et des fonctionnalités de la plateforme</strong>. 
                Il n'a aucun contrôle ni aucune influence sur les contenus chargés et affichés dynamiquement par le biais de flux RSS, de podcasts, de radios, de chaînes YouTube, de webcams ou d'autres sources originales tierces.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Pour tous les articles, actualités, textes, images, fichiers audio et vidéo, <strong>seuls les éditeurs tiers respectifs, les auteurs ou les exploitants d'origine des flux sources sont responsables</strong>. 
                De même, les utilisateurs enregistrés sont entièrement et exclusivement responsables des articles de blog et des métadonnées qu'ils rédigent et publient à l'aide de la fonctionnalité de blog (contenu généré par l'utilisateur).
              </p>
            </section>

            {/* Mentions détaillées */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Limitation de responsabilité générale</h2>
              <p className="text-sm leading-relaxed">
                L'exploitant décline toute responsabilité quant à l'exactitude, la précision, l'actualité, la fiabilité et l'exhaustivité des informations transmises ou agrégées.
              </p>
              <p className="text-sm leading-relaxed">
                Les réclamations en responsabilité contre l'exploitant pour des dommages de nature matérielle ou immatérielle résultant de l'accès, de l'utilisation ou de la non-utilisation des informations publiées, d'un mauvais usage de la connexion ou de dysfonctionnements techniques sont entièrement exclues.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Exclusion de responsabilité pour les liens</h2>
              <p className="text-sm leading-relaxed">
                Les renvois et liens vers des sites web tiers ne relèvent pas de notre domaine de responsabilité. Toute responsabilité pour ces sites web est déclinée. L'accès et l'utilisation de ces sites se font aux risques et périls de l'utilisateur.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Droits d'auteur</h2>
              <p className="text-sm leading-relaxed">
                Les droits d'auteur et tous les autres droits sur les contenus, images, photos ou autres fichiers de cette plateforme appartiennent – sauf indication contraire – aux titulaires de droits spécifiquement désignés ou aux éditeurs originaux des sources. Pour la reproduction de tout élément, le consentement écrit préalable des titulaires des droits d'auteur doit être obtenu.
              </p>
            </section>
          </div>
        );
      case 'es':
        return (
          // SPANISCHE VERSION
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Aviso Legal</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Última actualización: Julio 2026</p>
            </div>

            {/* Información del operador */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Editor y operador de la plataforma</h2>
              <p>
                El operador y socio contractual técnico de esta aplicación web es:
              </p>
              <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-5 rounded-2xl font-sans space-y-1">
                <p className="font-bold text-black dark:text-white">Hansjürg Wüthrich</p>
                <p>8320 Fehraltorf</p>
                <p>Suiza / Switzerland</p>
                <p className="pt-2">Correo electrónico: <a href="mailto:support@Rsser.news" className="text-[var(--brand-orange)] hover:underline font-medium">support@Rsser.news</a></p>
              </div>
            </section>

            {/* EXENCIÓN DE RESPONSABILIDAD DE CONTENIDOS */}
            <section className="space-y-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/15 dark:border-orange-500/10 backdrop-blur-sm p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                ⚠️ Exención de responsabilidad de contenidos (Aviso importante)
              </h2>
              <p className="font-medium text-black dark:text-gray-200">
                RSSer es una plataforma puramente técnica de infraestructura y agregación.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                El operador de RSSer (Hansjürg Wüthrich) es <strong>exclusivamente responsable de la provisión técnica, mantenimiento y funcionalidad de la plataforma</strong>.
                No tiene ninguna influencia ni control sobre los contenidos cargados y mostrados dinámicamente a través de canales RSS, podcasts, emisoras de radio, canales de YouTube, cámaras web u otras fuentes originales de terceros.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Para todos los artículos, noticias, textos, imágenes, archivos de audio o vídeo, <strong>los únicos responsables son los respectivos editores externos, autores o proveedores originales de los canales de origen</strong>.
                Asimismo, los usuarios registrados son total y exclusivamente responsables de las entradas de blog y metadatos que redacten y publiquen utilizando la función de blog (contenido generado por el usuario).
              </p>
            </section>

            {/* Cláusulas detalladas */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Exención de responsabilidad general</h2>
              <p className="text-sm leading-relaxed">
                El operador no asume ninguna garantía respecto a la veracidad, exactitud, actualidad, fiabilidad e integridad de la información transmitida o agregada.
              </p>
              <p className="text-sm leading-relaxed">
                Quedan totalmente excluidas las reclamaciones de responsabilidad contra el operador por daños de carácter material o inmaterial derivados del acceso, uso o no uso de la información publicada, del uso indebido de la conexión o de fallos técnicos.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Exención de responsabilidad por enlaces</h2>
              <p className="text-sm leading-relaxed">
                Las referencias y enlaces a sitios web de terceros quedan fuera de nuestro ámbito de responsabilidad. Se declina cualquier responsabilidad por dichos sitios web. El acceso y uso de dichos sitios web se realiza bajo el propio riesgo del usuario.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Derechos de autor</h2>
              <p className="text-sm leading-relaxed">
                Los derechos de autor y todos los demás derechos sobre los contenidos, imágenes, fotos u otros archivos de esta plataforma pertenecen – a menos que se indique lo contrario – a los titulares de derechos específicamente designados o a los editores originales de las fuentes. Para la reproducción de cualquier elemento, se debe obtener previamente el consentimiento por escrito de los titulares de los derechos de autor.
              </p>
            </section>
          </div>
        );
      case 'en':
      default:
        return (
          // ENGLISCHE VERSION (and fallback)
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Imprint (Legal Disclosure)</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: July 2026</p>
            </div>

            {/* Operator info */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Publisher and Operator</h2>
              <p>
                The operator and technical contract partner of this web application is:
              </p>
              <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-5 rounded-2xl font-sans space-y-1">
                <p className="font-bold text-black dark:text-white">Hansjürg Wüthrich</p>
                <p>8320 Fehraltorf</p>
                <p>Switzerland</p>
                <p className="pt-2">Email: <a href="mailto:support@Rsser.news" className="text-[var(--brand-orange)] hover:underline font-medium">support@Rsser.news</a></p>
              </div>
            </section>

            {/* IMPORTANT DISCLAIMER */}
            <section className="space-y-4 bg-orange-500/5 dark:bg-orange-500/10 border border-orange-500/15 dark:border-orange-500/10 backdrop-blur-sm p-6 rounded-2xl">
              <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400 flex items-center gap-2">
                ⚠️ Content Liability Disclaimer (Important Notice)
              </h2>
              <p className="font-medium text-black dark:text-gray-200">
                RSSer is a purely technical infrastructure and aggregation platform.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                The operator of RSSer (Hansjürg Wüthrich) is <strong>exclusively responsible for the technical deployment, maintenance, and features of the platform</strong>.
                He has absolutely no control or influence over the content pulled and loaded dynamically via RSS feeds, podcasts, radios, YouTube channels, webcams, or other third-party original sources.
              </p>
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                For all articles, news, text, graphics, audio, or video files, <strong>only the respective third-party publishers, authors, or original source feed operators are responsible</strong>.
                Similarly, registered users are fully and solely liable for any blog posts and metadata they author and publish using the blogging feature (User-Generated Content).
              </p>
            </section>

            {/* Detailed Disclaimers */}
            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Liability Disclaimer</h2>
              <p className="text-sm leading-relaxed">
                The operator assumes no liability whatsoever with regard to the correctness, accuracy, relevance, reliability, and completeness of the information transmitted or aggregated.
              </p>
              <p className="text-sm leading-relaxed">
                Liability claims against the operator for damages of a material or immaterial nature arising from access to, use of, or non-use of the published information, through misuse of the connection, or due to technical malfunctions are entirely excluded.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Disclaimer for Links</h2>
              <p className="text-sm leading-relaxed">
                References and links to third-party websites lie outside our scope of responsibility. Any responsibility for such websites is declined. Access and use of such websites are entirely at the user's own risk.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Copyrights</h2>
              <p className="text-sm leading-relaxed">
                Copyrights and all other rights to content, images, photos, or other files on this platform belong – unless stated otherwise – to the specifically named rights holders or original publishers. For the reproduction of any elements, the written consent of the copyright holders must be obtained in advance.
              </p>
            </section>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 bg-white dark:bg-[#0a0a0a] transition-colors duration-300 relative min-h-screen pt-24 pb-12 px-6 overflow-hidden">
      <AmbientWave className="fixed inset-0 w-full h-full pointer-events-none z-0 transition-opacity duration-1000" />
      <div className="relative z-10 max-w-4xl mx-auto bg-white/70 dark:bg-[#0f172a]/70 p-8 sm:p-12 rounded-3xl border border-gray-200/80 dark:border-gray-800/80 transition-colors duration-300 shadow-xl backdrop-blur-md">
        {renderContent()}
        <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800/50">
          <Link to="/" className="inline-block bg-[var(--brand-orange)] hover:bg-orange-600 text-white font-bold px-8 py-3 rounded-full transition-colors shadow-md shadow-orange-500/10">
            {lang === 'de' ? 'Zurück zur Startseite' : lang === 'fr' ? 'Retour à l\'accueil' : lang === 'es' ? 'Volver al inicio' : 'Back to Home'}
          </Link>
        </div>
      </div>
    </div>
  );
}
