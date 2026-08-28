import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AudioState {
  title: string;
  url: string;
  feedTitle: string;
  imageUrl?: string;
  id?: string;
  link?: string;
}

interface VideoState {
  id: string;
  title: string;
  url: string;
  isWebcam?: boolean;
  webcamId?: string;
}

interface ArticleState {
  id?: string;
  title: string;
  content?: string;
  contentEncoded?: string;
  contentSnippet?: string;
  link: string;
  pubDate?: string;
  author?: string;
  imageUrl?: string;
  feedTitle?: string;
}

interface MediaContextType {
  playingAudio: AudioState | null;
  setPlayingAudio: React.Dispatch<React.SetStateAction<AudioState | null>>;
  playingVideo: VideoState | null;
  setPlayingVideo: React.Dispatch<React.SetStateAction<VideoState | null>>;
  readingArticle: ArticleState | null;
  setReadingArticle: React.Dispatch<React.SetStateAction<ArticleState | null>>;
  isAudioMinimized: boolean;
  setIsAudioMinimized: React.Dispatch<React.SetStateAction<boolean>>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export function MediaProvider({ children }: { children: ReactNode }) {
  const [playingAudio, setPlayingAudio] = useState<AudioState | null>(null);
  const [playingVideo, setPlayingVideo] = useState<VideoState | null>(null);
  const [readingArticle, setReadingArticle] = useState<ArticleState | null>(null);
  const [isAudioMinimized, setIsAudioMinimized] = useState<boolean>(false);

  // Auto-maximize player when playingAudio changes to a new non-null track
  React.useEffect(() => {
    if (playingAudio) {
      setIsAudioMinimized(false);
    }
  }, [playingAudio]);

  return (
    <MediaContext.Provider value={{ 
      playingAudio, 
      setPlayingAudio, 
      playingVideo, 
      setPlayingVideo, 
      readingArticle, 
      setReadingArticle,
      isAudioMinimized,
      setIsAudioMinimized
    }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const context = useContext(MediaContext);
  if (!context) throw new Error('useMedia must be used within MediaProvider');
  return context;
}
