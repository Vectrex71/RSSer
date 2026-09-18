import React, { useEffect, useRef, useState } from 'react';
import { useMedia } from '../../context/MediaContext';
import { useSettings } from '../../context/SettingsContext';
import { 
  FileText, X, ExternalLink, AlertTriangle, Check, Loader2, Minimize2, Maximize2,
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Radio, AlertCircle
} from 'lucide-react';
import { useCustomModal } from '../../context/ModalContext';
import { db, auth } from '../../lib/firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';

const reportedWebcamsMemory = new Set<string>();

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) {
    return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

function MediaPlayerVoting({ targetUrl, targetTitle, type, settings, isDark }: { targetUrl: string; targetTitle: string; type: string; settings: any; isDark?: boolean }) {
  if (!settings?.showVoting) return null;
  const [voteData, setVoteData] = useState<{ votes: number; voters: Record<string, 'up' | 'down'> }>({ votes: 0, voters: {} });
  const docId = targetUrl ? targetUrl.replace(/[^a-zA-Z0-9_\-]+/g, '_').substring(0, 100) : '';

  useEffect(() => {
    if (!docId) return;
    const unsub = onSnapshot(doc(db, 'itemVotes', docId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setVoteData({
          votes: data.votes || 0,
          voters: data.voters || {}
        });
      } else {
        setVoteData({ votes: 0, voters: {} });
      }
    }, (err) => {
      console.warn("Error listening to itemVotes:", err);
    });
    return () => unsub();
  }, [docId]);

  let currentUid = auth.currentUser?.uid;
  if (!currentUid && typeof window !== 'undefined') {
    currentUid = localStorage.getItem('rsser_community_user_id') || undefined;
  }
  const userVote = currentUid ? voteData.voters[currentUid] || null : null;

  const handleVote = async (voteType: 'up' | 'down') => {
    let voterId = auth.currentUser?.uid;
    if (!voterId) {
      let guestId = localStorage.getItem('rsser_community_user_id');
      if (!guestId) {
        guestId = 'guest_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('rsser_community_user_id', guestId);
      }
      voterId = guestId;
    }

    const prevVote = voteData.voters[voterId] || null;

    let newVoters = { ...voteData.voters };
    let votesChange = 0;

    if (prevVote === voteType) {
      delete newVoters[voterId];
      votesChange = voteType === 'up' ? -1 : 1;
    } else {
      newVoters[voterId] = voteType;
      if (!prevVote) {
        votesChange = voteType === 'up' ? 1 : -1;
      } else {
        votesChange = voteType === 'up' ? 2 : -2;
      }
    }

    const newVotes = voteData.votes + votesChange;

    try {
      await setDoc(doc(db, 'itemVotes', docId), {
        id: docId,
        title: targetTitle,
        link: targetUrl,
        votes: newVotes,
        voters: newVoters,
        type: type,
        updatedAt: Date.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error setting vote in player:", err);
    }
  };

  return (
    <div className={`flex items-center gap-1 rounded-full px-2 py-1 select-none shrink-0 transition-colors ${
      isDark 
        ? 'bg-white/5 border border-white/10 text-white' 
        : 'bg-black/5 border border-black/10 text-gray-900'
    }`}>
      <button
        onClick={() => handleVote('up')}
        className={`p-1 rounded-full transition-all flex items-center justify-center ${
          userVote === 'up' 
            ? 'text-emerald-500 scale-110 font-bold' 
            : isDark 
              ? 'text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10' 
              : 'text-gray-500 hover:text-emerald-600 hover:bg-emerald-500/10'
        }`}
        title="Upvote (+1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={userVote === 'up' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
      </button>
      
      <span className={`text-xs font-bold font-mono min-w-[16px] text-center ${
        voteData.votes > 0 
          ? 'text-emerald-500 dark:text-emerald-400' 
          : voteData.votes < 0 
            ? 'text-red-500 dark:text-red-400' 
            : isDark ? 'text-neutral-300' : 'text-gray-800'
      }`}>
        {voteData.votes > 0 ? `+${voteData.votes}` : voteData.votes}
      </span>
      
      <button
        onClick={() => handleVote('down')}
        className={`p-1 rounded-full transition-all flex items-center justify-center ${
          userVote === 'down' 
            ? 'text-red-500 scale-110 font-bold' 
            : isDark 
              ? 'text-neutral-400 hover:text-red-400 hover:bg-red-500/10' 
              : 'text-gray-500 hover:text-red-600 hover:bg-red-500/10'
        }`}
        title="Downvote (-1)"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill={userVote === 'down' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>
  );
}

function WebcamReportInline({ playingVideo, settings, isDark }: { playingVideo: any; settings: any; isDark: boolean }) {
  const { showAlert, showConfirm } = useCustomModal();
  const [reported, setReported] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const isRep = reportedWebcamsMemory.has(playingVideo.webcamId) || localStorage.getItem(`webcam_reported_${playingVideo.webcamId}`) === 'true';
      setReported(isRep);
    } catch (_) {
      setReported(reportedWebcamsMemory.has(playingVideo.webcamId));
    }
  }, [playingVideo.webcamId]);

  const handleReport = async () => {
    if (reported || loading) return;

    const titleMsg = settings.language === 'en' ? 'Report webcam' : 'Webcam melden';
    const confirmMsg = settings.language === 'en' 
      ? 'Are you sure this webcam stream is NOT live / offline?' 
      : 'Bist du sicher, dass dieser Webcam-Stream NICHT live / offline ist?';

    const confirmed = await showConfirm(confirmMsg, titleMsg, settings.language === 'en' ? 'Yes, report' : 'Ja, melden', settings.language === 'en' ? 'Cancel' : 'Abbrechen');
    if (!confirmed) return;

    setLoading(true);
    try {
      // Save report in Firestore under webcamReports
      await addDoc(collection(db, 'webcamReports'), {
        webcamId: playingVideo.webcamId || '',
        webcamTitle: playingVideo.title,
        webcamUrl: playingVideo.url || '',
        reportedAt: Date.now(),
        reportedBy: auth.currentUser?.email || 'Anonymous',
        reportedByUserId: auth.currentUser?.uid || '',
        status: 'pending'
      });

      // Update in publicSources to increase reportsCount
      try {
        const q = query(collection(db, 'publicSources'), where('url', '==', playingVideo.url));
        const snaps = await getDocs(q);
        if (!snaps.empty) {
          const docSnap = snaps.docs[0];
          const currCount = docSnap.data().reportsCount || 0;
          await updateDoc(doc(db, 'publicSources', docSnap.id), {
            reportsCount: currCount + 1
          });
        }
      } catch (fErr) {
        console.log("Silent error updating public sources reportsCount:", fErr);
      }

      reportedWebcamsMemory.add(playingVideo.webcamId);
      try {
        localStorage.setItem(`webcam_reported_${playingVideo.webcamId}`, 'true');
      } catch (_) {}
      setReported(true);

      const successMsg = settings.language === 'en'
        ? 'Thank you! The report has been sent. An administrator will review it.'
        : 'Vielen Dank! Die Meldung wurde gesendet. Ein Administrator wird die Webcam überprüfen.';
      
      await showAlert(successMsg, settings.language === 'en' ? 'Success' : 'Erfolgreich');
    } catch (err: any) {
      console.error(err);
      await showAlert('Error submitting report: ' + err.message, 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleReport}
      disabled={reported || loading}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
        reported
          ? 'bg-neutral-800 text-neutral-400 border-neutral-700/50 cursor-default'
          : 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/25 active:scale-95'
      }`}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : reported ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : (
        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
      )}
      <span>
        {reported 
          ? (settings.language === 'en' ? 'Webcam reported' : 'Webcam gemeldet') 
          : (settings.language === 'en' ? 'Webcam offline melden' : 'Webcam offline melden')}
      </span>
    </button>
  );
}

export function GlobalMediaPlayer() {
  const { playingAudio, setPlayingAudio, playingVideo, setPlayingVideo, isAudioMinimized, setIsAudioMinimized } = useMedia();
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isBuffering, setIsBuffering] = useState(false);

  const isLiveStream = !duration || duration === Infinity || isNaN(duration);

  // Close video on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (playingVideo) setPlayingVideo(null);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [playingVideo, setPlayingVideo]);

  // Reset audio state when track changes
  useEffect(() => {
    if (playingAudio) {
      setAudioError(null);
      setIsPlaying(true);
      setCurrentTime(0);
      setDuration(0);
    }
  }, [playingAudio?.url]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        setAudioError(null);
      }).catch((e) => {
        console.warn("Audio play error:", e);
      });
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current || isLiveStream) return;
    audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
  };

  const cycleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const nextIdx = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const handleVolumeChange = (newVol: number) => {
    setVolume(newVol);
    setIsMuted(newVol === 0);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
      audioRef.current.muted = newVol === 0;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current || isLiveStream) return;
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    audioRef.current.currentTime = newTime;
  };

  return (
    <>
      {/* Hidden Native Audio Element */}
      {playingAudio && (
        <audio
          ref={audioRef}
          src={playingAudio.url ? (playingAudio.url.startsWith('http://') ? playingAudio.url.replace('http://', 'https://') : playingAudio.url) : ''}
          autoPlay
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime);
            }
          }}
          onLoadedMetadata={() => {
            if (audioRef.current) {
              setDuration(audioRef.current.duration);
              audioRef.current.playbackRate = playbackRate;
              audioRef.current.volume = volume;
            }
          }}
          onWaiting={() => setIsBuffering(true)}
          onPlaying={() => {
            setIsBuffering(false);
            setAudioError(null);
          }}
          onError={() => {
            setIsBuffering(false);
            setAudioError('Stream temporär nicht erreichbar');
          }}
        />
      )}

      {/* Global Full Audio Player Floating Dock */}
      {playingAudio && !isAudioMinimized && (
        <div className={`fixed bottom-0 left-0 right-0 md:bottom-6 md:left-[50%] md:right-auto md:translate-x-[-50%] md:w-[94vw] md:max-w-[850px] md:rounded-3xl z-[90] ${
          isDark ? 'bg-[#121215]/95 border-white/10 text-white' : 'bg-white/95 border-gray-200 text-black'
        } border shadow-2xl p-3 md:px-6 flex flex-col gap-2.5 animate-in slide-in-from-bottom duration-300 backdrop-blur-2xl overflow-hidden`}>
          
          {/* Subtle Ambient Background Glow from Cover Art */}
          {playingAudio.imageUrl && (
            <div 
              className="absolute top-[-50%] left-[-20%] h-[200%] w-[60%] pointer-events-none blur-[50px] opacity-30 dark:opacity-40 saturate-200 z-0"
              style={{ 
                backgroundImage: `url(${playingAudio.imageUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                maskImage: 'linear-gradient(to right, black 0%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to right, black 0%, transparent 100%)'
              }}
            />
          )}

          {/* Top Row: Track Meta + Center Controls + Right Tools */}
          <div className="flex items-center justify-between gap-3 z-10 relative">
            
            {/* Track Info */}
            <div className="flex items-center gap-3 min-w-0 max-w-[40%] md:max-w-[32%] shrink-0">
              {playingAudio.imageUrl ? (
                <img 
                  src={playingAudio.imageUrl} 
                  alt="" 
                  className="w-11 h-11 md:w-13 md:h-13 object-cover rounded-2xl flex-shrink-0 ring-1 ring-white/10 shadow-md" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <div className="w-11 h-11 md:w-13 md:h-13 bg-orange-500/10 text-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0 ring-1 ring-orange-500/20">
                  <Radio className="w-5 h-5" />
                </div>
              )}
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <h4 className="font-bold text-xs md:text-sm truncate min-w-0" title={playingAudio.title}>
                    {playingAudio.title}
                  </h4>
                  {isPlaying && !isBuffering && (
                    <div className="flex items-end gap-[2px] h-2.5 shrink-0 opacity-80">
                      {[1, 2, 3].map((i) => (
                        <div 
                          key={i}
                          className="w-0.5 rounded-t-sm bg-orange-500 animate-pulse"
                          style={{ animationDelay: `${i * 0.18}s`, height: `${40 + i * 20}%` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-[11px] opacity-60 truncate">{playingAudio.feedTitle || (isLiveStream ? 'Live Radio' : 'Audio Stream')}</p>
                {audioError && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1 mt-0.5 truncate">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    <span>{audioError}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Center Controls (Play, Skip, Speed) */}
            <div className="flex items-center gap-1.5 md:gap-3 shrink-0">
              {!isLiveStream && (
                <button
                  onClick={() => handleSkip(-15)}
                  className="p-1.5 md:p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                  title="15s zurück"
                >
                  <RotateCcw className="w-4 h-4 md:w-4.5 md:h-4.5" />
                </button>
              )}

              <button
                onClick={togglePlay}
                disabled={isBuffering && !audioError}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-orange-500/25 transition-all"
                title={isPlaying ? 'Pause' : 'Play'}
              >
                {isBuffering ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-5 h-5 fill-white" />
                ) : (
                  <Play className="w-5 h-5 fill-white ml-0.5" />
                )}
              </button>

              {!isLiveStream && (
                <button
                  onClick={() => handleSkip(30)}
                  className="p-1.5 md:p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition-colors"
                  title="30s vor"
                >
                  <RotateCw className="w-4 h-4 md:w-4.5 md:h-4.5" />
                </button>
              )}

              {!isLiveStream && (
                <button
                  onClick={cycleSpeed}
                  className="px-2 py-1 rounded-lg text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/10 transition-colors ml-1"
                  title="Wiedergabegeschwindigkeit ändern"
                >
                  {playbackRate}x
                </button>
              )}
            </div>

            {/* Right Side: Volume & Dock Controls */}
            <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
              {/* Volume Slider for Desktop */}
              <div className="hidden sm:flex items-center gap-2 px-2 py-1 rounded-full bg-white/5 border border-white/5">
                <button
                  onClick={toggleMute}
                  className="text-neutral-400 hover:text-white transition-colors p-1"
                  title={isMuted ? 'Ton an' : 'Stumm'}
                >
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1 accent-orange-500 cursor-pointer bg-white/20 rounded-lg"
                  title="Lautstärke"
                />
              </div>

              <MediaPlayerVoting 
                targetUrl={playingAudio.link || playingAudio.url}
                targetTitle={playingAudio.title}
                type="podcast"
                settings={settings}
                isDark={isDark}
              />

              <button 
                onClick={() => setIsAudioMinimized(true)}
                className={`p-2 rounded-full transition-all flex items-center justify-center border ${isDark ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-black/5 hover:bg-black/10 border-black/10'}`}
                title="Minimieren"
              >
                <Minimize2 className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setPlayingAudio(null)}
                className={`p-2 rounded-full transition-all flex items-center justify-center border ${isDark ? 'bg-white/5 hover:bg-white/10 border-white/10' : 'bg-black/5 hover:bg-black/10 border-black/10'}`}
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Bottom Row: Scrubber / Live Stream Bar */}
          {!isLiveStream ? (
            <div className="flex items-center gap-3 w-full z-10 relative pt-1">
              <span className="text-[10px] font-mono opacity-60 w-10 text-right">
                {formatTime(currentTime)}
              </span>
              <div className="relative flex-1 flex items-center group">
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full h-1.5 accent-orange-500 cursor-pointer bg-white/15 dark:bg-white/15 rounded-lg transition-all group-hover:h-2"
                />
              </div>
              <span className="text-[10px] font-mono opacity-60 w-10">
                {formatTime(duration)}
              </span>
            </div>
          ) : (
            <div className="flex items-center justify-between w-full z-10 relative px-1 pt-0.5 text-[11px] opacity-70">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Broadcast</span>
              </div>
              <span className="font-mono text-[10px]">{formatTime(currentTime)} übertragen</span>
            </div>
          )}
        </div>
      )}

      {/* Global Video Player */}
      {playingVideo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-5xl bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            <div className="absolute top-0 w-full bg-gradient-to-b from-black/90 to-transparent p-4 flex justify-between items-center z-10 pointer-events-none">
              <h3 className="text-white font-bold truncate pr-8 pointer-events-auto">{playingVideo.title}</h3>
              <button 
                onClick={() => setPlayingVideo(null)}
                className="p-2 rounded-full bg-black/80 hover:bg-black text-white transition-colors border border-white/20 pointer-events-auto cursor-pointer"
                title="Video schließen"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative pt-[56.25%] w-full">
              <iframe 
                src={`https://www.youtube.com/embed/${playingVideo.id}?autoplay=1&rel=0`} 
                title={playingVideo.title}
                className="absolute top-0 left-0 w-full h-full"
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
              />
            </div>
            <div className="p-4 bg-neutral-900 border-t border-white/5 flex flex-wrap gap-4 justify-between items-center text-sm">
              <div className="flex items-center gap-4">
                <a 
                  href={playingVideo.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-neutral-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <span>Auf YouTube ansehen</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <MediaPlayerVoting 
                  targetUrl={playingVideo.url}
                  targetTitle={playingVideo.title}
                  type={playingVideo.isWebcam ? 'webcam' : 'youtube'}
                  settings={settings}
                  isDark={isDark}
                />
              </div>

              {playingVideo.isWebcam && (
                <WebcamReportInline 
                  playingVideo={playingVideo} 
                  settings={settings} 
                  isDark={isDark} 
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
