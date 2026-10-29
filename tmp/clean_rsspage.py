with open('src/components/dashboard/RssPage.tsx', 'r') as f:
    content = f.read()

# 12. isRecent checks
old_recent = """      const isPodcastItem = item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3'));
      const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
      const isWebcamItem = type === 'webcams' || item.category === 'WebCam';
      const isRadioItem = type === 'radio' || item.category === 'Radio';
      const isBlogItem = type === 'blogs' || item.category === 'Blogs';

      // For blogs, podcasts, youtube, webcams and radio we put everything in the "Recent" section (no time limits)
      if (isPodcastItem || isYoutubeItem || isWebcamItem || isRadioItem || isBlogItem) {"""

new_recent = """      const isPodcastItem = item.enclosure?.url && (item.enclosure.type?.startsWith('audio/') || type === 'podcasts' || item.enclosure.url.toLowerCase().endsWith('.m4a') || item.enclosure.url.toLowerCase().endsWith('.mp3'));
      const isYoutubeItem = item.link?.includes('youtube.com') || item.link?.includes('youtu.be');
      const isRadioItem = type === 'radio' || item.category === 'Radio';

      // For podcasts, youtube and radio we put everything in the "Recent" section (no time limits)
      if (isPodcastItem || isYoutubeItem || isRadioItem) {"""
assert old_recent in content, 'recent mismatch'
content = content.replace(old_recent, new_recent)
print('Updated isRecent!')

# 13. Preload gifs
content = content.replace("      '/Loader_WebCam.gif',\n      '/Loader_Blog.gif'", "")
content = content.replace("      '/Loader_WebCam.gif',", "")
content = content.replace("      '/Loader_Blog.gif',", "")

# 14. Magazine renderItem: remove cardType === 'webcam' and cardType === 'blog'
start_wb = "    if (cardType === 'webcam' && interspersePool.webcams.length > 0) {"
end_wb = "    return null;\n  };"
wb_s = content.find(start_wb)
wb_e = content.find(end_wb)
assert wb_s != -1 and wb_e != -1, f'magazine items bounds mismatch {wb_s} {wb_e}'

content = content[:wb_s] + "    return null;\n  };" + content[wb_e + len("    return null;\n  };"):]
print('Removed webcam and blog cards from renderMagazineItem!')

# 15. cardsSequence and usedWebcamCount in renderMagazineSection
old_seq = """    // Reset counts for the current render pass
    globalNewsCount = 0;
    lastRadioNewsCount = -999;
    let usedWebcamCount = 0;

    const cardsToRender: ({ type: 'news'; item: RssItem } | { type: string; poolIndex: number })[] = [];
    let itemIndex = 0;
    let intersperseCount = 0;

    const cardsSequence = ['podcast', 'radio', 'youtube'];

    const isValidCardType = (typeStr: string) => {
      if (typeStr === 'radio') {
        if (globalNewsCount - lastRadioNewsCount < 100) return false;
        return true;
      }
      if (typeStr === 'podcast') {
        return interspersePool.podcasts.length > 0;
      }
      if (typeStr === 'youtube') {
        return interspersePool.youtube.length > 0;
      }
      return false;
    };

    while (itemIndex < items.length) {
      // Chunk size alternates to look organic and flow beautiful
      const chunkSize = intersperseCount % 2 === 0 ? 3 : 4;
      for (let i = 0; i < chunkSize && itemIndex < items.length; i++) {
        cardsToRender.push({ type: 'news', item: items[itemIndex] });
        itemIndex++;
        globalNewsCount++;
      }

      if (itemIndex < items.length) {
        let cardType = cardsSequence[intersperseCount % cardsSequence.length];
        
        if (!isValidCardType(cardType)) {
          const alternatives = ['podcast', 'youtube', 'radio'];
          let foundAlternative = false;
          for (const alt of alternatives) {
            if (alt !== cardType && isValidCardType(alt)) {
              cardType = alt;
              foundAlternative = true;
              break;
            }
          }
          if (!foundAlternative) {
            intersperseCount++;
            continue;
          }
        }

        if (cardType === 'webcam') {
          cardsToRender.push({ type: 'webcam', poolIndex: usedWebcamCount });
          usedWebcamCount++;
        } else {
          cardsToRender.push({ type: cardType, poolIndex: intersperseCount });
          if (cardType === 'radio') {
            lastRadioNewsCount = globalNewsCount;
          }
        }
        intersperseCount++;
      }
    }"""

new_seq = """    // Reset counts for the current render pass
    globalNewsCount = 0;
    lastRadioNewsCount = -999;

    const cardsToRender: ({ type: 'news'; item: RssItem } | { type: string; poolIndex: number })[] = [];
    let itemIndex = 0;
    let intersperseCount = 0;

    const cardsSequence = ['podcast', 'radio', 'youtube'];

    const isValidCardType = (typeStr: string) => {
      if (typeStr === 'radio') {
        if (globalNewsCount - lastRadioNewsCount < 100) return false;
        return true;
      }
      if (typeStr === 'podcast') {
        return interspersePool.podcasts.length > 0;
      }
      if (typeStr === 'youtube') {
        return interspersePool.youtube.length > 0;
      }
      return false;
    };

    while (itemIndex < items.length) {
      const chunkSize = intersperseCount % 2 === 0 ? 3 : 4;
      for (let i = 0; i < chunkSize && itemIndex < items.length; i++) {
        cardsToRender.push({ type: 'news', item: items[itemIndex] });
        itemIndex++;
        globalNewsCount++;
      }

      if (itemIndex < items.length) {
        let cardType = cardsSequence[intersperseCount % cardsSequence.length];
        
        if (!isValidCardType(cardType)) {
          const alternatives = ['podcast', 'youtube', 'radio'];
          let foundAlternative = false;
          for (const alt of alternatives) {
            if (alt !== cardType && isValidCardType(alt)) {
              cardType = alt;
              foundAlternative = true;
              break;
            }
          }
          if (!foundAlternative) {
            intersperseCount++;
            continue;
          }
        }

        cardsToRender.push({ type: cardType, poolIndex: intersperseCount });
        if (cardType === 'radio') {
          lastRadioNewsCount = globalNewsCount;
        }
        intersperseCount++;
      }
    }"""
assert old_seq in content, 'sequence mismatch'
content = content.replace(old_seq, new_seq)
print('Updated renderMagazineSection sequence!')

# 16. isRestrictedCard
content = content.replace(
    "if (c.type === 'radio' || c.type === 'youtube' || c.type === 'webcam' || c.type === 'podcast') {",
    "if (c.type === 'radio' || c.type === 'youtube' || c.type === 'podcast') {"
)
content = content.replace(
    "// Helper to determine if a card is restricted (Radio, YouTube, Webcam, or Podcast)",
    "// Helper to determine if a card is restricted (Radio, YouTube, or Podcast)"
)
content = content.replace(
    "// Rule: If the current card is restricted (Radio, YouTube, Webcam, Podcast), it must NEVER be large",
    "// Rule: If the current card is restricted (Radio, YouTube, Podcast), it must NEVER be large"
)
content = content.replace(
    "// Rule: If the next card (sharing the row) is restricted (Radio, YouTube, Webcam, Podcast), the current card",
    "// Rule: If the next card (sharing the row) is restricted (Radio, YouTube, Podcast), the current card"
)
content = content.replace(
    "if (isYoutube || isWebcam || isRadio || isPodcast) {",
    "if (isYoutube || isRadio || isPodcast) {"
)
content = content.replace(
    "const isWebcam = c.item.category === 'WebCam';\n        const isRadio = c.item.category === 'Radio';",
    "const isRadio = c.item.category === 'Radio';"
)

# 17. isWebcamsMain and isBlogsMain variables
old_mains = """  const isYoutubeMain = type === 'youtube' && !selectedChannelId;
  const isWebcamsMain = type === 'webcams' && !selectedChannelId;
  const isPodcastMain = type === 'podcasts' && !selectedChannelId;
  const isBlogsMain = type === 'blogs' && !selectedChannelId;"""

new_mains = """  const isYoutubeMain = type === 'youtube' && !selectedChannelId;
  const isPodcastMain = type === 'podcasts' && !selectedChannelId;"""
assert old_mains in content, 'mains mismatch'
content = content.replace(old_mains, new_mains)
print('Updated isYoutubeMain and isPodcastMain!')

# 18. colorConfig webcams and blogs entries
old_cc_extra = """    webcams: {
      gradient: 'from-emerald-500 to-green-400',
      glowColor: 'rgba(16,185,129,0.5)',
      textColorClass: 'text-emerald-500',
      textHex: '#10b981',
      glowBg: 'bg-emerald-500/15',
      loaderGif: '/Loader_WebCam.gif'
    },
    webcam: {
      gradient: 'from-emerald-500 to-green-400',
      glowColor: 'rgba(16,185,129,0.5)',
      textColorClass: 'text-emerald-500',
      textHex: '#10b981',
      glowBg: 'bg-emerald-500/15',
      loaderGif: '/Loader_WebCam.gif'
    },
    blogs: {
      gradient: 'from-amber-400 to-yellow-500',
      glowColor: 'rgba(245,158,11,0.5)',
      textColorClass: 'text-amber-500',
      textHex: '#d97706',
      glowBg: 'bg-amber-500/15',
      loaderGif: '/Loader_Blog.gif'
    },
    blog: {
      gradient: 'from-amber-400 to-yellow-500',
      glowColor: 'rgba(245,158,11,0.5)',
      textColorClass: 'text-amber-500',
      textHex: '#d97706',
      glowBg: 'bg-amber-500/15',
      loaderGif: '/Loader_Blog.gif'
    }"""
assert old_cc_extra in content, 'colorConfig extra mismatch'
content = content.replace(old_cc_extra, '')
content = content.replace("    youtube: {\n      gradient: 'from-red-600 to-orange-500',\n      glowColor: 'rgba(220,38,38,0.5)',\n      textColorClass: 'text-red-500',\n      textHex: '#dc2626',\n      glowBg: 'bg-red-500/15',\n      loaderGif: '/Loader_YouTube.gif'\n    },\n  };", "    youtube: {\n      gradient: 'from-red-600 to-orange-500',\n      glowColor: 'rgba(220,38,38,0.5)',\n      textColorClass: 'text-red-500',\n      textHex: '#dc2626',\n      glowBg: 'bg-red-500/15',\n      loaderGif: '/Loader_YouTube.gif'\n    }\n  };")
print('Updated colorConfig!')

# 19. Clean channel section
old_channel_sec = """        ) : (isYoutubeMain || isPodcastMain || isWebcamsMain) ? (
          <div className="w-full mt-4 md:mt-8">
            {feeds.length === 0 ? (
              <div className={`flex flex-col items-center justify-center p-12 md:p-24 border border-dashed rounded-2xl ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {isPodcastMain ? (
                  <Headphones className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                ) : isYoutubeMain ? (
                  <Youtube className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                ) : (
                  <Camera className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                )}
                <h3 className="text-xl font-bold font-heading mb-2 opacity-80">
                  {isPodcastMain ? tr(settings.language, 'No podcasts', 'Keine Podcasts') :
                   isYoutubeMain ? tr(settings.language, 'No YouTube channels', 'Keine YouTube Kanäle') :
                   tr(settings.language, 'No webcams', 'Keine Webcams')}
                </h3>
                <p className={`text-center max-w-md ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {isPodcastMain ? (
                    settings.language === 'en' ? <>Add a podcast on the <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen Podcast hinzu, um ihn hier zu speichern.</>
                  ) : isYoutubeMain ? (
                    settings.language === 'en' ? <>Add a YouTube channel on the <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen YouTube Kanal hinzu, um ihn hier zu speichern.</>
                  ) : (
                    settings.language === 'en' ? <>Add a webcam on the <Link to="/discover/webcams" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/webcams" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> eine Webcam hinzu, um sie hier zu speichern.</>
                  )}
                </p>
              </div>
            ) : (() => {
              const filteredFeeds = feeds.filter(feed => {
                if (selectedCategory === "Alle") return true;
                if (selectedCategory === "Favoriten") return !!feed.isStarred;
                if (selectedCategory === "Später hören" || selectedCategory === "Später sehen" || selectedCategory === "Später lesen") return !!feed.isReadLater;
                return feed.category === selectedCategory;
              }).filter(feed => !searchQuery || feed.title?.toLowerCase().includes(searchQuery.toLowerCase()));

              return (
                <div className="space-y-12">
                  {/* Channels block */}
                  {filteredFeeds.length > 0 && (
                    <div className="space-y-6">
                      {selectedCategory !== "Alle" && (
                        <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {type === 'podcasts' ? (isEn ? 'Podcast Channels' : 'Podcast-Kanäle') :
                           type === 'youtube' ? (isEn ? 'YouTube Channels' : 'YouTube-Kanäle') :
                           (isEn ? 'Webcam Channels' : 'Webcam-Kanäle')}
                          {` (${filteredFeeds.length})`}
                        </h3>
                      )}
                      
                      <div className={`grid ${type === 'podcasts' ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'} gap-6`}>
                        {filteredFeeds.map((feed, index) => {
                          const hasNewVideos = feedItems.some(item => {
                            if (item.feedId !== feed.id) return false;
                            const pubTime = new Date(item.pubDate).getTime();
                            if (feed.lastReadAt && pubTime <= feed.lastReadAt) return false;
                            return (Date.now() - pubTime) < 30 * 24 * 60 * 60 * 1000;
                          });
                          const publicSource = publicSources.find(p => p.url === feed.url) as any;
                          let ytThumbnail = null;
                          if (feed.url) {
                            const match = feed.url.match(/(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/);
                            if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
                          }
                          const finalImageUrl = getFeedImageUrl(feed, publicSource);
                          const displayBanner = isWebcamsMain && ytThumbnail ? ytThumbnail : (publicSource?.bannerUrl || feed.bannerUrl);

                          if (type === 'podcasts') {
                            return (
                              <div 
                                key={`podcast-channel-${feed.id || feed.url}-${index}`}
                                onClick={() => setSelectedChannelId(feed.id)}
                                className={`group relative overflow-hidden flex flex-col rounded-xl border transition-all hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer`}
                              >
                                <div className="aspect-square w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden select-none glanz-image-container">
                                  <Headphones className="w-12 h-12 opacity-20 relative z-10" />
                                  {finalImageUrl && (
                                    <img 
                                      src={proxyImageUrl(finalImageUrl)} 
                                      alt={feed.title} 
                                      loading="lazy" 
                                      className="absolute inset-0 w-full h-full object-cover" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  )}
                                </div>
                                <div className="p-4 flex flex-col flex-1 justify-between">
                                  <div>
                                    <h3 className={`font-bold text-sm line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors`} title={feed.title}>{feed.title}</h3>
                                    {feed.category && (
                                      <p className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{feed.category}</p>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                                    <span className={`text-[10px] font-bold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>PODCAST</span>
                                    {renderFeedActions(feed)}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`feed-channel-${feed.id || feed.url}-${index}`}
                              onClick={() => {
                                  if (isWebcamsMain && feed.url) {
                                    const videoId = getOutputVideoId(feed.url);
                                    if (videoId) {
                                      setPlayingVideo({ id: videoId, title: feed.title, url: feed.url, isWebcam: true, webcamId: feed.id });
                                    }
                                  } else {
                                    setSelectedChannelId(feed.id);
                                  }
                              }}
                              className={`group flex flex-col rounded-3xl overflow-hidden transition-transform hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer relative text-left w-full`}
                            >
                              {isWebcamsMain ? (
                                <div className="absolute top-3 right-3 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20 flex items-center gap-1 shadow-md animate-pulse">
                                  <span className="w-1.5 h-1.5 rounded-full bg-white block animate-ping" />
                                  <span>LIVE</span>
                                </div>
                              ) : hasNewVideos && (
                                <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20">
                                  {isEn ? (type === 'youtube' ? 'UNWATCHED' : 'NEW') : (type === 'youtube' ? 'UNGESEHEN' : 'NEU')}
                                </div>
                              )}
                              <div className="w-full h-24 bg-gray-100 dark:bg-neutral-800 relative overflow-hidden pointer-events-none select-none glanz-image-container">
                                {displayBanner ? (
                                  <img src={proxyImageUrl(displayBanner)} alt="banner" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : feed.isPodcast && finalImageUrl ? (
                                  <>
                                    <div 
                                      className="absolute inset-[-20%] bg-cover bg-center blur-lg opacity-70"
                                      style={{ backgroundImage: `url(${finalImageUrl})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40"></div>
                                )}
                              </div>
                              <div className="px-6 flex flex-col items-center -mt-10 relative z-10 w-full mb-6">
                                <div className="relative">
                                  {finalImageUrl || displayBanner ? (
                                    <img src={proxyImageUrl(finalImageUrl || displayBanner)} alt={feed.title} loading="lazy" className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-neutral-900 bg-white" referrerPolicy="no-referrer" />
                                  ) : (
                                     <div className="w-20 h-20 rounded-full border-4 border-white dark:border-neutral-900 bg-blue-100 flex items-center justify-center text-blue-500 text-3xl font-bold">
                                       {feed.title.charAt(0).toUpperCase()}
                                     </div>
                                  )}
                                </div>
                                <h3 className={`font-bold text-center line-clamp-1 w-full mt-3 ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors`} title={feed.title}>{feed.title}</h3>

                                <div className="w-full mt-2">
                                  {renderFeedActions(feed)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Episodes block */}
                  {(recentItems.length > 0 || midItems.length > 0 || olderItems.length > 0) && (
                    <div className="space-y-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                      <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCategory === "Favoriten" || selectedCategory === "Später hören" || selectedCategory === "Später sehen"
                          ? (type === 'podcasts' ? (isEn ? 'Saved Podcast Episodes' : 'Gespeicherte Podcast-Folgen') :
                             type === 'youtube' ? (isEn ? 'Saved Videos' : 'Gespeicherte Videos') :
                             (isEn ? 'Saved Webcams' : 'Gespeicherte Webcams'))
                          : (type === 'podcasts' ? (isEn ? 'Latest Podcast Episodes' : 'Neueste Podcast-Folgen') :
                             type === 'youtube' ? (isEn ? 'Latest Videos' : 'Neueste Videos') :
                             (isEn ? 'Webcams' : 'Webcams'))}
                        {` (${recentItems.length + midItems.length + olderItems.length})`}
                      </h3>"""

new_channel_sec = """        ) : (isYoutubeMain || isPodcastMain) ? (
          <div className="w-full mt-4 md:mt-8">
            {feeds.length === 0 ? (
              <div className={`flex flex-col items-center justify-center p-12 md:p-24 border border-dashed rounded-2xl ${isDark ? 'border-white/10' : 'border-gray-200'}`}>
                {isPodcastMain ? (
                  <Headphones className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                ) : (
                  <Youtube className={`w-16 h-16 opacity-20 mb-4 ${isDark ? 'text-white' : 'text-gray-900'}`} />
                )}
                <h3 className="text-xl font-bold font-heading mb-2 opacity-80">
                  {isPodcastMain ? tr(settings.language, 'No podcasts', 'Keine Podcasts') :
                   tr(settings.language, 'No YouTube channels', 'Keine YouTube Kanäle')}
                </h3>
                <p className={`text-center max-w-md ${isDark ? 'text-white/50' : 'text-gray-500'}`}>
                  {isPodcastMain ? (
                    settings.language === 'en' ? <>Add a podcast on the <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/podcasts" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen Podcast hinzu, um ihn hier zu speichern.</>
                  ) : (
                    settings.language === 'en' ? <>Add a YouTube channel on the <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organize page</Link> to save it here.</> :
                    <>Füge in der <Link to="/discover/youtube" className="font-bold underline hover:opacity-85">Organisieren-Seite</Link> einen YouTube Kanal hinzu, um ihn hier zu speichern.</>
                  )}
                </p>
              </div>
            ) : (() => {
              const filteredFeeds = feeds.filter(feed => {
                if (selectedCategory === "Alle") return true;
                if (selectedCategory === "Favoriten") return !!feed.isStarred;
                if (selectedCategory === "Später hören" || selectedCategory === "Später sehen" || selectedCategory === "Später lesen") return !!feed.isReadLater;
                return feed.category === selectedCategory;
              }).filter(feed => !searchQuery || feed.title?.toLowerCase().includes(searchQuery.toLowerCase()));

              return (
                <div className="space-y-12">
                  {/* Channels block */}
                  {filteredFeeds.length > 0 && (
                    <div className="space-y-6">
                      {selectedCategory !== "Alle" && (
                        <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                          {type === 'podcasts' ? (isEn ? 'Podcast Channels' : 'Podcast-Kanäle') :
                           (isEn ? 'YouTube Channels' : 'YouTube-Kanäle')}
                          {` (${filteredFeeds.length})`}
                        </h3>
                      )}
                      
                      <div className={`grid ${type === 'podcasts' ? 'grid-cols-[repeat(auto-fill,minmax(210px,1fr))]' : 'grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'} gap-6`}>
                        {filteredFeeds.map((feed, index) => {
                          const hasNewVideos = feedItems.some(item => {
                            if (item.feedId !== feed.id) return false;
                            const pubTime = new Date(item.pubDate).getTime();
                            if (feed.lastReadAt && pubTime <= feed.lastReadAt) return false;
                            return (Date.now() - pubTime) < 30 * 24 * 60 * 60 * 1000;
                          });
                          const publicSource = publicSources.find(p => p.url === feed.url) as any;
                          let ytThumbnail = null;
                          if (feed.url) {
                            const match = feed.url.match(/(?:youtube\\.com\\/(?:[^\\/]+\\/.+\\/|(?:v|e(?:mbed)?)\\/|.*[?&]v=)|youtu\\.be\\/)([^"&?\\/\\s]{11})/);
                            if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
                          }
                          const finalImageUrl = getFeedImageUrl(feed, publicSource);
                          const displayBanner = publicSource?.bannerUrl || feed.bannerUrl;

                          if (type === 'podcasts') {
                            return (
                              <div 
                                key={`podcast-channel-${feed.id || feed.url}-${index}`}
                                onClick={() => setSelectedChannelId(feed.id)}
                                className={`group relative overflow-hidden flex flex-col rounded-xl border transition-all hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer`}
                              >
                                <div className="aspect-square w-full flex items-center justify-center bg-gray-100 dark:bg-neutral-900 border-b border-gray-100 dark:border-white/5 relative overflow-hidden select-none glanz-image-container">
                                  <Headphones className="w-12 h-12 opacity-20 relative z-10" />
                                  {finalImageUrl && (
                                    <img 
                                      src={proxyImageUrl(finalImageUrl)} 
                                      alt={feed.title} 
                                      loading="lazy" 
                                      className="absolute inset-0 w-full h-full object-cover" 
                                      referrerPolicy="no-referrer" 
                                    />
                                  )}
                                </div>
                                <div className="p-4 flex flex-col flex-1 justify-between">
                                  <div>
                                    <h3 className={`font-bold text-sm line-clamp-1 ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors`} title={feed.title}>{feed.title}</h3>
                                    {feed.category && (
                                      <p className={`text-[10px] uppercase font-bold tracking-wider mt-1 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{feed.category}</p>
                                    )}
                                  </div>
                                  <div className="mt-3 pt-2 border-t border-gray-100 dark:border-white/5 flex items-center justify-between">
                                    <span className={`text-[10px] font-bold ${isDark ? 'text-white/40' : 'text-gray-400'}`}>PODCAST</span>
                                    {renderFeedActions(feed)}
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={`feed-channel-${feed.id || feed.url}-${index}`}
                              onClick={() => {
                                setSelectedChannelId(feed.id);
                              }}
                              className={`group flex flex-col rounded-3xl overflow-hidden transition-transform hover:-translate-y-1 ${isDark ? 'border-white/10 bg-neutral-900/55 hover:bg-neutral-800/85 hover:border-white/25 dark:backdrop-blur-sm' : 'border-gray-200 bg-white/70 hover:bg-white/85 shadow-sm backdrop-blur-sm'} cursor-pointer relative text-left w-full`}
                            >
                              {hasNewVideos && (
                                <div className="absolute top-3 right-3 bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-full z-20">
                                  {isEn ? (type === 'youtube' ? 'UNWATCHED' : 'NEW') : (type === 'youtube' ? 'UNGESEHEN' : 'NEU')}
                                </div>
                              )}
                              <div className="w-full h-24 bg-gray-100 dark:bg-neutral-800 relative overflow-hidden pointer-events-none select-none glanz-image-container">
                                {displayBanner ? (
                                  <img src={proxyImageUrl(displayBanner)} alt="banner" loading="lazy" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : feed.isPodcast && finalImageUrl ? (
                                  <>
                                    <div 
                                      className="absolute inset-[-20%] bg-cover bg-center blur-lg opacity-70"
                                      style={{ backgroundImage: `url(${finalImageUrl})` }}
                                    />
                                    <div className="absolute inset-0 bg-black/10 dark:bg-black/30" />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/40 dark:to-purple-900/40"></div>
                                )}
                              </div>
                              <div className="px-6 flex flex-col items-center -mt-10 relative z-10 w-full mb-6">
                                <div className="relative">
                                  {finalImageUrl || displayBanner ? (
                                    <img src={proxyImageUrl(finalImageUrl || displayBanner)} alt={feed.title} loading="lazy" className="w-20 h-20 rounded-full object-cover border-4 border-white dark:border-neutral-900 bg-white" referrerPolicy="no-referrer" />
                                  ) : (
                                     <div className="w-20 h-20 rounded-full border-4 border-white dark:border-neutral-900 bg-blue-100 flex items-center justify-center text-blue-500 text-3xl font-bold">
                                       {feed.title.charAt(0).toUpperCase()}
                                     </div>
                                  )}
                                </div>
                                <h3 className={`font-bold text-center line-clamp-1 w-full mt-3 ${isDark ? 'text-white' : 'text-gray-900'} ${formatColors.groupHoverText} transition-colors`} title={feed.title}>{feed.title}</h3>

                                <div className="w-full mt-2">
                                  {renderFeedActions(feed)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Episodes block */}
                  {(recentItems.length > 0 || midItems.length > 0 || olderItems.length > 0) && (
                    <div className="space-y-6 pt-6 border-t border-dashed border-gray-200 dark:border-white/10">
                      <h3 className={`text-xl font-bold font-heading ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        {selectedCategory === "Favoriten" || selectedCategory === "Später hören" || selectedCategory === "Später sehen"
                          ? (type === 'podcasts' ? (isEn ? 'Saved Podcast Episodes' : 'Gespeicherte Podcast-Folgen') :
                             (isEn ? 'Saved Videos' : 'Gespeicherte Videos'))
                          : (type === 'podcasts' ? (isEn ? 'Latest Podcast Episodes' : 'Neueste Podcast-Folgen') :
                             (isEn ? 'Latest Videos' : 'Neueste Videos'))}
                        {` (${recentItems.length + midItems.length + olderItems.length})`}
                      </h3>"""

assert old_channel_sec in content, 'channel_sec mismatch'
content = content.replace(old_channel_sec, new_channel_sec)
print('Updated channel section!')

# 20. Other remaining small checks
content = content.replace(
    "!(isYoutubeMain || isPodcastMain || isWebcamsMain)",
    "!(isYoutubeMain || isPodcastMain)"
)
content = content.replace(
    "} else if (type === 'youtube' || type === 'webcams' || type === 'blogs') {",
    "} else if (type === 'youtube') {"
)
content = content.replace(
    ") : (!selectedChannelId && type !== 'webcams') && (",
    ") : (!selectedChannelId) && ("
)

# 21. Clean Camera import if it's there
content = content.replace("Camera, ", "").replace(", Camera", "")

with open('src/components/dashboard/RssPage.tsx', 'w') as f:
    f.write(content)

print('RssPage.tsx updated successfully!')
