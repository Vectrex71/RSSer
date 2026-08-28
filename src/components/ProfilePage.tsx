
import { useSettings } from '../context/SettingsContext';
import { useTranslation } from '../hooks/useTranslation';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage, OperationType, handleFirestoreError } from '../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { updateProfile, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, getDocFromServer } from 'firebase/firestore';
import { Loader2, User, Image as ImageIcon, Check, Zap } from 'lucide-react';
import { usePlan } from '../hooks/usePlan';
import { ThankYouPortalModal } from './dashboard/ThankYouPortalModal';
import { useCustomModal } from '../context/ModalContext';

export function ProfilePage() {
  const { settings, setPricingModalOpen } = useSettings();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { plan } = usePlan();
  const { showAlert } = useCustomModal();
  const [uploading, setUploading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  
  const [user, setUser] = useState(auth.currentUser);
  const [bio, setBio] = useState('');
  const [detailedBio, setDetailedBio] = useState('');
  const [socialLink1, setSocialLink1] = useState('');
  const [socialLink2, setSocialLink2] = useState('');
  const [socialLabel1, setSocialLabel1] = useState('');
  const [socialLabel2, setSocialLabel2] = useState('');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [blogLanguage, setBlogLanguage] = useState('de');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingBio, setSavingBio] = useState(false);
  const [bannerUrl, setBannerUrl] = useState('');
  const [bannerOffset, setBannerOffset] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startOffset, setStartOffset] = useState(50);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u?.displayName && !displayName) setDisplayName(u.displayName);
    });
    return () => unsubscribe();
  }, [displayName]);

  useEffect(() => {
    if (savingBio) {
      setProgress(0);
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + 5, 90));
      }, 50);
      return () => clearInterval(interval);
    } else {
      setProgress(100);
      setShowSaved(true);
      const timer = setTimeout(() => {
        setProgress(0);
        setShowSaved(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [savingBio]);

  useEffect(() => {
    if (!user) {
      setLoadingProfile(false);
      return;
    }
    const fetchProfile = async () => {
      try {
        const snap = await getDocFromServer(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data();
          if (data.bio) setBio(data.bio);
          if (data.detailedBio) setDetailedBio(data.detailedBio);
          if (data.socialLink1) setSocialLink1(data.socialLink1);
          if (data.socialLink2) setSocialLink2(data.socialLink2);
          if (data.socialLabel1) setSocialLabel1(data.socialLabel1);
          if (data.socialLabel2) setSocialLabel2(data.socialLabel2);
          if (data.displayName) setDisplayName(data.displayName);
          if (data.avatarUrl) setAvatarUrl(data.avatarUrl);
          if (data.bannerUrl) setBannerUrl(data.bannerUrl);
          if (data.bannerOffset !== undefined) setBannerOffset(data.bannerOffset);
          if (data.blogLanguage) setBlogLanguage(data.blogLanguage);
        }
      } catch(e) {
        console.error(e);
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, [user]);

  const compressImage = (file: File, maxDim = 1200): Promise<Blob | File> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;
          
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(file);
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                if (blob.size >= file.size) {
                  resolve(file);
                } else {
                  resolve(blob);
                }
              } else {
                resolve(file);
              }
            },
            'image/jpeg',
            0.8
          );
        };
        img.onerror = () => resolve(file);
        img.src = event.target?.result as string;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    const file = e.target.files[0];
    const storageRef = ref(storage, `avatars/${user.uid}/${file.name}`);
    setUploading(true);

    try {
      const compressedFile = await compressImage(file, 300); // 300px is perfect for avatars
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const userRef = doc(db, 'users', user.uid);
      try {
        await setDoc(userRef, { avatarUrl: downloadURL }, { merge: true });
        setAvatarUrl(downloadURL);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid);
      }
    } catch (err) {
      console.error(t('avatar-upload-failed'), err);
      await showAlert(t('avatar-upload-failed'), 'Upload Fehler');
    } finally {
      setUploading(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;
    
    const file = e.target.files[0];
    const storageRef = ref(storage, `banners/${user.uid}/${file.name}`);
    setUploadingBanner(true);

    try {
      const compressedFile = await compressImage(file, 1600); // 1600px is perfect for banners
      const snapshot = await uploadBytes(storageRef, compressedFile);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const userRef = doc(db, 'users', user.uid);
      try {
        await setDoc(userRef, { bannerUrl: downloadURL }, { merge: true });
        setBannerUrl(downloadURL);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid);
      }
    } catch (err) {
      console.error(t('banner-upload-failed') || 'Banner upload failed', err);
      await showAlert(t('banner-upload-failed') || 'Banner upload failed', 'Upload Fehler');
    } finally {
      setUploadingBanner(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingBio(true);
    try {
       const userRef = doc(db, 'users', user.uid);
       await setDoc(userRef, { bio, detailedBio, socialLink1, socialLink2, socialLabel1, socialLabel2, displayName, blogLanguage, avatarUrl, bannerUrl, bannerOffset }, { merge: true });
       await updateProfile(user, { 
         displayName,
         photoURL: avatarUrl || undefined
       });

       // Synchronize with public sources
       const publicSourcesRef = collection(db, 'publicSources');
       const q = query(publicSourcesRef, where('addedBy', '==', user.uid), where('type', '==', 'blogs'));
       const snapshot = await getDocs(q);
       
       const updates = snapshot.docs.map(d => 
         updateDoc(doc(db, 'publicSources', d.id), {
           authorName: displayName,
           authorBio: bio,
           authorDetailedBio: detailedBio,
           authorSocialLink1: socialLink1,
           authorSocialLink2: socialLink2,
           authorSocialLabel1: socialLabel1,
           authorSocialLabel2: socialLabel2,
           authorAvatar: avatarUrl,
           authorBanner: bannerUrl,
           authorBannerOffset: bannerOffset,
           language: blogLanguage
         })
       );
       await Promise.all(updates);

    } catch(err) {
       handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid);
    } finally {
       setSavingBio(false);
    }
  };

  const handleManageSubscription = async () => {
    if (plan === 'FREE') {
      setPricingModalOpen(true);
      return;
    }
    setShowThankYouModal(true);
  };

  const handleProceedToPortal = async () => {
    setPortalLoading(true);
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.uid,
          email: user?.email
        }),
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setPricingModalOpen(true);
        setShowThankYouModal(false);
      }
    } catch(e) {
      console.error(e);
      setPricingModalOpen(true);
      setShowThankYouModal(false);
    } finally {
      setPortalLoading(false);
    }
  };

  const themeDark = settings.theme === 'dark';

  if (loadingProfile) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className={`p-4 sm:p-8 ${themeDark ? 'text-white' : 'text-gray-900'} relative z-10`}>
      <div className="max-w-[1400px] mx-auto animate-in fade-in duration-300">
        {/* UNIFIED PROFILE CARD */}
        <div className={`rounded-[2.5rem] border mb-12 overflow-hidden backdrop-blur-md ${themeDark ? 'bg-neutral-900/40 border-white/10' : 'bg-white/60 border-gray-100/80'}`}>
            {/* Banner */}
            <div 
              className={`relative w-full h-[250px] sm:h-[400px] group uppercase tracking-widest text-[10px] font-bold overflow-hidden ${bannerUrl ? 'cursor-ns-resize' : ''}`}
              onMouseDown={(e) => {
                if (!bannerUrl) return;
                setIsDragging(true);
                setStartY(e.clientY);
                setStartOffset(bannerOffset);
              }}
              onMouseMove={(e) => {
                if (!isDragging) return;
                const deltaY = e.clientY - startY;
                const containerHeight = e.currentTarget.clientHeight;
                const percentageChange = (deltaY / containerHeight) * 100;
                const newOffset = Math.max(0, Math.min(100, startOffset - percentageChange));
                setBannerOffset(newOffset);
              }}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onTouchStart={(e) => {
                if (!bannerUrl) return;
                setIsDragging(true);
                setStartY(e.touches[0].clientY);
                setStartOffset(bannerOffset);
              }}
              onTouchMove={(e) => {
                if (!isDragging) return;
                const deltaY = e.touches[0].clientY - startY;
                const containerHeight = e.currentTarget.clientHeight;
                const percentageChange = (deltaY / containerHeight) * 100;
                const newOffset = Math.max(0, Math.min(100, startOffset - percentageChange));
                setBannerOffset(newOffset);
              }}
              onTouchEnd={() => setIsDragging(false)}
            >
               {bannerUrl ? (
                  <img 
                    src={bannerUrl} 
                    alt="Banner" 
                    className="w-full h-full object-cover pointer-events-none select-none transition-transform duration-700 group-hover:scale-105" 
                    style={{ objectPosition: `50% ${bannerOffset}%` }}
                    referrerPolicy="no-referrer"
                  />
               ) : (
                  <div className="w-full h-full bg-gradient-to-br from-neutral-200 to-neutral-300 dark:from-neutral-800 dark:to-neutral-700" />
               )}

               {/* LANGUAGE FLAG - TOP LEFT */}
               {blogLanguage && (
                  <div className="absolute top-6 left-8 z-30 text-3xl sm:text-4xl drop-shadow-md">
                     {blogLanguage === 'de' ? '🇩🇪' : 
                      blogLanguage === 'en' ? '🇺🇸' :
                      blogLanguage === 'fr' ? '🇫🇷' :
                      blogLanguage === 'es' ? '🇪🇸' :
                      blogLanguage === 'it' ? '🇮🇹' : ''}
                  </div>
               )}

               {/* BANNER UPLOAD BUTTON - TOP RIGHT */}
               <div 
                 className="absolute top-6 right-8 z-40 opacity-0 group-hover:opacity-100 transition-opacity"
                 onMouseDown={e => e.stopPropagation()}
                 onTouchStart={e => e.stopPropagation()}
               >
                 <label className="flex items-center gap-2 px-4 py-2 bg-black/60 backdrop-blur-md rounded-full text-white cursor-pointer hover:bg-black/80 transition-colors border border-white/20">
                    {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                      <>
                        <ImageIcon className="w-4 h-4" />
                        <span className="text-[10px] uppercase font-black tracking-widest">{t('change-banner') || 'Banner ändern'}</span>
                      </>
                    )}
                    <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingBanner} className="hidden" />
                 </label>
               </div>

               {bannerUrl && !isDragging && (
                 <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-[9px] font-black px-3 py-1.5 rounded-full text-white/70 uppercase tracking-[0.2em] pointer-events-none">
                    {t('drag-to-reposition')}
                 </div>
               )}
            </div>

            <div className="px-6 pb-6 pt-0 relative">
                {/* AVATAR OVERLAP (CENTERED) */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-16 sm:-top-24 z-20">
                  <div className="w-32 h-32 sm:w-48 sm:h-48 rounded-full border-[6px] border-white dark:border-neutral-900 bg-gray-200 dark:bg-neutral-800 relative group overflow-hidden shrink-0 shadow-2xl transition-transform hover:scale-105 duration-500">
                      {avatarUrl ? (
                         <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                         <User className="w-full h-full p-8 text-gray-400" />
                      )}
                      <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center cursor-pointer text-white text-[10px] uppercase font-bold text-center p-2">
                         <User className="w-5 h-5 mb-1" />
                         <span>{t('change-picture') || 'Bild ändern'}</span>
                         <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploading} className="hidden" />
                      </label>
                  </div>
                </div>

                {/* CONTENT BELOW BANNER */}
                <div className="flex flex-col pt-4">
                  {/* LABELS ROW */}
                  <div className="w-full flex justify-between items-center mb-0 px-2 hidden sm:flex">
                      <div className="flex-1">
                         <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500 drop-shadow-sm">{t('author')}</span>
                      </div>
                      {/* Spacer block for avatar area */}
                      <div className="shrink-0 w-32 sm:w-48" /> 
                      <div className="flex-1 flex justify-end">
                          <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.15em] opacity-40">
                                  <span>{t('joined-on')}</span>
                              </div>
                              <span className="text-[12px] font-black opacity-80 whitespace-nowrap uppercase">
                                MAI 2026
                              </span>
                          </div>
                      </div>
                  </div>
                </div>

                <div className="w-full flex items-start justify-between gap-6 sm:gap-12 mt-4 sm:mt-0">
                    {/* NAME (LEFT on desktop, centered on mobile later) */}
                    <div className="flex-1 min-w-0 px-2">
                      <div className="inline-block relative group/name w-full">
                        <label className="block text-[10px] font-black mb-1 opacity-40 uppercase tracking-[0.2em] leading-none sm:hidden">{t('author')}</label>
                        <input 
                           type="text" 
                           value={displayName}
                           onChange={e => setDisplayName(e.target.value)}
                           className={`text-2xl sm:text-4xl font-black w-full bg-transparent border-none focus:outline-none px-0 py-1 transition-all placeholder:opacity-20 ${themeDark ? 'text-white' : 'text-gray-900 focus:text-[#FF4500]'}`}
                           placeholder={t('name-placeholder')}
                        />
                      </div>
                    </div>

                    {/* AVATAR SPACER (CENTER) */}
                    <div className="hidden sm:block w-32 sm:w-48 shrink-0 pointer-events-none" />

                    {/* RIGHT SPACER */}
                    <div className="hidden sm:flex flex-col items-end flex-1 min-w-0 px-2">
                        {/* Balanced spacer */}
                    </div>
                </div>

                {/* Bio & Blog Language Integrated */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-8 px-2">
                  <div className="md:col-span-12">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                      <label className="block text-[10px] font-black opacity-40 uppercase tracking-[0.2em]">{t('short-bio')}</label>
                      
                      <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-black/5 dark:bg-white/5 border border-transparent dark:border-white/5">
                        <span className="text-[9px] font-black opacity-30 uppercase tracking-widest px-2 mr-1">Lang:</span>
                        {[
                          { code: 'de', flag: '🇩🇪', name: 'DE' },
                          { code: 'en', flag: '🇺🇸', name: 'EN' },
                          { code: 'fr', flag: '🇫🇷', name: 'FR' },
                          { code: 'es', flag: '🇪🇸', name: 'ES' },
                          { code: 'it', flag: '🇮🇹', name: 'IT' },
                        ].map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setBlogLanguage(lang.code)}
                            className={`flex items-center justify-center p-2 rounded-lg text-lg transition-all ${
                              blogLanguage === lang.code 
                                ? 'bg-white dark:bg-neutral-800 scale-110' 
                                : 'opacity-40 hover:opacity-100 dark:hover:text-white hover:scale-105 grayscale hover:grayscale-0'
                            }`}
                            title={lang.name}
                          >
                            {lang.flag}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative group/bio">
                      <textarea 
                         value={bio}
                         onChange={e => setBio(e.target.value.substring(0, 70))}
                         maxLength={70}
                         placeholder={t('bio-placeholder')}
                         className={`w-full h-24 p-4 border-2 rounded-2xl text-base font-medium resize-none focus:outline-none transition-all ${themeDark ? 'bg-black/20 border-white/5 focus:border-[#FF4500] text-white' : 'bg-gray-50 border-gray-100 focus:border-[#FF4500] text-gray-900'}`}
                      />
                      <div className={`absolute bottom-3 right-3 text-[10px] font-black px-2 py-1 rounded-md tracking-widest ${bio.length >= 70 ? 'bg-red-500 text-white' : themeDark ? 'bg-black/40 text-gray-400' : 'bg-white/60 text-gray-500'}`}>
                         {bio.length} / 70
                      </div>
                    </div>
                  </div>

                  <div className="md:col-span-12">
                    <label className="block text-[10px] font-black opacity-40 uppercase tracking-[0.2em] mb-4">{t('detailed-bio-label')}</label>
                    <div className="relative group/detailed">
                      <textarea 
                         value={detailedBio}
                         onChange={e => setDetailedBio(e.target.value.substring(0, 360))}
                         maxLength={360}
                         placeholder={t('detailed-bio-placeholder')}
                         className={`w-full h-48 p-4 border-2 rounded-2xl text-base font-medium resize-none focus:outline-none transition-all ${themeDark ? 'bg-black/20 border-white/5 focus:border-[#FF4500] text-white' : 'bg-gray-50 border-gray-100 focus:border-[#FF4500] text-gray-900'}`}
                      />
                      <div className={`absolute bottom-3 right-3 text-[10px] font-black px-2 py-1 rounded-md tracking-widest ${detailedBio.length >= 360 ? 'bg-red-500 text-white' : themeDark ? 'bg-black/40 text-gray-400' : 'bg-white/60 text-gray-500'}`}>
                         {detailedBio.length} / 360
                      </div>
                    </div>
                  </div>

                   {/* SOCIAL LINKS */}
                   <div className="md:col-span-12 mt-6">
                      <label className="block text-[10px] font-black opacity-50 uppercase tracking-[0.2em] mb-4 text-yellow-600 dark:text-yellow-400">
                         {t('social-links-label')}
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         {/* Link 1 Card */}
                         <div className={`p-5 rounded-2xl border transition-all ${themeDark ? 'bg-neutral-900/20 border-white/5 hover:border-yellow-500/20' : 'bg-gray-50/50 border-gray-100 hover:border-yellow-500/10'}`}>
                            <span className="block text-[11px] font-black tracking-wider text-yellow-600 dark:text-yellow-400 uppercase mb-4">
                               {t('link-1')}
                            </span>
                            <div className="space-y-4">
                               <div>
                                  <label className="block text-[9px] font-black opacity-40 uppercase mb-1.5 ml-1">
                                     {blogLanguage === 'de' ? 'NAME DES LINKS (Z.B. BLUESKY)' : 'LINK LABEL (E.G. BLUESKY)'}
                                  </label>
                                  <input 
                                     type="text" 
                                     value={socialLabel1} 
                                     onChange={e => setSocialLabel1(e.target.value.substring(0, 30))} 
                                     maxLength={30}
                                     placeholder={blogLanguage === 'de' ? 'z.B. Bluesky, YouTube, Portfolio' : 'e.g. Bluesky, YouTube, Portfolio'} 
                                     className={`w-full p-3 rounded-xl text-sm border-2 transition-all outline-none ${themeDark ? 'bg-black/30 border-white/5 focus:border-yellow-500 text-white' : 'bg-white border-gray-200/60 focus:border-yellow-500 text-gray-900'}`} 
                                  />
                               </div>
                               <div>
                                  <label className="block text-[9px] font-black opacity-40 uppercase mb-1.5 ml-1">
                                     {blogLanguage === 'de' ? 'URL (ADRESSE)' : 'URL (ADDRESS)'}
                                  </label>
                                  <input 
                                     type="url" 
                                     value={socialLink1} 
                                     onChange={e => setSocialLink1(e.target.value)} 
                                     placeholder="https://..." 
                                     className={`w-full p-3 rounded-xl text-sm border-2 transition-all outline-none ${themeDark ? 'bg-black/30 border-white/5 focus:border-yellow-500 text-white' : 'bg-white border-gray-200/60 focus:border-yellow-500 text-gray-900'}`} 
                                  />
                               </div>
                            </div>
                         </div>

                         {/* Link 2 Card */}
                         <div className={`p-5 rounded-2xl border transition-all ${themeDark ? 'bg-neutral-900/20 border-white/5 hover:border-yellow-500/20' : 'bg-gray-50/50 border-gray-100 hover:border-yellow-500/10'}`}>
                            <span className="block text-[11px] font-black tracking-wider text-yellow-600 dark:text-yellow-400 uppercase mb-4">
                               {t('link-2')}
                            </span>
                            <div className="space-y-4">
                               <div>
                                  <label className="block text-[9px] font-black opacity-40 uppercase mb-1.5 ml-1">
                                     {blogLanguage === 'de' ? 'NAME DES LINKS (Z.B. YOUTUBE)' : 'LINK LABEL (E.G. YOUTUBE)'}
                                  </label>
                                  <input 
                                     type="text" 
                                     value={socialLabel2} 
                                     onChange={e => setSocialLabel2(e.target.value.substring(0, 30))} 
                                     maxLength={30}
                                     placeholder={blogLanguage === 'de' ? 'z.B. Bluesky, YouTube, Portfolio' : 'e.g. Bluesky, YouTube, Portfolio'} 
                                     className={`w-full p-3 rounded-xl text-sm border-2 transition-all outline-none ${themeDark ? 'bg-black/30 border-white/5 focus:border-yellow-500 text-white' : 'bg-white border-gray-200/60 focus:border-yellow-500 text-gray-900'}`} 
                                  />
                               </div>
                               <div>
                                  <label className="block text-[9px] font-black opacity-40 uppercase mb-1.5 ml-1">
                                     {blogLanguage === 'de' ? 'URL (ADRESSE)' : 'URL (ADDRESS)'}
                                  </label>
                                  <input 
                                     type="url" 
                                     value={socialLink2} 
                                     onChange={e => setSocialLink2(e.target.value)} 
                                     placeholder="https://..." 
                                     className={`w-full p-3 rounded-xl text-sm border-2 transition-all outline-none ${themeDark ? 'bg-black/30 border-white/5 focus:border-yellow-500 text-white' : 'bg-white border-gray-200/60 focus:border-yellow-500 text-gray-900'}`} 
                                  />
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>
                </div>

                {/* Actions Row */}
                <div className="mt-8 pt-8 border-t border-gray-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
                    <div className="flex items-center gap-3">
                       {plan === 'FREE' && (
                         <button 
                           onClick={() => setPricingModalOpen(true)}
                           className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 text-orange-500 rounded-xl text-[11px] font-black tracking-widest hover:bg-orange-500 hover:text-white transition-all animate-pulse hover:animate-none"
                         >
                           <Zap className="w-3.5 h-3.5 fill-current" />
                           <span>{t('go-pro')}</span>
                         </button>
                       )}
                       {showSaved && (
                         <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 text-green-500 rounded-full text-[10px] font-black tracking-widest animate-in zoom-in duration-300">
                           <Check className="w-3 h-3 stroke-[3]" />
                           <span>{t('settings-saved')}</span>
                         </div>
                       )}
                       {savingBio && (
                         <div className="flex flex-col gap-1 w-32">
                           <div className="h-1 bg-gray-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                             <div className="h-full bg-[#FF4500] transition-all duration-300" style={{ width: `${progress}%` }} />
                           </div>
                           <span className="text-[8px] font-black opacity-30 uppercase tracking-widest text-center">{t('synchronizing')}</span>
                         </div>
                       )}
                    </div>

                    <button 
                      onClick={handleSaveProfile} 
                      disabled={savingBio} 
                      className="w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 bg-[#FF4500] hover:bg-[#ff5500] text-white rounded-2xl text-sm font-black uppercase tracking-widest transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:scale-100 group"
                    >
                       {savingBio ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                         <>
                           <span>{t('save-bio')}</span>
                           <Check className="w-4 h-4 transition-transform group-hover:scale-125" />
                         </>
                       )}
                    </button>
                </div>
            </div>
        </div>
        
        {/* SUBSCRIPTION */}
        <div className={`p-6 rounded-2xl border backdrop-blur-md ${themeDark ? 'bg-neutral-900/40 border-white/10' : 'bg-white/60 border-gray-200/80 shadow-sm'}`}>
           <h2 className="text-xl font-bold mb-2">{t('subscription-billing')}</h2>
           <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
             {t('subscription-desc')}
           </p>
           <button 
             onClick={handleManageSubscription}
             disabled={portalLoading}
             className={`w-full sm:w-auto py-3 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 active:scale-95 ${themeDark ? 'bg-white text-black' : 'bg-black text-white'} disabled:opacity-50 disabled:scale-100`}
           >
             {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (plan === 'FREE' ? <Zap className="w-4 h-4 fill-current mr-1" /> : null)}
             {plan === 'FREE' ? t('subscribe') : t('manage-subscription')}
           </button>
        </div>
      </div>

      <ThankYouPortalModal
        isOpen={showThankYouModal}
        onClose={() => setShowThankYouModal(false)}
        onProceed={handleProceedToPortal}
        loading={portalLoading}
      />
    </div>
  );
}
