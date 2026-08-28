import { Link } from 'react-router-dom';
import { useSettings } from '../context/SettingsContext';
import { AmbientWave } from './layout/AmbientWave';

export function DatenschutzPage() {
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
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Datenschutzerklärung</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Stand: Juli 2026</p>
            </div>

            <p className="lead text-lg">
              Wir nehmen den Schutz deiner Daten sehr ernst. RSSer ist darauf ausgelegt, die Privatsphäre zu respektieren. Wir tracken keine Nutzer und verwenden keine unnötigen Algorithmen, die deine Daten auswerten. Nachfolgend informieren wir dich ausführlich über den Umgang mit deinen Daten.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Allgemeine Hinweise und Pflichtinformationen</h2>
              
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Hinweis zur verantwortlichen Stelle</h3>
                <p>Die verantwortliche Stelle für die Datenverarbeitung auf dieser Website ist:</p>
                <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-4 rounded-xl font-mono text-sm space-y-1">
                  <p className="font-bold">RSSer News Support</p>
                  <p>E-Mail: <a href="mailto:support@rsser.news" className="text-[var(--brand-orange)] hover:underline">support@rsser.news</a></p>
                </div>
                <p className="text-sm">
                  Verantwortliche Stelle ist die natürliche oder juristische Person, die allein oder gemeinsam mit anderen über die Zwecke und Mittel der Verarbeitung von personenbezogenen Daten (z. B. Namen, E-Mail-Adressen o. Ä.) entscheidet.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Widerruf deiner Einwilligung zur Datenverarbeitung</h3>
                <p>
                  Viele Datenverarbeitungsvorgänge sind nur mit deiner ausdrücklichen Einwilligung möglich. Du kannst eine bereits erteilte Einwilligung jederzeit widerrufen. Dazu reicht eine formlose Mitteilung per E-Mail an uns. Die Rechtmäßigkeit der bis zum Widerruf erfolgten Datenverarbeitung bleibt vom Widerruf unberührt.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Beschwerderecht bei der zuständigen Aufsichtsbehörde</h3>
                <p>
                  Im Falle von Verstößen gegen die DSGVO steht den Betroffenen ein Beschwerderecht bei einer Aufsichtsbehörde, insbesondere in dem Mitgliedstaat ihres üblichen Aufenthaltsorts, ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes zu. Das Beschwerderecht besteht unbeschadet anderweitiger verwaltungsrechtlicher oder gerichtlicher Rechtsbehelfe.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Recht auf Datenübertragbarkeit</h3>
                <p>
                  Du hast das Recht, Daten, die wir auf Grundlage deiner Einwilligung oder in Erfüllung eines Vertrags automatisiert verarbeiten, an dich oder an einen Dritten in einem gängigen, maschinenlesbaren Format aushändigen zu lassen. Sofern du die direkte Übertragung der Daten an einen anderen Verantwortlichen verlangst, erfolgt dies nur, soweit es technisch machbar ist.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Auskunft, Berichtigung, Einschränkung und Löschung</h3>
                <p>
                  Du hast im Rahmen der geltenden gesetzlichen Bestimmungen jederzeit das Recht auf unentgeltliche Auskunft über deine gespeicherten personenbezogenen Daten, deren Herkunft und Empfänger und den Zweck der Datenverarbeitung und ggf. ein Recht auf Berichtigung, Einschränkung der Verarbeitung oder Löschung dieser Daten. Hierzu sowie zu weiteren Fragen zum Thema personenbezogene Daten kannst du dich jederzeit unter der im Impressum oder oben angegebenen E-Mail-Adresse an uns wenden.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Datenerfassung auf unserer Website</h2>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Cookies und LocalStorage (Lokaler Speicher)</h3>
                <p>
                  Unsere Internetseiten verwenden so genannte Cookies und den LocalStorage deines Browsers. Dies sind kleine Textdateien, die auf deinem Endgerät abgelegt werden. Sie richten keinen Schaden an.
                </p>
                <p>
                  Wir nutzen diese ausschließlich für technisch notwendige Funktionen, um dir den Dienst anzubieten:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Sicherung deiner Sitzung (Login-Status)</li>
                  <li>Speicherung deiner bevorzugten Sprache (Deutsch, Englisch, Französisch, Spanisch)</li>
                  <li>Speicherung deines bevorzugten Designs (Hell/Dunkel)</li>
                  <li>Erhaltung deiner Ansichtsmodi (Listen- oder Magazinansicht)</li>
                </ul>
                <p className="text-sm">
                  Es findet ausdrücklich kein Tracking zu Marketing- oder Analysezwecken durch Cookies von Drittanbietern statt.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Server-Log-Dateien</h3>
                <p>
                  Der Provider der Seiten erhebt und speichert automatisch Informationen in sogenannten Server-Log-Dateien, die dein Browser automatisch an uns übermittelt. Dies sind:
                </p>
                <ul className="list-disc pl-6 space-y-1 font-mono text-sm">
                  <li>Browsertyp und Browserversion</li>
                  <li>Verwendetes Betriebssystem</li>
                  <li>Referrer URL (die zuvor besuchte Seite)</li>
                  <li>Hostname des zugreifenden Rechners</li>
                  <li>Uhrzeit der Serveranfrage</li>
                  <li>IP-Adresse</li>
                </ul>
                <p>
                  Diese Daten werden erhoben, um die technische Stabilität und Sicherheit der Webseite zu gewährleisten. Eine Zusammenführung dieser Daten mit anderen Datenquellen wird nicht vorgenommen. Grundlage für die Datenverarbeitung ist Art. 6 Abs. 1 lit. f DSGVO, der die Verarbeitung von Daten zur Gewährleistung der Netzsicherheit erlaubt.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Registrierungsdaten (Firebase Authentication)</h3>
                <p>
                  Wenn du dich auf unserer Plattform registrierst (um Feeds zu speichern oder deinen eigenen Blog zu erstellen), erfassen wir:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Deine E-Mail-Adresse</li>
                  <li>Ein selbst gewähltes Passwort (wird verschlüsselt gespeichert)</li>
                  <li>Ggf. deinen Benutzernamen und ein Profilbild (freiwillig)</li>
                </ul>
                <p>
                  Diese Daten werden auf Grundlage von Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) zur Bereitstellung deines persönlichen Accounts verarbeitet.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Speicherung von Benutzerdaten (Cloud Firestore)</h3>
                <p>
                  Für angemeldete Benutzer speichern wir deine individuellen Einstellungen und Feed-Abonnements in einer sicheren Cloud-Datenbank (Google Cloud Firestore):
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Abonnierte RSS-Feeds, Radio-Stationen, Podcasts, YouTube-Kanäle und Webcams</li>
                  <li>Gelesene, gespeicherte oder favorisierte Artikel</li>
                  <li>Deinen eigenen Blog und die von dir verfassten Blog-Einträge (falls du die Blog-Funktion nutzt)</li>
                </ul>
                <p>
                  Diese Speicherung ist zwingend erforderlich, damit du von unterschiedlichen Geräten auf deine abonnierten Quellen zugreifen kannst. Wenn du dein Benutzerkonto löschst, werden all diese Daten automatisch und unwiderruflich aus unserer Datenbank gelöscht.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Dienstleister und Infrastruktur</h2>
              <p>
                Um unseren Dienst zuverlässig und sicher im Internet zur Verfügung zu stellen, greifen wir auf folgende Dienstleister zurück:
              </p>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Google Cloud / Firebase</h3>
                <p>
                  Wir nutzen die Cloud-Infrastruktur von Google (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland) für das Hosting des Servers (Google Cloud Run), die Datenbanken (Cloud Firestore) und die Authentifizierung (Firebase Auth).
                </p>
                <p>
                  Die Server und Datenbanken befinden sich in der EU-Region (z.B. Frankfurt, Deutschland), um die DSGVO-Konformität und minimale Latenzzeiten sicherzustellen. Wir haben mit Google einen Vertrag zur Auftragsverarbeitung (Data Processing Addendum) abgeschlossen, der Google verpflichtet, die Daten unserer Nutzer ausschließlich nach unseren Weisungen und DSGVO-konform zu verarbeiten.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. SSL- bzw. TLS-Verschlüsselung</h2>
              <p>
                Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte, wie zum Beispiel Anfragen oder Registrierungsdaten, die du an uns als Seitenbetreiber sendest, eine SSL-bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennst du daran, dass die Adresszeile des Browsers von „http://“ auf „https://“ wechselt und an dem Schloss-Symbol in deiner Browserzeile.
              </p>
              <p>
                Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten, die du an uns übermittelst, nicht von Dritten mitgelesen werden.
              </p>
            </section>
          </div>
        );
      case 'fr':
        return (
          // FRANZÖSISCHE VERSION
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Politique de Confidentialité</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Dernière mise à jour : Juillet 2026</p>
            </div>

            <p className="lead text-lg">
              Nous prenons la protection de vos données très au sérieux. RSSer est conçu pour respecter votre vie privée. Nous ne suivons pas les utilisateurs et n'utilisons pas d'algorithmes inutiles qui analysent vos données. Ci-dessous, nous vous fournissons des informations détaillées sur la manière dont nous traitons vos données.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Informations générales et mentions obligatoires</h2>
              
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Informations sur le responsable du traitement</h3>
                <p>Le responsable du traitement des données sur ce site internet est :</p>
                <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-4 rounded-xl font-mono text-sm space-y-1">
                  <p className="font-bold">RSSer News Support</p>
                  <p>E-mail : <a href="mailto:support@rsser.news" className="text-[var(--brand-orange)] hover:underline">support@rsser.news</a></p>
                </div>
                <p className="text-sm">
                  Le responsable du traitement est la personne physique ou morale qui, seule ou conjointement avec d'autres, détermine les finalités et les moyens du traitement des données personnelles (par exemple, les noms, les adresses e-mail, etc.).
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Révocation de votre consentement au traitement des données</h3>
                <p>
                  De nombreuses opérations de traitement des données ne sont possibles qu'avec votre consentement exprès. Vous pouvez révoquer un consentement déjà donné à tout moment. Une simple communication par e-mail suffit à cet effet. La légalité du traitement des données effectué avant la révocation n'est pas affectée par celle-ci.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Droit de déposer une plainte auprès de l'autorité de contrôle compétente</h3>
                <p>
                  En cas de violation du RGPD, les personnes concernées disposent d'un droit de réclamation auprès d'une autorité de contrôle, notamment dans l'État membre de leur résidence habituelle, de leur lieu de travail ou du lieu de la violation présumée.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Droit à la portabilité des données</h3>
                <p>
                  Vous avez le droit de recevoir les données que nous traitons automatiquement sur la base de votre consentement ou en exécution d'un contrat, pour vous-même ou pour un tiers, dans un format courant et lisible par machine. Si vous demandez le transfert direct des données à un autre responsable, cela ne se fera que dans la mesure où cela est techniquement possible.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Accès, rectification, limitation et suppression</h3>
                <p>
                  Dans le cadre des dispositions légales applicables, vous avez à tout moment le droit d'obtenir gratuitement des informations sur vos données personnelles stockées, leur origine, leurs destinataires et la finalité du traitement des données, ainsi que, le cas échéant, un droit de rectification, de limitation du traitement ou de suppression de ces données. Vous pouvez nous contacter à tout moment à l'adresse e-mail indiquée ci-dessus.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Collecte de données sur notre site internet</h2>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Cookies et stockage local (LocalStorage)</h3>
                <p>
                  Nos pages internet utilisent des cookies et le stockage local de votre navigateur. Il s'agit de petits fichiers texte stockés sur votre appareil qui ne causent aucun dommage.
                </p>
                <p>
                  Nous les utilisons exclusivement pour les fonctionnalités techniquement nécessaires à la fourniture du service :
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Sécurisation de votre session (état de connexion)</li>
                  <li>Stockage de votre langue préférée (anglais, allemand, français, espagnol)</li>
                  <li>Stockage de votre thème préféré (clair/sombre)</li>
                  <li>Enregistrement de votre mode d'affichage (vue en liste ou en magazine)</li>
                </ul>
                <p className="text-sm">
                  Nous n'effectuons explicitement aucun suivi par des tiers, ni de stockage de cookies à des fins de marketing ou d'analyse.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Fichiers journaux du serveur</h3>
                <p>
                  Le fournisseur des pages collecte et stocke automatiquement des informations dans des fichiers journaux du serveur, que votre navigateur nous transmet automatiquement. Ce sont :
                </p>
                <ul className="list-disc pl-6 space-y-1 font-mono text-sm">
                  <li>Type et version du navigateur</li>
                  <li>Système d'exploitation utilisé</li>
                  <li>URL de référence (la page précédemment visitée)</li>
                  <li>Nom d'hôte de l'ordinateur qui accède</li>
                  <li>Heure de la requête du serveur</li>
                  <li>Adresse IP</li>
                </ul>
                <p>
                  Ces données sont collectées pour garantir la stabilité technique et la sécurité du site internet. Elles ne sont pas fusionnées avec d'autres sources de données.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Données d'enregistrement (Firebase Authentication)</h3>
                <p>
                  Si vous vous enregistrez sur notre plateforme (pour enregistrer des flux ou rédiger vos propres articles de blog), nous collectons :
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Votre adresse e-mail</li>
                  <li>Un mot de passe choisi par vos soins (stocké de manière cryptée)</li>
                  <li>Un nom d'utilisateur et une photo de profil optionnels (volontaires)</li>
                </ul>
                <p>
                  Ces données sont traitées sur la base de l'art. 6 (1) (b) du RGPD (exécution du contrat) pour fournir votre compte personnel.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Stockage des données utilisateur (Cloud Firestore)</h3>
                <p>
                  Pour les utilisateurs enregistrés, nous enregistrons vos paramètres personnalisés et vos abonnements aux flux dans une base de données cloud sécurisée (Google Cloud Firestore) :
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Flux RSS abonnés, stations de radio, podcasts, chaînes YouTube et webcams</li>
                  <li>Articles lus, enregistrés ou favorisés</li>
                  <li>Vos propres articles de blog et métadonnées (si vous utilisez la fonctionnalité de blog)</li>
                </ul>
                <p>
                  Ce stockage est techniquement nécessaire pour que vous puissiez accéder à votre fil d'actualité personnalisé depuis différents appareils. Si vous supprimez votre compte, toutes ces données sont définitivement et irrévocablement supprimées de notre base de données.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Prestataires de services et infrastructure</h2>
              <p>
                Afin de faire fonctionner nos services de manière fiable et sécurisée sur Internet, nous collaborons avec le prestataire de services suivant :
              </p>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Google Cloud / Firebase</h3>
                <p>
                  Nous utilisons Google Cloud (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlande) pour l'hébergement du serveur (Google Cloud Run), les bases de données cloud (Cloud Firestore) et la connexion des utilisateurs (Firebase Auth).
                </p>
                <p>
                  Nos serveurs et bases de données sont situés dans des centres de données basés dans l'UE (par exemple, à Francfort, en Allemagne) afin de se conformer aux exigences du RGPD. Nous avons conclu un accord de traitement des données (DPA) standard avec Google pour garantir une sécurité et une conformité strictes avec les réglementations sur le traitement des données.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Cryptage SSL ou TLS</h2>
              <p>
                Ce site utilise le cryptage SSL ou TLS pour des raisons de sécurité et pour protéger la transmission de contenus confidentiels, tels que les requêtes ou les détails d'enregistrement que vous nous envoyez en tant qu'opérateur du site.
              </p>
            </section>
          </div>
        );
      case 'es':
        return (
          // SPANISCHE VERSION
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Política de Privacidad</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Última actualización: Julio 2026</p>
            </div>

            <p className="lead text-lg">
              Nos tomamos muy en serio la protección de sus datos. RSSer está diseñado para respetar su privacidad. No realizamos un seguimiento de los usuarios ni utilizamos algoritmos innecesarios que analicen sus datos. A continuación, le proporcionamos información detallada sobre cómo manejamos sus datos.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. Información general y divulgaciones obligatorias</h2>
              
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Información sobre el responsable del tratamiento</h3>
                <p>El responsable del tratamiento de datos en este sitio web es:</p>
                <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-4 rounded-xl font-mono text-sm space-y-1">
                  <p className="font-bold">RSSer News Support</p>
                  <p>Correo electrónico: <a href="mailto:support@rsser.news" className="text-[var(--brand-orange)] hover:underline">support@rsser.news</a></p>
                </div>
                <p className="text-sm">
                  El responsable es la persona física o jurídica que, de forma individual o conjunta con otras, determina los fines y los medios del tratamiento de datos personales (por ejemplo, nombres, direcciones de correo electrónico, etc.).
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Revocación de su consentimiento para el tratamiento de datos</h3>
                <p>
                  Muchas operaciones de tratamiento de datos solo son posibles con su consentimiento expreso. Puede revocar un consentimiento ya otorgado en cualquier momento. Una simple comunicación por correo electrónico es suficiente para este propósito. La legalidad del tratamiento de datos realizado antes de la revocación no se verá afectada.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Derecho a presentar una reclamación ante la autoridad de control competente</h3>
                <p>
                  En caso de violaciones del RGPD, los interesados tienen derecho a presentar una reclamación ante una autoridad de control, en particular en el Estado miembro de su residencia habitual, lugar de trabajo o lugar de la supuesta infracción.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Derecho a la portabilidad de los datos</h3>
                <p>
                  Tiene derecho a que los datos que procesamos automáticamente sobre la base de su consentimiento o en cumplimiento de un contrato se le entreguen a usted o a un tercero en un formato común y legible por máquina. Si solicita la transferencia directa de los datos a otro responsable, esto solo se realizará en la medida en que sea técnicamente factible.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Acceso, rectificación, limitación y supresión</h3>
                <p>
                  Dentro del marco de las disposiciones legales aplicables, tiene derecho en cualquier momento a recibir información gratuita sobre sus datos personales almacenados, su origen y destinatarios, y la finalidad del tratamiento de datos y, si procede, el derecho a la rectificación, limitación del tratamiento o supresión de estos datos. Puede ponerse en contacto con nosotros en cualquier momento utilizando la dirección de correo electrónico indicada anteriormente.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Recopilación de datos en nuestro sitio web</h2>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Cookies y almacenamiento local (LocalStorage)</h3>
                <p>
                  Nuestras páginas web utilizan cookies y el almacenamiento local de su navegador. Se trata de pequeños archivos de texto almacenados en su dispositivo que no causan ningún daño.
                </p>
                <p>
                  Los utilizamos exclusivamente para funciones técnicamente necesarias para proporcionar el servicio:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Asegurar su sesión (estado de inicio de sesión)</li>
                  <li>Almacenar su idioma preferido (inglés, alemán, francés, español)</li>
                  <li>Almacenar su tema preferido (claro/oscuro)</li>
                  <li>Guardar su modo de diseño (vista de lista o revista)</li>
                </ul>
                <p className="text-sm">
                  No realizamos explícitamente ningún seguimiento de terceros, ni almacenamiento de cookies analíticas o de marketing.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Archivos de registro del servidor</h3>
                <p>
                  El proveedor de las páginas recopila y almacena automáticamente información en los llamados archivos de registro del servidor, que su navegador nos transmite automáticamente. Estos son:
                </p>
                <ul className="list-disc pl-6 space-y-1 font-mono text-sm">
                  <li>Tipo y versión del navegador</li>
                  <li>Sistema operativo utilizado</li>
                  <li>URL de referencia (la página visitada anteriormente)</li>
                  <li>Nombre de host de la computadora que accede</li>
                  <li>Hora de la solicitud del servidor</li>
                  <li>Dirección IP</li>
                </ul>
                <p>
                  Estos datos se recopilan para garantizar la estabilidad técnica y la seguridad del sitio web. No se fusionan con otras fuentes de datos.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Datos de registro (Firebase Authentication)</h3>
                <p>
                  Si se registra en nuestra plataforma (para guardar canales o escribir sus propias publicaciones de blog), recopilamos:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Su dirección de correo electrónico</li>
                  <li>Una contraseña elegida por usted (almacenada de forma encriptada)</li>
                  <li>Nombre de usuario y foto de perfil opcionales (voluntario)</li>
                </ul>
                <p>
                  Estos datos se procesan sobre la base del Art. 6 (1) (b) del RGPD (cumplimiento del contrato) para proporcionar su cuenta personal.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Almacenamiento de datos de usuario (Cloud Firestore)</h3>
                <p>
                  Para los usuarios registrados, guardamos su configuración personalizada y suscripciones a canales en una base de datos segura en la nube (Google Cloud Firestore):
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Canales RSS suscritos, emisoras de radio, podcasts, canales de YouTube y cámaras web</li>
                  <li>Artículos leídos, guardados o marcados como favoritos</li>
                  <li>Sus propias publicaciones de blog y metadatos (si utiliza la función de blog)</li>
                </ul>
                <p>
                  Este almacenamiento es técnicamente necesario para que pueda acceder a su canal de noticias personalizado desde diferentes dispositivos. Si elimina su cuenta, todos estos datos se eliminarán de forma permanente e irrevocable de nuestra base de datos.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Proveedores de servicios e infraestructura</h2>
              <p>
                Para que nuestros servicios funcionen de manera confiable y segura en Internet, colaboramos con el siguiente proveedor de servicios:
              </p>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Google Cloud / Firebase</h3>
                <p>
                  Utilizamos Google Cloud (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irlanda) para el alojamiento del servidor (Google Cloud Run), bases de datos en la nube (Cloud Firestore) y el inicio de sesión del usuario (Firebase Auth).
                </p>
                <p>
                  Nuestros nodos de servidor y bases de datos están situados en centros de datos basados en la UE (por ejemplo, en Frankfurt, Alemania) para cumplir con los requisitos del RGPD. Hemos concluido un Acuerdo de Tratamiento de Datos (DPA) estándar con Google para garantizar una seguridad estricta y el cumplimiento de las normativas de procesamiento de datos.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. Encriptación SSL o TLS</h2>
              <p>
                Este sitio utiliza encriptación SSL o TLS por razones de seguridad y para proteger la transmisión de contenido confidencial, como las solicitudes o los detalles de registro que nos envía como operador del sitio.
              </p>
            </section>
          </div>
        );
      case 'en':
      default:
        return (
          // ENGLISH VERSION (and other languages fallback)
          <div className="text-gray-700 dark:text-gray-300 space-y-8">
            <div>
              <h1 className="text-3xl font-black mb-4 text-black dark:text-white tracking-tight">Privacy Policy</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last updated: July 2026</p>
            </div>

            <p className="lead text-lg">
              We take the protection of your data very seriously. RSSer is designed to respect your privacy. We do not track users and do not use unnecessary algorithms that analyze your data. Below we provide detailed information about how we handle your data.
            </p>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">1. General Information and Mandatory Disclosures</h2>
              
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Information on the Controller / Responsible Party</h3>
                <p>The party responsible for data processing on this website is:</p>
                <div className="bg-slate-500/5 dark:bg-white/5 border border-slate-500/10 dark:border-white/5 backdrop-blur-sm p-4 rounded-xl font-mono text-sm space-y-1">
                  <p className="font-bold">RSSer News Support</p>
                  <p>Email: <a href="mailto:support@rsser.news" className="text-[var(--brand-orange)] hover:underline">support@rsser.news</a></p>
                </div>
                <p className="text-sm">
                  The controller is the natural or legal person who alone or jointly with others determines the purposes and means of the processing of personal data (e.g., names, email addresses, etc.).
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Revocation of Your Consent to Data Processing</h3>
                <p>
                  Many data processing operations are only possible with your express consent. You can revoke consent you have already given at any time. An informal email communication to us is sufficient for this purpose. The legality of the data processing carried out before the revocation remains unaffected.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Right to File a Complaint with the Competent Supervisory Authority</h3>
                <p>
                  In the event of violations of the GDPR, data subjects have a right to file a complaint with a supervisory authority, in particular in the Member State of their habitual residence, place of work, or place of the alleged violation.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Right to Data Portability</h3>
                <p>
                  You have the right to have data that we process automatically based on your consent or in fulfillment of a contract handed over to you or to a third party in a common, machine-readable format.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Access, Rectification, Restriction, and Deletion</h3>
                <p>
                  Within the framework of the applicable legal provisions, you have the right to free information about your stored personal data, its origin and recipient, and the purpose of data processing and, if applicable, a right to rectification, restriction of processing, or deletion of this data at any time. You can contact us at any time using the email address provided above.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">2. Data Collection on Our Website</h2>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Cookies and LocalStorage</h3>
                <p>
                  Our web pages use so-called cookies and your browser's local storage. These are small text files stored on your device that do not cause any harm.
                </p>
                <p>
                  We use them exclusively for technically necessary features to provide the service:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Securing your session (login status)</li>
                  <li>Storing your preferred language (English, German, French, Spanish)</li>
                  <li>Storing your preferred theme (light/dark)</li>
                  <li>Saving your layout mode (list or magazine view)</li>
                </ul>
                <p className="text-sm">
                  We explicitly do not perform any third-party tracking, marketing, or analytic cookie storage.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Server Log Files</h3>
                <p>
                  The provider of the pages automatically collects and stores information in so-called server log files, which your browser automatically transmits to us. These are:
                </p>
                <ul className="list-disc pl-6 space-y-1 font-mono text-sm">
                  <li>Browser type and version</li>
                  <li>Operating system used</li>
                  <li>Referrer URL (the previously visited page)</li>
                  <li>Host name of the accessing computer</li>
                  <li>Time of the server request</li>
                  <li>IP address</li>
                </ul>
                <p>
                  This data is collected to ensure the technical stability and security of the website. It is not merged with other data sources.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Registration Data (Firebase Authentication)</h3>
                <p>
                  If you register on our platform (to save feeds or write your own blog posts), we collect:
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Your email address</li>
                  <li>A password chosen by you (stored in encrypted form)</li>
                  <li>Optional username and profile picture (voluntary)</li>
                </ul>
                <p>
                  This data is processed based on Art. 6 (1) (b) GDPR (contract fulfillment) to provide your personal account.
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Storage of User Data (Cloud Firestore)</h3>
                <p>
                  For registered users, we save your custom settings and feed subscriptions in a secure cloud database (Google Cloud Firestore):
                </p>
                <ul className="list-disc pl-6 space-y-1">
                  <li>Subscribed RSS feeds, radio stations, podcasts, YouTube channels, and webcams</li>
                  <li>Read, saved, or favorited articles</li>
                  <li>Your own blog posts and metadata (if you use the blogging feature)</li>
                </ul>
                <p>
                  This storage is technically necessary so you can access your personalized news feed from different devices. If you delete your account, all this data is permanently and irrevocably deleted from our database.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">3. Service Providers and Infrastructure</h2>
              <p>
                In order to run our services reliably and securely on the internet, we cooperate with the following service provider:
              </p>
              <div className="space-y-3">
                <h3 className="text-lg font-bold text-black dark:text-white">Google Cloud / Firebase</h3>
                <p>
                  We use Google Cloud (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Ireland) for server hosting (Google Cloud Run), cloud databases (Cloud Firestore), and user login (Firebase Auth).
                </p>
                <p>
                  Our server nodes and databases are situated in EU-based data centers (e.g., Frankfurt, Germany) to comply with GDPR requirements. We have concluded a standard Data Processing Addendum (DPA) with Google to guarantee strict security and compliance with data processing regulations.
                </p>
              </div>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-bold text-black dark:text-white border-b border-gray-200 dark:border-gray-800 pb-2">4. SSL or TLS Encryption</h2>
              <p>
                This site uses SSL or TLS encryption for security reasons and to protect the transmission of confidential content, such as requests or registration details you send to us as site operator. You can recognize an encrypted connection because the browser's address line changes from "http://" to "https://" and by the lock icon in your browser line.
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
