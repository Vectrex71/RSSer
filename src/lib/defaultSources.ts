import { collection, getDocs, addDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export const DEFAULT_SOURCES = [
  // ==========================================
  // PODCASTS (Deutsch)
  // ==========================================
  { type: 'podcasts', title: '11KM: der tagesschau-Podcast', url: 'https://www.ndr.de/nachrichten/info/podcast5518.xml', category: 'Nachrichten', language: 'de' },
  { type: 'podcasts', title: 'Lage der Nation', url: 'https://feeds.lagedernation.org/feeds/ldn-mp3.xml', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Zeit Verbrechen', url: 'https://zeitverlag.podigee.io/feed/mp3', category: 'True Crime', language: 'de' },
  { type: 'podcasts', title: 'Quarks - Wissenschaft und mehr', url: 'https://www1.wdr.de/radio/podcasts/wdr5/quarks-116.podcast', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'SWR2 Wissen', url: 'https://www.swr.de/~podcast/swr2/wissen/podcast-swr2-wissen-100.xml', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'Bayern 2 - radioWissen', url: 'https://xml.br.de/podcast/radiowissen/cast.xml', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'Apokalypse & Filterkaffee', url: 'https://apokalypse-und-filterkaffee.podigee.io/feed/mp3', category: 'Nachrichten', language: 'de' },
  { type: 'podcasts', title: 'Steingarts Morning Briefing', url: 'https://steingarts-morning-briefing.podigee.io/feed/mp3', category: 'Wirtschaft', language: 'de' },
  { type: 'podcasts', title: 'Deutschlandfunk - Hintergrund', url: 'https://www.deutschlandfunk.de/podcast-hintergrund.xml', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Deutschlandfunk Nova - Eine Stunde History', url: 'https://www.deutschlandfunknova.de/podcast/eine-stunde-history', category: 'Geschichte', language: 'de' },
  { type: 'podcasts', title: 'Deutschlandfunk Nova - Hörsaal', url: 'https://www.deutschlandfunknova.de/podcast/hoersaal', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'WDR 5 - Das philosophische Radio', url: 'https://www1.wdr.de/radio/podcasts/wdr5/philosophisches-radio-106.podcast', category: 'Kultur', language: 'de' },
  { type: 'podcasts', title: 'WDR 5 - Presseclub', url: 'https://www1.wdr.de/radio/podcasts/wdr5/presseclub-106.podcast', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Macht & Millionen', url: 'https://machtundmillionen.podigee.io/feed/mp3', category: 'Wirtschaft', language: 'de' },
  { type: 'podcasts', title: 'Kalk & Welk', url: 'https://www.radioeins.de/archiv/podcast/kalk_und_welk.xml/feed=podcast.xml', category: 'Comedy', language: 'de' },
  { type: 'podcasts', title: 'Einschlafen Podcast', url: 'https://einschlafen-podcast.de/feed/mp3/', category: 'Unterhaltung', language: 'de' },
  { type: 'podcasts', title: 'Aufwachen! Podcast', url: 'https://aufwachen-podcast.de/feed/mp3/', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Methodisch inkorrekt!', url: 'https://minkorrekt.de/feed/mp3/', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'Sternengeschichten', url: 'https://sternengeschichten.podigee.io/feed/mp3', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'CRE: Technik, Kultur, Gesellschaft', url: 'https://cre.fm/feed/m4a', category: 'Gesellschaft', language: 'de' },
  { type: 'podcasts', title: 'Logbuch:Netzpolitik', url: 'https://logbuch-netzpolitik.de/feed/m4a', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'WRINT: Wissenschaft', url: 'https://wrint.de/category/wissenschaft/feed/', category: 'Wissen', language: 'de' },
  { type: 'podcasts', title: 'Piratensender Powerplay', url: 'https://piratensenderpowerplay.podigee.io/feed/mp3', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Sicherheitshalber', url: 'https://sicherheitspod.de/feed/mp3/', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Alles Gesagt?', url: 'https://zeitverlag.podigee.io/feed/mp3', category: 'Interview', language: 'de' }, // Fix url later if they differ
  { type: 'podcasts', title: 'Servus. Grüezi. Hallo.', url: 'https://servus-gruezi-hallo.podigee.io/feed/mp3', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Das Politikteil', url: 'https://das-politikteil.podigee.io/feed/mp3', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Was jetzt?', url: 'https://was-jetzt.podigee.io/feed/mp3', category: 'Nachrichten', language: 'de' },
  { type: 'podcasts', title: 'Das Podcast Ufo', url: 'https://podcast-ufo.fail/feed/mp3', category: 'Comedy', language: 'de' },
  { type: 'podcasts', title: 'Plauschangriff', url: 'https://plauschangriff.podigee.io/feed/mp3', category: 'Gaming', language: 'de' },
  { type: 'podcasts', title: 'Hooked FM', url: 'https://hooked.podcaster.de/hooked.rss', category: 'Gaming', language: 'de' },
  { type: 'podcasts', title: 'The Pod / Auf ein Bier', url: 'https://www.gamespodcast.de/feed/auf-ein-bier/', category: 'Gaming', language: 'de' },
  { type: 'podcasts', title: 'Stay Forever', url: 'https://www.stayforever.de/feed/podcast/', category: 'Gaming', language: 'de' },
  { type: 'podcasts', title: 'Mordlust', url: 'https://mordlust.podigee.io/feed/mp3', category: 'True Crime', language: 'de' },
  { type: 'podcasts', title: 'Verbrechen von nebenan', url: 'https://verbrechenvonnebenan.podigee.io/feed/mp3', category: 'True Crime', language: 'de' },
  { type: 'podcasts', title: 'WDR 2 Jörg Thadeusz', url: 'https://www1.wdr.de/mediathek/audio/wdr2/wdr2-thadeusz/joerg-thadeusz-102.podcast', category: 'Interview', language: 'de' },
  { type: 'podcasts', title: 'OMR Podcast', url: 'https://omrpodcast.podigee.io/feed/mp3', category: 'Wirtschaft', language: 'de' },
  { type: 'podcasts', title: 'Doppelgänger Tech Talk', url: 'https://www.doppelgaenger.io/feed/podcast', category: 'Wirtschaft', language: 'de' },
  { type: 'podcasts', title: 'Kassenzone', url: 'https://kassenzone.podigee.io/feed/mp3', category: 'Wirtschaft', language: 'de' },
  { type: 'podcasts', title: 'Die neuen Zwanziger', url: 'https://neuezwanziger.de/feed/mp3/', category: 'Politik', language: 'de' },
  { type: 'podcasts', title: 'Die Wochendämmerung', url: 'https://wochendaemmerung.de/feed/mp3/', category: 'Nachrichten', language: 'de' },

  // ==========================================
  // FEEDS (Deutsch)
  // ==========================================
  { type: 'feeds', title: 'Heise Online News', url: 'https://www.heise.de/rss/heise-atom.xml', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Heise Developer', url: 'https://www.heise.de/developer/rss/news-atom.xml', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Tagesschau', url: 'https://www.tagesschau.de/xml/rss2/', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Spiegel Online', url: 'https://www.spiegel.de/schlagzeilen/tops/index.rss', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Golem.de', url: 'https://rss.golem.de/rss.php?feed=RSS2.0', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'T3N News', url: 'https://t3n.de/news/feed/', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Caschys Blog', url: 'https://stadt-bremerhaven.de/feed/', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Mobiflip', url: 'https://www.mobiflip.de/feed/', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Der Postillon', url: 'https://feeds.feedburner.com/blogspot/rkEL', category: 'Satire', language: 'de' },
  { type: 'feeds', title: 'FAZ.NET Aktuell', url: 'https://www.faz.net/rss/aktuell/', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'SZ.de Top-Themen', url: 'https://rss.sueddeutsche.de/rss/Topthemen', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Zeit Online', url: 'https://newsfeed.zeit.de/index', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Stern.de', url: 'https://www.stern.de/feed/standard/alle-nachrichten/', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'NZZ International', url: 'https://www.nzz.ch/international.rss', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'SRF News', url: 'https://www.srf.ch/news/bnf/rss/1646', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Kicker Top-News', url: 'https://rss.kicker.de/news/aktuell', category: 'Sport', language: 'de' },
  { type: 'feeds', title: 'Sport1', url: 'https://www.sport1.de/news/rss', category: 'Sport', language: 'de' },
  { type: 'feeds', title: '11 FREUNDE', url: 'https://11freunde.de/feed/rss/', category: 'Sport', language: 'de' },
  { type: 'feeds', title: 'Winfuture', url: 'https://static.winfuture.de/feeds/WinFuture-News-rss2.0.xml', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Netzpolitik.org', url: 'https://netzpolitik.org/feed/', category: 'Politik', language: 'de' },
  { type: 'feeds', title: 'Krautreporter', url: 'https://krautreporter.de/feed.rss', category: 'Journalismus', language: 'de' },
  { type: 'feeds', title: 'Bildblog', url: 'https://bildblog.de/feed/', category: 'Journalismus', language: 'de' },
  { type: 'feeds', title: 'Deskmodder', url: 'https://www.deskmodder.de/blog/feed/', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'ComputerBase', url: 'https://www.computerbase.de/rss/news.xml', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'Hardwareluxx', url: 'https://www.hardwareluxx.de/index.php?format=feed&type=rss', category: 'Tech', language: 'de' },
  { type: 'feeds', title: 'PC Games Hardware', url: 'https://www.pcgameshardware.de/feed/rss2/', category: 'Gaming', language: 'de' },
  { type: 'feeds', title: 'GameStar', url: 'https://www.gamestar.de/news/rss/news.rss', category: 'Gaming', language: 'de' },
  { type: 'feeds', title: '4Players', url: 'https://www.4players.de/feeds/news.xml', category: 'Gaming', language: 'de' },
  { type: 'feeds', title: 'Handelsblatt', url: 'https://www.handelsblatt.com/contentexport/feed/top-themen', category: 'Wirtschaft', language: 'de' },
  { type: 'feeds', title: 'WirtschaftsWoche', url: 'https://www.wiwo.de/contentexport/feed/rss/schlagzeilen', category: 'Wirtschaft', language: 'de' },
  { type: 'feeds', title: 'Tagesspiegel', url: 'https://www.tagesspiegel.de/contentexport/feed/home', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'taz.de', url: 'https://taz.de/!p4608;rss/', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Focus Online', url: 'https://rss.focus.de/fol/XML/rss_folnews.xml', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Welt.de', url: 'https://www.welt.de/feeds/topnews.rss', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Der Standard', url: 'https://www.derstandard.at/rss', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Krone.at', url: 'https://www.krone.at/rss/news.xml', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: 'Blick.ch', url: 'https://www.blick.ch/news/rss.xml', category: 'Nachrichten', language: 'de' },
  { type: 'feeds', title: '20 Minuten', url: 'https://www.20min.ch/rss/front', category: 'Nachrichten', language: 'de' },

  // ==========================================
  // RADIO (International & Deutsch)
  // ==========================================
  { type: 'radio', title: 'WDR 1LIVE', url: 'https://wdr-1live-live.icecast.wdr.de/wdr/1live/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'WDR 2', url: 'https://wdr-wdr2-rheinruhr.icecast.wdr.de/wdr/wdr2/rheinruhr/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'WDR 3', url: 'https://wdr-wdr3-live.icecast.wdr.de/wdr/wdr3/live/mp3/128/stream.mp3', category: 'Kultur', language: 'de' },
  { type: 'radio', title: 'WDR 4', url: 'https://wdr-wdr4-live.icecast.wdr.de/wdr/wdr4/live/mp3/128/stream.mp3', category: 'Oldies', language: 'de' },
  { type: 'radio', title: 'WDR 5', url: 'https://wdr-wdr5-live.icecast.wdr.de/wdr/wdr5/live/mp3/128/stream.mp3', category: 'Wort', language: 'de' },
  { type: 'radio', title: 'COSMO', url: 'https://wdr-cosmo-live.icecast.wdr.de/wdr/cosmo/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'SWR1 BW', url: 'https://swr-swr1-bw.cast.addradio.de/swr/swr1/bw/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'SWR2', url: 'https://swr-swr2-live.cast.addradio.de/swr/swr2/live/mp3/128/stream.mp3', category: 'Kultur', language: 'de' },
  { type: 'radio', title: 'SWR3', url: 'https://swr-swr3-live.cast.addradio.de/swr/swr3/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'SWR4 BW', url: 'https://swr-swr4-bw.cast.addradio.de/swr/swr4/bw/mp3/128/stream.mp3', category: 'Schlager', language: 'de' },
  { type: 'radio', title: 'DASDING', url: 'https://swr-dasding-live.cast.addradio.de/swr/dasding/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'NDR 1 Niedersachsen', url: 'https://ndr-ndr1niedersachsen-hannover.cast.addradio.de/ndr/ndr1niedersachsen/hannover/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'NDR 2', url: 'https://ndr-ndr2-niedersachsen.cast.addradio.de/ndr/ndr2/niedersachsen/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'N-JOY', url: 'https://ndr-njoy-live.cast.addradio.de/ndr/njoy/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'NDR Info', url: 'https://ndr-ndrinfo-live.cast.addradio.de/ndr/ndrinfo/live/mp3/128/stream.mp3', category: 'Nachrichten', language: 'de' },
  { type: 'radio', title: 'BR-Klassik', url: 'https://br-brklassik-live.cast.addradio.de/br/brklassik/live/mp3/128/stream.mp3', category: 'Klassik', language: 'de' },
  { type: 'radio', title: 'Bayern 1', url: 'https://br-bayern1-obb.cast.addradio.de/br/bayern1/obb/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'Bayern 2', url: 'https://br-bayern2-sued.cast.addradio.de/br/bayern2/sued/mp3/128/stream.mp3', category: 'Kultur', language: 'de' },
  { type: 'radio', title: 'Bayern 3', url: 'https://br-bayern3-live.cast.addradio.de/br/bayern3/live/mp3/128/stream.mp3', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'BR24', url: 'https://br-br24-live.cast.addradio.de/br/br24/live/mp3/128/stream.mp3', category: 'Nachrichten', language: 'de' },
  { type: 'radio', title: 'Antenne Bayern', url: 'https://mp3channels.webradio.antenne.de/antenne', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'Rock Antenne', url: 'https://mp3channels.webradio.antenne.de/rockantenne', category: 'Rock', language: 'de' },
  { type: 'radio', title: 'Radio BOB!', url: 'https://bob.hoerradar.de/radiobob-live-mp3-hq', category: 'Rock', language: 'de' },
  { type: 'radio', title: 'sunshine live', url: 'https://sunshinelive.hoerradar.de/sunshinelive-live-mp3-hq', category: 'Electronic', language: 'de' },
  { type: 'radio', title: 'bigFM', url: 'https://streams.bigfm.de/bigfm-deutschland-128-mp3', category: 'Urban', language: 'de' },
  { type: 'radio', title: 'BBC Radio 1', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_one', category: 'Pop', language: 'en' },
  { type: 'radio', title: 'BBC Radio 2', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_two', category: 'Pop', language: 'en' },
  { type: 'radio', title: 'BBC Radio 3', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_three', category: 'Klassik', language: 'en' },
  { type: 'radio', title: 'BBC Radio 4', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_radio_fourfm', category: 'Wort', language: 'en' },
  { type: 'radio', title: 'BBC Radio 6 Music', url: 'http://stream.live.vc.bbcmedia.co.uk/bbc_6music', category: 'Alternative', language: 'en' },
  { type: 'radio', title: 'Radio Swiss Pop', url: 'http://stream.srg-ssr.ch/m/rsp/mp3_128', category: 'Pop', language: 'de' },
  { type: 'radio', title: 'Radio Swiss Jazz', url: 'http://stream.srg-ssr.ch/m/rsj/mp3_128', category: 'Jazz', language: 'de' },
  { type: 'radio', title: 'Radio Swiss Classic', url: 'http://stream.srg-ssr.ch/m/rsc_de/mp3_128', category: 'Klassik', language: 'de' },
  { type: 'radio', title: 'Wacken Radio', url: 'https://wacken.stream.laut.fm/wacken', category: 'Heavy Metal', language: 'de' },
  { type: 'radio', title: '100% 80er', url: 'https://mp3channels.webradio.antenne.de/80er-hits', category: '80s', language: 'de' },
  { type: 'radio', title: '100% 90er', url: 'https://mp3channels.webradio.antenne.de/90er-hits', category: '90s', language: 'de' },
  { type: 'radio', title: 'Defjay', url: 'https://defjay.stream.laut.fm/defjay', category: 'Black', language: 'de' },
  { type: 'radio', title: 'KEXP', url: 'https://kexp-mp3-128.streamguys1.com/kexp128.mp3', category: 'Alternative', language: 'en' },
  { type: 'radio', title: 'NTS Radio 1', url: 'https://stream-relay-geo.ntslive.net/stream', category: 'Alternative', language: 'en' },
  { type: 'radio', title: 'NTS Radio 2', url: 'https://stream-relay-geo.ntslive.net/stream2', category: 'Alternative', language: 'en' },
  { type: 'radio', title: 'SomaFM: Groove Salad', url: 'https://ice1.somafm.com/groovesalad-128-mp3', category: 'Chillout', language: 'en' },
  { type: 'radio', title: 'SomaFM: Drone Zone', url: 'https://ice1.somafm.com/dronezone-128-mp3', category: 'Ambient', language: 'en' },
  { type: 'radio', title: 'SomaFM: Secret Agent', url: 'https://ice1.somafm.com/secretagent-128-mp3', category: 'Chillout', language: 'en' },
  
  // ==========================================
  // YOUTUBE (International & Deutsch)
  // ==========================================
  { type: 'youtube', title: 'Kurzgesagt - In a Nutshell', url: 'https://www.youtube.com/@kurzgesagt', category: 'Wissen', language: 'de' },
  { type: 'youtube', title: 'Dinge Erklärt – Kurzgesagt', url: 'https://www.youtube.com/@kurzgesagt_de', category: 'Wissen', language: 'de' },
  { type: 'youtube', title: 'MKBHD', url: 'https://www.youtube.com/@mkbhd', category: 'Tech', language: 'en' },
  { type: 'youtube', title: 'Veritasium', url: 'https://www.youtube.com/@veritasium', category: 'Wissen', language: 'en' },
  { type: 'youtube', title: 'Linus Tech Tips', url: 'https://www.youtube.com/@LinusTechTips', category: 'Tech', language: 'en' },
  { type: 'youtube', title: 'ARTEde', url: 'https://www.youtube.com/@ARTEde', category: 'Doku', language: 'de' },
  { type: 'youtube', title: 'ZDFheute Nachrichten', url: 'https://www.youtube.com/@ZDFheute', category: 'Nachrichten', language: 'de' },
  { type: 'youtube', title: 'PietSmiet', url: 'https://www.youtube.com/@PietSmiet', category: 'Gaming', language: 'de' },
  { type: 'youtube', title: 'Gronkh', url: 'https://www.youtube.com/@gronkh', category: 'Gaming', language: 'de' },
  { type: 'youtube', title: 'MrBeast', url: 'https://www.youtube.com/@MrBeast', category: 'Unterhaltung', language: 'en' },
  { type: 'youtube', title: 'PewDiePie', url: 'https://www.youtube.com/@PewDiePie', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'Markiplier', url: 'https://www.youtube.com/@markiplier', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'Jacksepticeye', url: 'https://www.youtube.com/@jacksepticeye', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'Y-Kollektiv', url: 'https://www.youtube.com/@ykollektiv', category: 'Doku', language: 'de' },
  { type: 'youtube', title: 'STRG_F', url: 'https://www.youtube.com/@STRG_F', category: 'Doku', language: 'de' },
  { type: 'youtube', title: 'Simplicissimus', url: 'https://www.youtube.com/@Simplicissimus', category: 'Wissen', language: 'de' },
  { type: 'youtube', title: 'mailab', url: 'https://www.youtube.com/@maiLab', category: 'Wissen', language: 'de' },
  { type: 'youtube', title: 'Leeroy will\'s wissen!', url: 'https://www.youtube.com/@Leeroymatata', category: 'Interview', language: 'de' },
  { type: 'youtube', title: 'Rezo', url: 'https://www.youtube.com/@Rezo', category: 'Unterhaltung', language: 'de' },
  { type: 'youtube', title: 'Julien Bam', url: 'https://www.youtube.com/@JulienBam', category: 'Unterhaltung', language: 'de' },
  { type: 'youtube', title: 'Dhalucard', url: 'https://www.youtube.com/@dhalucard', category: 'Gaming', language: 'de' },
  { type: 'youtube', title: 'IGN', url: 'https://www.youtube.com/@IGN', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'GameSpot', url: 'https://www.youtube.com/@gamespot', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'Digital Foundry', url: 'https://www.youtube.com/@DigitalFoundry', category: 'Gaming', language: 'en' },
  { type: 'youtube', title: 'Marques Brownlee', url: 'https://www.youtube.com/@mkbhd', category: 'Tech', language: 'en' },
  { type: 'youtube', title: 'Tom Scott', url: 'https://www.youtube.com/@TomScottGo', category: 'Wissen', language: 'en' },
  { type: 'youtube', title: 'SmarterEveryDay', url: 'https://www.youtube.com/@smartereveryday', category: 'Wissen', language: 'en' },
  { type: 'youtube', title: 'Cleo Abram', url: 'https://www.youtube.com/@CleoAbram', category: 'Wissen', language: 'en' },
  { type: 'youtube', title: 'Hardware Unboxed', url: 'https://www.youtube.com/@Hardwareunboxed', category: 'Tech', language: 'en' },
  { type: 'youtube', title: 'Gamers Nexus', url: 'https://www.youtube.com/@GamersNexus', category: 'Tech', language: 'en' },

  // ==========================================
  // WEBCAMS
  // ==========================================
  { type: 'webcams', title: 'Times Square Live', url: 'https://www.youtube.com/watch?v=rnXIjl_Rzy4', category: 'City', language: 'en' },
  { type: 'webcams', title: 'ISS Live HD', url: 'https://www.youtube.com/watch?v=fO9e9jnhYK8', category: 'Space', language: 'en' },
  { type: 'webcams', title: 'Jackson Hole Town Square', url: 'https://www.youtube.com/watch?v=1EiC9bvVGnk', category: 'City', language: 'en' },
  { type: 'webcams', title: 'African Waterhole', url: 'https://www.youtube.com/watch?v=QyOitP-wXfE', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Venice Beach Live', url: 'https://www.youtube.com/watch?v=EO_1LWqsCNE', category: 'City', language: 'en' },
  { type: 'webcams', title: 'Shibuya Crossing', url: 'https://www.youtube.com/watch?v=dfVK7ld38Ys', category: 'City', language: 'en' },
  { type: 'webcams', title: 'Kitten Academy Live', url: 'https://www.youtube.com/watch?v=t-XmGEa-Bqk', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Monterey Bay Aquarium', url: 'https://www.youtube.com/watch?v=abbR-Ttd-cA', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Grizzly Bears Catching Salmon', url: 'https://www.youtube.com/watch?v=pZMdje7kCWc', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Live Surf Cam Pipeline', url: 'https://www.youtube.com/watch?v=B6qPml6o37M', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Earth from Space (NASA)', url: 'https://www.youtube.com/watch?v=vytmBNhc9ig', category: 'Space', language: 'en' },
  { type: 'webcams', title: 'Tokyo Shinjuku Live', url: 'https://www.youtube.com/watch?v=GLQhbRGv5qU', category: 'City', language: 'en' },
  { type: 'webcams', title: 'Live from Miami Beach', url: 'https://www.youtube.com/watch?v=gT8B2h_bMxs', category: 'City', language: 'en' },
  { type: 'webcams', title: 'Las Vegas Strip Live', url: 'https://www.youtube.com/watch?v=NnOtwzHw360', category: 'City', language: 'en' },
  { type: 'webcams', title: 'Port of Hamburg', url: 'https://www.youtube.com/watch?v=OmyDLXvaus4', category: 'City', language: 'en' },
  { type: 'webcams', title: 'African Safari', url: 'https://www.youtube.com/watch?v=ydYDqZQpim8', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Fuji-Q Highland Live', url: 'https://www.youtube.com/watch?v=vmNAFPfMK7A', category: 'Theme Park', language: 'en' },
  { type: 'webcams', title: 'Panda Cam', url: 'https://www.youtube.com/watch?v=SUXPnIEpbn4', category: 'Nature', language: 'en' },
  { type: 'webcams', title: 'Earth Cam: Key West', url: 'https://www.youtube.com/watch?v=Y5ypYTZs-7o', category: 'Beach', language: 'en' },
  
  // ==========================================
  // SPANISH SOURCES (feeds, podcasts, youtube)
  // ==========================================
  { type: 'feeds', title: 'El País', url: 'https://feeds.elpais.com/mrss-s/pages/ep/site/elpais.com/portada', category: 'Nachrichten', language: 'es' },
  { type: 'feeds', title: 'El Mundo', url: 'https://e00-elmundo.uecdn.es/elmundo/rss/portada.xml', category: 'Nachrichten', language: 'es' },
  { type: 'feeds', title: 'RTVE Noticias', url: 'https://www.rtve.es/api/noticias/rss', category: 'Nachrichten', language: 'es' },
  { type: 'feeds', title: 'Xataka', url: 'https://feeds.weblogssl.com/xataka2', category: 'Tech', language: 'es' },
  { type: 'feeds', title: 'Marca', url: 'https://e00-marca.uecdn.es/rss/portada.xml', category: 'Sport', language: 'es' },
  { type: 'podcasts', title: 'Radio Ambulante (NPR)', url: 'https://feeds.npr.org/510317/podcast.xml', category: 'Kultur', language: 'es' },
  { type: 'podcasts', title: 'Entiende tu mente', url: 'https://entiendetumente.info/feed/podcast', category: 'Wissen', language: 'es' },
  { type: 'podcasts', title: 'Cienciaes', url: 'https://cienciaes.com/feed/', category: 'Wissen', language: 'es' },
  { type: 'podcasts', title: 'La Escóbula de la Brújula', url: 'https://www.laescobula.com/feed/', category: 'Kultur', language: 'es' },
  { type: 'youtube', title: 'El Rubius', url: 'https://www.youtube.com/@elrubius', category: 'Gaming', language: 'es' },
  { type: 'youtube', title: 'Ibai', url: 'https://www.youtube.com/@Ibai_Llanos', category: 'Unterhaltung', language: 'es' },
  { type: 'youtube', title: 'Quantum Fracture', url: 'https://www.youtube.com/@QuantumFracture', category: 'Wissen', language: 'es' },
  { type: 'youtube', title: 'RTVE Noticias', url: 'https://www.youtube.com/@rtve', category: 'Nachrichten', language: 'es' },

  // ==========================================
  // FRENCH SOURCES (feeds, podcasts, youtube)
  // ==========================================
  { type: 'feeds', title: 'Le Monde', url: 'https://www.lemonde.fr/rss/une.xml', category: 'Nachrichten', language: 'fr' },
  { type: 'feeds', title: 'Le Figaro', url: 'https://lefigaro.fr/rss/figaro_actualites.xml', category: 'Nachrichten', language: 'fr' },
  { type: 'feeds', title: 'Frandroid', url: 'https://www.frandroid.com/feed', category: 'Tech', language: 'fr' },
  { type: 'feeds', title: 'L\'Équipe', url: 'https://xml.lequipe.fr/Syndication/rss_Equipe_Une.xml', category: 'Sport', language: 'fr' },
  { type: 'feeds', title: 'Les Echos', url: 'https://www.lesechos.fr/rss/rss_france.xml', category: 'Wirtschaft', language: 'fr' },
  { type: 'podcasts', title: 'Choses à Savoir', url: 'https://rss.art19.com/choses-a-savoir', category: 'Wissen', language: 'fr' },
  { type: 'podcasts', title: 'Transfert (Slate.fr)', url: 'https://feed.audiomeans.fr/feed/7a42bbca-7c80-40e4-bb20-b6fef18f70fa.xml', category: 'Kultur', language: 'fr' },
  { type: 'podcasts', title: 'La Story (Les Echos)', url: 'https://rss.art19.com/la-story', category: 'Wirtschaft', language: 'fr' },
  { type: 'youtube', title: 'Squeezie', url: 'https://www.youtube.com/@Squeezie', category: 'Unterhaltung', language: 'fr' },
  { type: 'youtube', title: 'Cyprien', url: 'https://www.youtube.com/@cyprien', category: 'Comedy', language: 'fr' },
  { type: 'youtube', title: 'HugoDécrypte', url: 'https://www.youtube.com/@HugoDecrypte', category: 'Nachrichten', language: 'fr' },
  { type: 'youtube', title: 'Nota Bene', url: 'https://www.youtube.com/@NotaBeneHistoire', category: 'Geschichte', language: 'fr' }
];

export async function generateDefaultSources() {
  let count = 0;
  
  // Migration of old/failing URLs in the DB to new ones
  const urlReplacements = [
    { old: 'https://doppelgaenger.podigee.io/feed/mp3', new: 'https://www.doppelgaenger.io/feed/podcast' },
    { old: 'https://feeds.redcircle.com/f04495e8-5b1b-4835-be00-11b2ff88fe64', new: 'https://cienciaes.com/feed/', title: 'Cienciaes', category: 'Wissen' },
    { old: 'https://feeds.acast.com/public/shows/entiende-tu-mente', new: 'https://entiendetumente.info/feed/podcast', title: 'Entiende tu mente', category: 'Wissen' },
    { old: 'https://feeds.redcircle.com/64b1d61a-05a8-444f-8cf5-c7e63b361bb5', new: 'https://www.laescobula.com/feed/', title: 'La Escóbula de la Brújula', category: 'Kultur' },
    { old: 'https://feeds.acast.com/public/shows/la-ruina', new: 'https://www.laescobula.com/feed/', title: 'La Escóbula de la Brújula', category: 'Kultur' }
  ];
  for (const repl of urlReplacements) {
    try {
      const qOld = query(collection(db, 'publicSources'), where('url', '==', repl.old));
      const snapOld = await getDocs(qOld);
      for (const d of snapOld.docs) {
        const updateData: any = { url: repl.new };
        if (repl.title) updateData.title = repl.title;
        if (repl.category) updateData.category = repl.category;
        await updateDoc(d.ref, updateData);
        console.log(`Migrated publicSource document ${d.id} URL from ${repl.old} to ${repl.new}`);
      }
    } catch (e) {
      console.error("Failed to migrate URL in Firestore publicSources:", e);
    }
  }

  for (const item of DEFAULT_SOURCES) {
    const qItems = query(collection(db, 'publicSources'), where('url', '==', item.url));
    const snaps = await getDocs(qItems);
    
    if (snaps.empty) {
      await addDoc(collection(db, 'publicSources'), {
        ...item,
        createdAt: new Date().toISOString()
      });
      count++;
    } else {
      // Migrate existing items to include language if missing
      for (const docSnap of snaps.docs) {
        const data = docSnap.data();
        if (!data.language && item.language) {
          try {
            await updateDoc(docSnap.ref, { language: item.language });
          } catch (e) {
            console.error("Migration error:", e);
          }
        }
      }
    }
  }
  
  return count;
}

