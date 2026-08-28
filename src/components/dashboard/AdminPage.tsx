import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { useSettings } from '../../context/SettingsContext';
import { useParams, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, storage } from '../../lib/firebase';
import { collection, getDocs, updateDoc, doc, deleteDoc, query, orderBy, addDoc, limit, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Loader2, Edit3, X, Upload, Trash2, Search, Filter, Settings, Youtube, Podcast, Radio, Rss, Camera, FileText, AlertTriangle, RefreshCw, Play, Globe, CheckCheck, Megaphone, Send, Bold, Italic, List as ListIcon, ListOrdered, Heading1, Heading2, Quote, Underline as UnderlineIcon, Pilcrow, Calendar } from 'lucide-react';
import { useMedia } from '../../context/MediaContext';
import { FEED_CATEGORIES } from '../../lib/constants';
import { tr } from '../../lib/t';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { createAnnouncement, fetchAnnouncements, Announcement, retranslateAnnouncement } from '../../services/announcementService';
import { testGeminiConnection, translateContent } from '../../services/geminiService';
import { generateDefaultSources } from '../../lib/defaultSources';
import { useModal } from '../../context/ModalContext';
import { isAdminEmail } from '../../lib/admin';

const AdminMenuBar = ({ editor }: { editor: any }) => {
  const { settings } = useSettings();
  const isDark = settings.theme === 'dark';

  if (!editor) return null;

  const btnClass = (isActive: boolean) => 
    `p-2 rounded-lg transition-colors ${isActive ? (isDark ? 'bg-orange-500/20 text-orange-500' : 'bg-orange-100 text-orange-700') : (isDark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900')}`;

  return (
    <div className="flex flex-wrap gap-1 justify-center py-1">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnClass(editor.isActive('bold'))} title="Fettschrift">
        <Bold className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnClass(editor.isActive('italic'))} title="Kursiv">
        <Italic className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={btnClass(editor.isActive('underline'))} title="Unterstrichen">
        <UnderlineIcon className="w-4 h-4" />
      </button>
      <div className={`w-px h-6 mx-1 self-center ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}></div>
      <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={btnClass(editor.isActive('paragraph'))} title="Normaler Text">
        <Pilcrow className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={btnClass(editor.isActive('heading', { level: 1 }))} title="Überschrift 1">
        <Heading1 className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnClass(editor.isActive('heading', { level: 2 }))} title="Überschrift 2">
        <Heading2 className="w-4 h-4" />
      </button>
      <div className={`w-px h-6 mx-1 self-center ${isDark ? 'bg-white/10' : 'bg-gray-300'}`}></div>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnClass(editor.isActive('bulletList'))} title="Aufzählungsliste">
        <ListIcon className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnClass(editor.isActive('orderedList'))} title="Nummerierte Liste">
        <ListOrdered className="w-4 h-4" />
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnClass(editor.isActive('blockquote'))} title="Zitat">
        <Quote className="w-4 h-4" />
      </button>
    </div>
  );
};

export function AdminPage() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { setPlayingAudio } = useMedia();
  const { showAlert, showConfirm } = useModal();
  const isDark = settings.theme === 'dark';
  const { category: routeCategory } = useParams<{category?: string}>();
  const typeFilter = routeCategory || 'feeds';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [alerts, setAlerts] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isPublishingAnnouncement, setIsPublishingAnnouncement] = useState(false);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [webcamReports, setWebcamReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (isAdminEmail(user?.email)) {
        setIsAdmin(true);
        // Trigger data fetches once we know we are admin
        fetchAlerts();
        loadAnnouncements();
        fetchWebcamReports();
      } else {
        setIsAdmin(false);
        if (user) navigate('/');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchSources(typeFilter);
    }
  }, [typeFilter, isAdmin]);

  const loadAnnouncements = async () => {
    try {
      const all = await fetchAnnouncements();
      setAnnouncements(all);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRetranslate = async (ann: Announcement) => {
    const confirmed = await showConfirm(
      'Möchtest du diese Ankündigung wirklich erneut in alle Sprachen übersetzen lassen?',
      'Ankündigung neu übersetzen',
      'Neu übersetzen'
    );
    if (!confirmed) return;
    
    setIsPublishingAnnouncement(true);
    try {
      await retranslateAnnouncement(ann.id, ann.content.de);
      await showAlert('Die Ankündigung wurde erfolgreich neu übersetzt!', 'Erfolg');
      loadAnnouncements();
    } catch (err: any) {
      console.error(err);
      await showAlert('Fehler beim Übersetzen: ' + err.message, 'Fehler');
    } finally {
      setIsPublishingAnnouncement(false);
    }
  };

  const handlePublishAnnouncement = async () => {
    if (!editor) return;
    
    // First, save the current editor's HTML to the active language's state
    const currentHtml = editor.getHTML();
    let currentDe = htmlDe;
    let currentEn = htmlEn;
    let currentFr = htmlFr;
    let currentEs = htmlEs;

    if (activeLang === 'de') { currentDe = currentHtml; setHtmlDe(currentHtml); }
    else if (activeLang === 'en') { currentEn = currentHtml; setHtmlEn(currentHtml); }
    else if (activeLang === 'fr') { currentFr = currentHtml; setHtmlFr(currentHtml); }
    else if (activeLang === 'es') { currentEs = currentHtml; setHtmlEs(currentHtml); }

    if (!currentDe || currentDe === '<p></p>' || currentDe === '<p></p>\n') {
      await showAlert('Bitte fülle zuerst den deutschen Text aus, bevor du veröffentlichst.', 'Text erforderlich');
      return;
    }
    
    const confirmed = await showConfirm(
      'Möchtest du die Ankündigung jetzt veröffentlichen? Fehlende Übersetzungen werden automatisch per Gemini-KI generiert.',
      'Ankündigung veröffentlichen',
      'Jetzt veröffentlichen'
    );
    if (!confirmed) {
      return;
    }

    setIsPublishingAnnouncement(true);
    try {
      let en = currentEn || '';
      let fr = currentFr || '';
      let es = currentEs || '';
      
      const needsTranslation = (!en || en === '<p></p>') || (!fr || fr === '<p></p>') || (!es || es === '<p></p>');
      
      if (needsTranslation) {
        try {
          const targetLangs = [];
          if (!en || en === '<p></p>') targetLangs.push('en');
          if (!fr || fr === '<p></p>') targetLangs.push('fr');
          if (!es || es === '<p></p>') targetLangs.push('es');
          
          const translations = await translateContent(currentDe, targetLangs);
          if (translations.en) en = translations.en;
          if (translations.fr) fr = translations.fr;
          if (translations.es) es = translations.es;
        } catch (aiErr: any) {
          console.error("AI Translation failed during publish:", aiErr);
          await showAlert(`KI-Übersetzung fehlgeschlagen: ${aiErr.message}. Die Ankündigung wird nur auf Deutsch (oder mit bestehenden Texten) veröffentlicht.`, 'Hinweis');
          en = en || currentDe;
          fr = fr || currentDe;
          es = es || currentDe;
        }
      }

      await createAnnouncement({
        de: currentDe,
        en,
        fr,
        es
      });
      
      // Clear all
      setHtmlDe('');
      setHtmlEn('');
      setHtmlFr('');
      setHtmlEs('');
      editor.commands.clearContent();
      
      // Reload list
      const all = await fetchAnnouncements();
      setAnnouncements(all);
      
      await showAlert('Die Ankündigung wurde erfolgreich veröffentlicht!', 'Erfolg');
    } catch (err: any) {
      console.error(err);
      await showAlert('Fehler: ' + err.message, 'Fehler');
    } finally {
      setIsPublishingAnnouncement(false);
    }
  };

  const handleTestAI = async () => {
    setIsTestingAI(true);
    setTestResult(null);
    try {
      const response = await testGeminiConnection();
      setTestResult({ 
        success: true, 
        message: `Erfolg! Gemini hat geantwortet: "${response}"` 
      });
    } catch (err: any) {
      setTestResult({ success: false, message: `Fehler: ${err.message}` });
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    const confirmed = await showConfirm(
      'Möchtest du diese Ankündigung wirklich unwiderruflich löschen?',
      'Ankündigung löschen',
      'Löschen'
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
      setAnnouncements(prev => prev.filter(a => a.id !== id));
      await showAlert('Die Ankündigung wurde gelöscht.', 'Erfolg');
    } catch (err) {
      console.error(err);
      await showAlert('Fehler beim Löschen der Ankündigung.', 'Fehler');
    }
  };

  const [activeLang, setActiveLang] = useState<'de' | 'en' | 'fr' | 'es'>('de');
  const [htmlDe, setHtmlDe] = useState('');
  const [htmlEn, setHtmlEn] = useState('');
  const [htmlFr, setHtmlFr] = useState('');
  const [htmlEs, setHtmlEs] = useState('');

  const editor = useEditor({
    extensions: [StarterKit, Underline, Placeholder.configure({ placeholder: 'Inhalt der Ankündigung schreiben...' })],
    editorProps: {
      attributes: {
        class: `prose prose-sm ${isDark ? 'prose-invert' : ''} max-w-none focus:outline-none min-h-[300px] px-8 py-6 font-medium leading-relaxed`,
      },
    },
  });

  const handleLangChange = (newLang: 'de' | 'en' | 'fr' | 'es') => {
    if (!editor) return;
    
    // Save current editor HTML to state of the outgoing language
    const currentHtml = editor.getHTML();
    if (activeLang === 'de') setHtmlDe(currentHtml);
    else if (activeLang === 'en') setHtmlEn(currentHtml);
    else if (activeLang === 'fr') setHtmlFr(currentHtml);
    else if (activeLang === 'es') setHtmlEs(currentHtml);

    // Swap active language tab
    setActiveLang(newLang);

    // Retrieve and set the state of the incoming language
    let targetHtml = '';
    if (newLang === 'de') targetHtml = htmlDe;
    else if (newLang === 'en') targetHtml = htmlEn;
    else if (newLang === 'fr') targetHtml = htmlFr;
    else if (newLang === 'es') targetHtml = htmlEs;

    editor.commands.setContent(targetHtml || '<p></p>');
  };

  const [editingSource, setEditingSource] = useState<any>(null);
  const [isAddingSource, setIsAddingSource] = useState(false);
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch(e) {
      console.error('Failed to fetch alerts', e);
    }
  };

  const clearAlerts = async () => {
    try {
      await fetch('/api/alerts', { method: 'DELETE' });
      setAlerts([]);
    } catch(e) {
      console.error('Failed to clear alerts', e);
    }
  };

  const fetchWebcamReports = async () => {
    try {
      setLoadingReports(true);
      const snaps = await getDocs(collection(db, 'webcamReports'));
      const data = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      setWebcamReports(data);
    } catch (e) {
      console.error('Failed to fetch webcam reports:', e);
    } finally {
      setLoadingReports(false);
    }
  };

  const handleResolveReport = async (reportId: string, webcamId?: string) => {
    try {
      // 1. Delete this specific report
      await deleteDoc(doc(db, 'webcamReports', reportId));
      
      // 2. Try resetting reportsCount in publicSources if available
      if (webcamId) {
        try {
          await updateDoc(doc(db, 'publicSources', webcamId), {
            reportsCount: 0
          });
        } catch (_) {}
      }
      
      setWebcamReports(webcamReports.filter(r => r.id !== reportId));
      await showAlert('Die Meldung wurde erfolgreich verworfen.', 'Meldung verworfen');
    } catch (e) {
      console.error(e);
      await showAlert('Fehler beim Verwerfen der Meldung.', 'Fehler');
    }
  };

  const handleDeleteWebcamFromReport = async (report: any) => {
    const { id: reportId, webcamId, webcamUrl, webcamTitle, reportedByUserId } = report;
    const confirmed = await showConfirm(
      'Möchtest du diese gemeldete Webcam wirklich dauerhaft aus der globalen Datenbank und den Feeds entfernen?',
      'Webcam entfernen',
      'Dauerhaft entfernen'
    );
    if (!confirmed) return;
    try {
      // 1. Delete the public source
      let sourceDocId = '';
      
      if (webcamUrl) {
        const q = query(collection(db, 'publicSources'), where('url', '==', webcamUrl));
        const snaps = await getDocs(q);
        if (!snaps.empty) {
          sourceDocId = snaps.docs[0].id;
        }
      }

      if (!sourceDocId && webcamTitle) {
        const q = query(collection(db, 'publicSources'), where('title', '==', webcamTitle));
        const snaps = await getDocs(q);
        if (!snaps.empty) {
          sourceDocId = snaps.docs[0].id;
        }
      }

      if (!sourceDocId) {
        const qAll = query(collection(db, 'publicSources'), where('type', '==', 'webcams'));
        const snapsAll = await getDocs(qAll);
        const norm = (u: string) => u ? u.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '') : '';
        const webcamUrlNorm = norm(webcamUrl);
        const matchDoc = snapsAll.docs.find(d => {
          const dUrl = d.data().url;
          return dUrl && norm(dUrl) === webcamUrlNorm;
        });
        if (matchDoc) {
          sourceDocId = matchDoc.id;
        }
      }
      
      if (sourceDocId) {
        await deleteDoc(doc(db, 'publicSources', sourceDocId));
        setSources(prev => prev.filter(s => s.id !== sourceDocId));
      }

      // 2. Delete from the reporter's private feeds
      if (reportedByUserId && webcamId) {
        try {
          await deleteDoc(doc(db, 'users', reportedByUserId, 'feeds', webcamId));
        } catch (feedErr) {
          console.error('Failed to delete private feed document:', feedErr);
        }
      } else if (webcamId) {
        try {
          await deleteDoc(doc(db, 'users', auth.currentUser?.uid || '', 'feeds', webcamId));
        } catch (_) {}
      }

      // 3. Delete the report document
      await deleteDoc(doc(db, 'webcamReports', reportId));
      setWebcamReports(prev => prev.filter(r => r.id !== reportId));
      
      await showAlert('Webcam erfolgreich aus der globalen Datenbank und den Feeds gelöscht.', 'Erfolg');
    } catch (e) {
      console.error(e);
      await showAlert('Fehler beim Löschen der Webcam.', 'Fehler');
    }
  };

  const fetchSources = async (targetType?: string) => {
    const currentType = targetType || typeFilter;
    if (currentType === 'news') {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const q = query(
        collection(db, 'publicSources'),
        where('type', '==', currentType),
        limit(300)
      );
      const snaps = await getDocs(q);
      const data = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a: any, b: any) => (a.title || '').localeCompare(b.title || ''));
      setSources(data);
    } catch (e) {
      console.error(e);
      await showAlert('Fehler beim Laden der Quellen. Hast du Administrator-Rechte?', 'Zugriffsfehler');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncDefaultSources = async () => {
    setIsSyncing(true);
    try {
      const addedCount = await generateDefaultSources();
      await showAlert(`${addedCount} neue Standard-Quellen wurden erfolgreich hinzugefügt und bestehende Einträge wurden aktualisiert!`, 'Synchronisation erfolgreich');
      fetchSources(typeFilter);
    } catch (e: any) {
      console.error(e);
      await showAlert('Fehler bei der Synchronisation: ' + e.message, 'Fehler');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleCleanupSources = async () => {
    const confirmed = await showConfirm(
      "Bist du sicher, dass du alle fehlerhaften Quellen aus der Datenbank löschen möchtest? Dies überprüft alle Quellen und entfernt diejenigen, die nicht erreichbar sind oder Fehler (wie 404) zurückgeben.",
      "Datenbank bereinigen",
      "Jetzt bereinigen"
    );
    if (!confirmed) {
      return;
    }
    
    setIsCleaning(true);
    try {
      const response = await fetch('/api/admin/cleanup-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Server-Fehler: ${response.status}`);
      }
      
      const data = await response.json();
      if (data.success) {
        await showAlert(data.message || `${data.deletedCount} fehlerhafte Quellen wurden gelöscht.`, 'Bereinigung abgeschlossen');
        fetchSources(typeFilter); // reload list
      } else {
        await showAlert(`Fehler: ${data.message || 'Unbekannter Fehler'}`, 'Fehler');
      }
    } catch (e: any) {
      console.error(e);
      await showAlert('Fehler bei der Datenbank-Bereinigung: ' + e.message, 'Fehler');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditUploading(true);
    try {
      // similar image logic as handleSave
      let imageUrl = '';
      if (editFile) {
        imageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const max_size = 512;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > max_size) { height *= max_size / width; width = max_size; }
              } else {
                if (height > max_size) { width *= max_size / height; height = max_size; }
              }
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              // Clear canvas for transparent PNGs
              ctx?.clearRect(0, 0, width, height);
              ctx?.drawImage(img, 0, 0, width, height);
              
              const format = editFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
              resolve(canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : undefined));
            };
            img.onerror = () => reject(new Error('Invalid image'));
            img.src = ev.target?.result as string;
          };
          reader.readAsDataURL(editFile);
        });
      }

      await addDoc(collection(db, 'publicSources'), {
        title: editingSource.title,
        url: editingSource.url,
        category: editingSource.category,
        type: editingSource.type,
        language: editingSource.language || 'de',
        imageUrl: imageUrl,
      });
      
      await fetchSources(typeFilter);
      
      setEditingSource(null);
      setIsAddingSource(false);
      setEditFile(null);
    } catch (err: any) {
      console.error(err);
      await showAlert('Fehler beim Hinzufügen der Quelle.', 'Fehler');
    } finally {
      setEditUploading(false);
    }
  };
    
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSource) return;
    setEditUploading(true);
    try {
      const docRef = doc(db, 'publicSources', editingSource.id);
      
      let newImageUrl = editingSource.imageUrl;
      if (editFile) {
        newImageUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const max_size = 512;
              let width = img.width;
              let height = img.height;
              if (width > height) {
                if (width > max_size) {
                  height *= max_size / width;
                  width = max_size;
                }
              } else {
                if (height > max_size) {
                  width *= max_size / height;
                  height = max_size;
                }
              }
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              // Clear canvas for transparent PNGs
              ctx?.clearRect(0, 0, width, height);
              ctx?.drawImage(img, 0, 0, width, height);
              
              const format = editFile.type === 'image/png' ? 'image/png' : 'image/jpeg';
              resolve(canvas.toDataURL(format, format === 'image/jpeg' ? 0.85 : undefined));
            };
            img.onerror = () => reject(new Error('Invalid image'));
            img.src = ev.target?.result as string;
          };
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(editFile);
        });
      }
      
      const updateData: any = {
        title: editingSource.title || '',
        url: editingSource.url || '',
        category: editingSource.category || '',
        type: editingSource.type || 'feeds',
        language: editingSource.language || 'de',
      };
      
      if (newImageUrl) {
        updateData.imageUrl = newImageUrl;
        if (editingSource.type === 'radio') {
          updateData.faviconUrl = newImageUrl;
        }
      }
      
      await updateDoc(docRef, updateData);
      
      setSources(sources.map(s => s.id === editingSource.id ? { ...s, ...updateData } : s));
      
      setEditingSource(null);
      setEditFile(null);
      await showAlert('Die Quelle wurde erfolgreich aktualisiert.', 'Erfolg');
    } catch (err: any) {
      console.error(err);
      await showAlert('Fehler beim Speichern der Quelle.', 'Fehler');
    } finally {
      setEditUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(
      'Möchtest du diese Quelle wirklich dauerhaft aus der globalen Datenbank löschen?',
      'Quelle löschen',
      'Löschen'
    );
    if (!confirmed) return;
    try {
      await deleteDoc(doc(db, 'publicSources', id));
      setSources(sources.filter(s => s.id !== id));
      await showAlert('Die Quelle wurde gelöscht.', 'Erfolg');
    } catch (e) {
      console.error(e);
      await showAlert('Fehler beim Löschen der Quelle.', 'Fehler');
    }
  };

  const filteredSources = sources.filter(s => {
    if (s.type !== typeFilter) return false;
    if (categoryFilter && s.category !== categoryFilter) return false;
    if (languageFilter && s.language !== languageFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const title = s.title?.toLowerCase() || '';
      const url = s.url?.toLowerCase() || '';
      const category = s.category?.toLowerCase() || '';
      return title.includes(q) || url.includes(q) || category.includes(q);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 p-6 md:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 p-6 md:p-8 flex items-center justify-center">
        <div className={`p-8 text-center rounded-2xl border max-w-md w-full ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'}`}>
          <h2 className={`text-xl font-bold mb-2 ${isDark ? 'text-red-400' : 'text-red-600'}`}>Zugriff verweigert</h2>
          <p className={isDark ? 'text-white/70' : 'text-gray-600'}>Dir fehlen die nötigen Administrator-Rechte, um diese Seite zu sehen.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 md:p-8 overflow-y-auto w-full h-full pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto">
        {alerts.length > 0 && (
          <div className="mb-8 p-6 rounded-2xl bg-red-500/10 border border-red-500/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 text-red-500 font-bold text-lg">
                <AlertTriangle className="w-6 h-6" />
                <h2>System Warnungen ({alerts.length})</h2>
              </div>
              <button 
                onClick={clearAlerts}
                className="text-sm bg-red-500/20 text-red-600 dark:text-red-400 font-bold px-3 py-1.5 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Alle Leeren
              </button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
              {alerts.map(alert => (
                <div key={alert.id} className={`p-3 rounded-lg text-sm border flex flex-col gap-1 ${isDark ? 'bg-black/20 border-white/5' : 'bg-white border-red-100'}`}>
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-bold text-red-600 dark:text-red-400">{alert.type.toUpperCase()}</span>
                    <span className={`text-xs ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                      {new Date(alert.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className={isDark ? 'text-white/80' : 'text-gray-700'}>{alert.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Webcam Reports Section */}
        {webcamReports.length > 0 && (
          <div className="mb-8 p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3 text-amber-500 font-bold text-lg">
                <Camera className="w-6 h-6" />
                <h2>Gemeldete Webcams ({webcamReports.length})</h2>
              </div>
              <button 
                onClick={async () => {
                  const confirmed = await showConfirm(
                    'Möchtest du alle eingegangenen Webcam-Meldungen verwerfen und zurücksetzen?',
                    'Alle Webcam-Meldungen verwerfen',
                    'Alle verwerfen'
                  );
                  if (confirmed) {
                    try {
                      for (const r of webcamReports) {
                        await deleteDoc(doc(db, 'webcamReports', r.id));
                      }
                      setWebcamReports([]);
                      await showAlert('Alle Meldungen wurden erfolgreich verworfen.', 'Erfolg');
                    } catch (e) {
                      console.error(e);
                    }
                  }
                }}
                className="text-sm bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold px-3 py-1.5 rounded-lg hover:bg-amber-500/30 transition-colors"
              >
                Alle verwerfen
              </button>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {webcamReports.map(report => (
                <div key={report.id} className={`p-4 rounded-2xl text-sm border flex flex-col justify-between gap-3 ${isDark ? 'bg-black/25 border-amber-500/10' : 'bg-amber-50/20 border-amber-200'}`}>
                  <div>
                    <div className="flex justify-between items-start gap-4 mb-2">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 capitalize truncate" style={{ maxWidth: '70%' }}>
                        {report.webcamTitle}
                      </span>
                      <span className={`text-[10px] font-mono shrink-0 ${isDark ? 'text-white/40' : 'text-gray-400'}`}>
                        {new Date(report.reportedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className={`text-xs select-all truncate ${isDark ? 'text-white/60' : 'text-gray-600'}`} title={report.webcamUrl}>
                      {report.webcamUrl}
                    </p>
                    <p className="text-[10px] opacity-40 mt-1">
                      Gemeldet von: {report.reportedBy}
                    </p>
                  </div>
                  
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => handleResolveReport(report.id, report.webcamId)}
                      className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-700 text-white transition-colors"
                    >
                      Meldung verwerfen
                    </button>
                    <button 
                      onClick={() => handleDeleteWebcamFromReport(report)}
                      className="py-1.5 px-3 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-700 text-white transition-colors animate-pulse hover:animate-none"
                    >
                      Cam entfernen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {typeFilter === 'news' ? (
          /* Announcement Editor Section */
          <div className={`mb-12 p-8 rounded-3xl border ${isDark ? 'bg-neutral-900/50 border-white/10' : 'bg-white border-gray-100 shadow-sm'}`}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Megaphone className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Neuigkeiten & Informationstafel</h2>
                <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Wird automatisch in alle Sprachen übersetzt</p>
              </div>
            </div>
            
            <div className="flex justify-center gap-2 mb-6">
              {(['de', 'en', 'fr', 'es'] as const).map(lang => (
                <button 
                  key={lang}
                  onClick={() => handleLangChange(lang)}
                  className={`px-4 py-2 rounded-lg font-bold transition-all border ${
                    activeLang === lang 
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20' 
                      : `border-transparent ${isDark ? 'bg-neutral-800 text-white/50 hover:bg-neutral-700' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Editor & Actions */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className={`w-full rounded-[2.5rem] flex flex-col shadow-2xl border ${
                  isDark 
                    ? 'bg-neutral-900 border-white/10 text-white' 
                    : 'bg-white border-gray-100 text-gray-900 shadow-xl shadow-gray-200/50'
                } overflow-hidden transition-all duration-300`}>
                  {/* Mock Modal Header */}
                  <div className="flex justify-between items-center p-8 pb-4 border-b border-gray-100 dark:border-white/5 select-none pointer-events-none">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center">
                        <Megaphone className="w-6 h-6 text-orange-500" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black uppercase tracking-tight">Neuigkeiten & Updates</h2>
                        <p className="text-xs opacity-50 font-bold uppercase tracking-widest">Was gibt's neues bei RSSer?</p>
                      </div>
                    </div>
                    <div className="p-3 bg-black/5 dark:bg-white/5 rounded-full opacity-30">
                      <X className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Rich Text Editor Menu Bar */}
                  <div className={`px-6 py-2 border-b ${isDark ? 'border-white/5 bg-neutral-950/20' : 'border-gray-100 bg-gray-50/50'}`}>
                    <AdminMenuBar editor={editor} />
                  </div>

                  {/* Simulated Date Badge */}
                  <div className="px-8 pt-6 select-none pointer-events-none flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-500">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {new Date().toLocaleDateString(activeLang === 'de' ? 'de-DE' : 'en-US', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  {/* Editor Area */}
                  <div className="flex-1 min-h-[300px]">
                    <EditorContent editor={editor} />
                  </div>
                </div>

                {/* Editor Actions Row */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={handleTestAI}
                      disabled={isTestingAI}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                        isDark ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      } disabled:opacity-50`}
                    >
                      {isTestingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      Gemini API testen
                    </button>
                    {testResult && (
                      <div className={`mt-2 p-3 rounded-xl text-xs max-w-md ${
                        testResult.success 
                          ? (isDark ? 'bg-green-500/10 text-green-400' : 'bg-green-50 text-green-700') 
                          : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-700')
                      }`}>
                        <p className="font-bold">{testResult.message}</p>
                        {!testResult.success && (testResult.message.includes("403") || testResult.message.includes("verweigert")) && (
                          <div className="mt-2 pt-2 border-t border-red-500/20">
                            <p className="mb-2"><strong>Wichtig:</strong> Ein 403-Fehler bedeutet oft, dass die API-Einschränkungen in der Google Cloud Console den Zugriff verhindern.</p>
                            <ul className="list-disc ml-4 space-y-1 mb-2">
                              <li>Prüfe, ob die <strong>Generative Language API</strong> aktiviert ist.</li>
                              <li>Falls der Key eingeschränkt ist, muss <strong>Generative Language API</strong> (nicht nur "Gemini API") erlaubt sein.</li>
                            </ul>
                            <a 
                              href="https://aistudio.google.com/app/apikey" 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-500 hover:underline font-bold"
                            >
                              <RefreshCw className="w-3 h-3" /> Neuen AI Studio Key erstellen
                            </a>
                            <p className="mt-1 opacity-70">AI Studio Keys haben standardmäßig keine Einschränkungen.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <button
                    onClick={handlePublishAnnouncement}
                    disabled={isPublishingAnnouncement}
                    className={`flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-all active:scale-[0.98] disabled:opacity-50 shrink-0`}
                  >
                    {isPublishingAnnouncement ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        ANKÜNDIGUNG VERÖFFENTLICHEN
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right Column: Announcement History */}
              <div className="lg:col-span-5 h-full">
                <div className={`p-6 rounded-[2rem] border ${
                  isDark ? 'bg-neutral-900 border-white/10' : 'bg-white border-gray-100 shadow-xl shadow-gray-200/50'
                } flex flex-col h-full`}>
                  <h3 className="text-sm font-black uppercase tracking-widest mb-6 opacity-50 px-2 flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-orange-500" />
                    Bisherige Ankündigungen
                  </h3>
                  
                  {announcements.length > 0 ? (
                    <div className="space-y-4 max-h-[580px] overflow-y-auto pr-2 scrollbar-thin">
                      {announcements.map((ann) => (
                        <div key={ann.id} className={`p-4 rounded-xl border flex justify-between items-start gap-4 transition-all hover:scale-[1.01] ${
                          isDark ? 'bg-white/5 border-white/5 hover:border-white/10' : 'bg-gray-50 border-gray-100 hover:border-gray-200 shadow-sm'
                        }`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-orange-500 mb-1">
                              {new Date(ann.createdAt?.seconds * 1000).toLocaleDateString('de-DE')}
                            </div>
                            <div 
                              className="text-sm line-clamp-3 opacity-70 prose prose-sm max-w-none dark:prose-invert font-medium leading-relaxed"
                              dangerouslySetInnerHTML={{ __html: ann.content.de }}
                            />
                          </div>
                          <div className="flex gap-1 shrink-0">
                            <button 
                              onClick={() => handleRetranslate(ann)}
                              className="p-2 hover:bg-orange-500/10 hover:text-orange-500 rounded-lg transition-colors"
                              title="Neu übersetzen"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteAnnouncement(ann.id)}
                              className="p-2 hover:bg-red-500/10 hover:text-red-500 rounded-lg transition-colors"
                              title="Löschen"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center opacity-40">
                      <Megaphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p className="text-sm font-bold">Noch keine Ankündigungen veröffentlicht.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <h1 className="text-2xl font-bold">Globale Datenbank Verwaltung</h1>
              <div className="flex flex-wrap gap-3">
                <button 
                  onClick={handleCleanupSources}
                  disabled={isCleaning}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-500/20 rounded-xl font-bold transition-colors disabled:opacity-50"
                >
                  {isCleaning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  DB Aufräumen
                </button>
                <button 
                  onClick={() => { setIsAddingSource(true); setEditingSource({ type: typeFilter }); }}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold transition-colors"
                >
                  Neue Quelle hinzufügen
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-6 mb-6 mt-2">
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <div className="relative flex-1">
                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 ${isDark ? 'text-white/40' : 'text-gray-400'}`} />
                  <input 
                    type="text"
                    placeholder="Suchen nach Titel, URL..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={`w-full pl-12 pr-4 py-3 rounded-xl border ${isDark ? 'bg-neutral-900 border-white/10 focus:border-orange-500' : 'bg-white border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                  />
                </div>
                
                <div className="flex gap-4">
                  <div className="relative">
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className={`pl-4 pr-10 py-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:border-orange-500 outline-none transition-colors min-w-[160px]`}
                    >
                      <option value="">Alle Kategorien</option>
                      {(typeFilter === 'radio' ? ['Pop', '60s', '70s', '80s', '90s', 'Game Music', 'Black', 'Rock', 'Heavy Metal', 'Relax', 'KPop', 'Nachrichten', 'Klassik', 'Dance / Electronic', 'Hip Hop', 'Jazz', 'Country', 'Volksmusik', 'Rap', 'Schlager', 'Techno'] : FEED_CATEGORIES).map(cat => (
                        <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                      ))}
                    </select>
                    <Filter className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50`} />
                  </div>

                  <div className="relative">
                    <select
                      value={languageFilter}
                      onChange={e => setLanguageFilter(e.target.value)}
                      className={`pl-4 pr-10 py-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-900 border-white/10 text-white' : 'bg-white border-gray-200 text-gray-900'} focus:border-orange-500 outline-none transition-colors min-w-[120px]`}
                    >
                      <option value="">Alle Sprachen</option>
                      <option value="de">Deutsch</option>
                      <option value="en">English</option>
                      <option value="fr">Français</option>
                      <option value="es">Español</option>
                    </select>
                    <Globe className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none opacity-50`} />
                  </div>
                </div>
              </div>
            </div>

            <div className="mb-4 font-medium text-sm text-gray-500">
              {filteredSources.length} Einträge gefunden
            </div>

            <div className={`grid gap-4 ${
              typeFilter === 'podcasts' || typeFilter === 'radio'
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
                : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }`}>
              {filteredSources.map((source) => {
                const domain = source.url ? (new URL(source.url).hostname.replace('www.', '')) : '';
                let ytThumbnail = null;
                if (source.url) {
                  const match = source.url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
                  if (match && match[1]) ytThumbnail = `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
                }
                const fallbackImage = source.imageUrl || ytThumbnail || (domain && source.type !== 'youtube' ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null);
                const displayImage = fallbackImage;
                
                if (source.type === 'podcasts' || source.type === 'radio') {
                  return (
                    <div key={source.id} className={`group flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-1 relative ${
                      isDark ? 'border-white/10 bg-neutral-900/50' : 'border-gray-200 bg-white'
                    }`}>
                      <div className="absolute top-2 right-2 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingSource(source)} className={`p-1.5 rounded-full ${isDark ? 'bg-black/40 hover:bg-black/60 text-white/70 hover:text-white' : 'bg-white/80 hover:bg-white text-gray-500 hover:text-black'} backdrop-blur-sm transition-all`} title="Bearbeiten">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(source.id)} className={`p-1.5 rounded-full ${isDark ? 'bg-black/40 hover:bg-black/60 text-white/70 hover:text-red-400' : 'bg-white/80 hover:bg-white text-gray-500 hover:text-red-500'} backdrop-blur-sm transition-all`} title="Löschen">
                          ✕
                        </button>
                      </div>
                      <div className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setPlayingAudio({ title: source.title || 'Preview', url: source.url, feedTitle: source.title || 'Preview', imageUrl: displayImage })} className={`p-1.5 rounded-full ${isDark ? 'bg-black/40 hover:bg-black/60 text-white/70 hover:text-orange-400' : 'bg-white/80 hover:bg-white text-gray-500 hover:text-orange-500'} backdrop-blur-sm transition-all`} title="Vorschau abspielen">
                          <Play className="w-4 h-4 ml-0.5" />
                        </button>
                      </div>
                      
                      <div className="relative aspect-square w-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                        {displayImage ? (
                          <img 
                            src={displayImage} 
                            alt="" 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                            onError={(e) => { 
                              const currentSrc = e.currentTarget.src;
                              if (currentSrc.includes('hqdefault.jpg')) {
                                e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
                              } else if (currentSrc.includes('mqdefault.jpg')) {
                                e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg');
                              } else {
                                e.currentTarget.style.display = 'none';
                                const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                                if (sibling) sibling.style.display = 'flex';
                              }
                            }} 
                          />
                        ) : null}
                        <div className="w-full h-full flex items-center justify-center font-bold text-2xl uppercase bg-orange-500/10 dark:bg-orange-500/5 text-orange-500" style={{ display: displayImage ? 'none' : 'flex' }}>
                           {source.title?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity" />
                      </div>
                      <div className="p-4 flex flex-col flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${source.type === 'radio' ? 'text-blue-500 dark:text-blue-400' : 'text-purple-600 dark:text-purple-400'}`}>{source.category}</span>
                        </div>
                        <h3 className="font-bold text-[15px] leading-tight mb-1 line-clamp-2">{source.title || 'Ohne Titel'}</h3>
                        <p className={`text-[11px] opacity-60 line-clamp-1 mt-auto`}>{domain || source.url}</p>
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={source.id} className={`flex items-center gap-4 p-4 rounded-xl border ${isDark ? 'border-white/10 bg-neutral-900' : 'border-gray-200 bg-white'}`}>
                    {source.imageUrl || ytThumbnail || fallbackImage ? (
                      <img 
                        src={source.imageUrl || ytThumbnail || fallbackImage || undefined} 
                        alt="" 
                        className="w-12 h-12 rounded-lg bg-black/5 object-cover shrink-0" 
                        onError={(e) => { 
                          const currentSrc = e.currentTarget.src;
                          if (currentSrc.includes('hqdefault.jpg')) {
                            e.currentTarget.src = currentSrc.replace('hqdefault.jpg', 'mqdefault.jpg');
                          } else if (currentSrc.includes('mqdefault.jpg')) {
                            e.currentTarget.src = currentSrc.replace('mqdefault.jpg', 'default.jpg');
                          } else {
                            e.currentTarget.style.display = 'none';
                            const sibling = e.currentTarget.nextElementSibling as HTMLElement;
                            if (sibling) sibling.style.display = 'flex';
                          }
                        }} 
                        referrerPolicy="no-referrer" 
                      />
                    ) : null}
                    {(!source.imageUrl && !ytThumbnail && !fallbackImage) ? (
                      <div className="w-12 h-12 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center shrink-0">
                        {source.type === 'youtube' ? <Youtube className="w-6 h-6 text-red-500" /> : source.type === 'podcasts' ? <Podcast className="w-6 h-6 text-purple-500" /> : source.type === 'radio' ? <Radio className="w-6 h-6 text-blue-500" /> : source.type === 'webcams' ? <Camera className="w-6 h-6 text-emerald-500" /> : source.type === 'blogs' ? <FileText className="w-6 h-6 text-yellow-500" /> : <Rss className="w-6 h-6 text-orange-500" />}
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center font-bold text-lg uppercase shrink-0 text-orange-500" style={{ display: 'none' }}>
                        {source.title?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-white/50' : 'text-gray-500'}`}>{source.category || source.type}</span>
                      </div>
                      <h3 className="font-bold text-sm truncate">{source.title || 'Ohne Titel'}</h3>
                      <p className={`text-xs truncate ${isDark ? 'text-white/40' : 'text-gray-400'}`}>{domain || source.url}</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => setEditingSource(source)} className={`p-2 rounded-lg text-gray-500 hover:bg-black/5 dark:hover:bg-white/5 transition-colors bg-black/5 dark:bg-white/5 shrink-0`} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Bearbeiten">
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(source.id)} className={`p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-colors bg-black/5 dark:bg-white/5 shrink-0`} style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Löschen">
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {editingSource && createPortal(
        <div className="fixed inset-0 z-[99999] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto" onClick={() => { setEditingSource(null); setEditFile(null); setIsAddingSource(false); }}>
          <div 
            onClick={e => e.stopPropagation()} 
            className={`relative w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl ${isDark ? 'bg-neutral-900 border border-white/10 text-white' : 'bg-white text-gray-900'} my-auto`}
          >
            {editingSource.type === 'radio' ? (
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">
                    {isAddingSource 
                      ? tr(settings.language, 'Add Radio Station', 'Radiosender hinzufügen') 
                      : tr(settings.language, 'Edit Radio Station', 'Radiosender bearbeiten')
                    }
                  </h2>
                  <button onClick={() => { setEditingSource(null); setEditFile(null); setIsAddingSource(false); }} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <form onSubmit={isAddingSource ? handleAddSource : handleSave} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Titel</label>
                    <input 
                      type="text" 
                      value={editingSource.title || ''} 
                      onChange={e => setEditingSource({...editingSource, title: e.target.value})}
                      className={`w-full p-3 rounded-xl border ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={editingSource.url || ''} 
                        onChange={e => setEditingSource({...editingSource, url: e.target.value})}
                        className={`w-full p-3 rounded-xl border flex-1 ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                        required
                      />
                      {editingSource.url && (
                        <button
                          type="button"
                          onClick={() => setPlayingAudio({ title: editingSource.title || 'Preview', url: editingSource.url, feedTitle: editingSource.title || 'Preview', imageUrl: editingSource.imageUrl || null })}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
                        >
                          <Play className="w-5 h-5 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Genre
                    </label>
                    <select
                      value={editingSource.category || ''}
                      onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                      className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                    >
                      <option value="">{tr(settings.language, 'Please select...', 'Auswählen...')}</option>
                      <option value="Pop">Pop</option>
                      <option value="60s">60s</option>
                      <option value="70s">70s</option>
                      <option value="80s">80s</option>
                      <option value="90s">90s</option>
                      <option value="Game Music">Game Music</option>
                      <option value="Black">Black</option>
                      <option value="Rock">Rock</option>
                      <option value="Heavy Metal">Heavy Metal</option>
                      <option value="Relax">Relax</option>
                      <option value="KPop">KPop</option>
                      <option value="Nachrichten">{t('cat-Nachrichten', 'Nachrichten')}</option>
                      <option value="Klassik">{t('cat-Klassik', 'Klassik')}</option>
                      <option value="Dance / Electronic">Dance / Electronic</option>
                      <option value="Hip Hop">Hip Hop</option>
                      <option value="Jazz">Jazz</option>
                      <option value="Country">Country</option>
                      <option value="Volksmusik">{t('cat-Volksmusik', 'Volksmusik')}</option>
                      <option value="Rap">Rap</option>
                      <option value="Schlager">{t('cat-Schlager', 'Schlager')}</option>
                      <option value="Techno">Techno</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      {tr(settings.language, 'Language', 'Sprache')}
                    </label>
                    <select
                      value={editingSource.language || 'de'}
                      onChange={e => setEditingSource({...editingSource, language: e.target.value})}
                      className={`w-full p-3 rounded-xl border appearance-none ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-colors outline-none`}
                    >
                      <option value="de">🇩🇪 Deutsch</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="fr">🇫🇷 Français</option>
                      <option value="es">🇪🇸 Español</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Icon / Logo</label>
                    <div className="flex items-center gap-4">
                      {(editFile || editingSource.imageUrl) && (
                        <img src={editFile ? URL.createObjectURL(editFile) : editingSource.imageUrl} 
                          alt="" 
                          className="w-12 h-12 rounded-lg object-cover bg-black/5 dark:bg-white/5 border border-white/10 shadow-md" referrerPolicy="no-referrer" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        id="edit-upload"
                        className="hidden"
                        onChange={e => e.target.files && setEditFile(e.target.files[0])}
                      />
                      <label 
                        htmlFor="edit-upload"
                        className={`px-4 py-2 cursor-pointer flex items-center gap-2 rounded-lg font-medium transition-colors ${isDark ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        <Upload className="w-4 h-4" />
                        Neues Bild hochladen
                      </label>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit" 
                      disabled={editUploading}
                      className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {editUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Speichern'}
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className="flex justify-between items-center mb-8">
                  <h2 className="text-3xl font-black uppercase tracking-tight">{isAddingSource ? 'Neuer Eintrag' : 'Bearbeiten'}</h2>
                  <button 
                    onClick={() => { setEditingSource(null); setEditFile(null); setIsAddingSource(false); }} 
                    className="p-2.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors"
                    aria-label="Close"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                
                <form onSubmit={isAddingSource ? handleAddSource : handleSave} className="space-y-6">
                  {editingSource.type !== 'radio' && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Typ</label>
                      <div className="relative">
                        <select 
                          value={editingSource.type || 'feeds'} 
                          onChange={e => setEditingSource({...editingSource, type: e.target.value})}
                          className={`w-full p-4 rounded-2xl border appearance-none font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                        >
                          <option value="feeds">RSS Feeds</option>
                          <option value="youtube">YouTube</option>
                          <option value="podcasts">Podcasts</option>
                          <option value="webcams">Webcams</option>
                          <option value="blogs">Blogs</option>
                        </select>
                        <Settings className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Titel</label>
                    <input 
                      type="text" 
                      value={editingSource.title || ''} 
                      onChange={e => setEditingSource({...editingSource, title: e.target.value})}
                      className={`w-full p-4 rounded-2xl border font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                      placeholder="Quellen Titel..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">URL</label>
                    <div className="flex gap-2">
                      <input 
                        type="url" 
                        value={editingSource.url || ''} 
                        onChange={e => setEditingSource({...editingSource, url: e.target.value})}
                        className={`w-full p-4 rounded-2xl border font-bold flex-1 ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                        placeholder="https://..."
                        required
                      />
                      {(editingSource.type === 'radio' || editingSource.type === 'podcasts') && editingSource.url && (
                        <button
                          type="button"
                          onClick={() => setPlayingAudio({ title: editingSource.title || 'Preview', url: editingSource.url, feedTitle: editingSource.title || 'Preview', imageUrl: editingSource.imageUrl || null })}
                          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all active:scale-95 ${isDark ? 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'}`}
                        >
                          <Play className="w-6 h-6 fill-current" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Sprache</label>
                      <div className="relative">
                        <select 
                          value={editingSource.language || 'de'} 
                          onChange={e => setEditingSource({...editingSource, language: e.target.value})}
                          className={`w-full p-4 rounded-2xl border appearance-none font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                        >
                          <option value="de">Deutsch</option>
                          <option value="en">English</option>
                          <option value="fr">Français</option>
                          <option value="es">Español</option>
                        </select>
                        <Globe className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">
                        {editingSource.type === 'radio' ? 'Genre' : 'Kategorie'}
                      </label>
                      <div className="relative">
                        {editingSource.type === 'radio' ? (
                          <select
                            value={editingSource.category || ''}
                            onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                            className={`w-full p-4 rounded-2xl border appearance-none font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                          >
                            <option value="">Auswählen...</option>
                            {['Pop', '60s', '70s', '80s', '90s', 'Game Music', 'Black', 'Rock', 'Heavy Metal', 'Relax', 'KPop', 'Nachrichten', 'Klassik', 'Dance / Electronic', 'Hip Hop', 'Jazz', 'Country', 'Volksmusik', 'Rap', 'Schlager', 'Techno'].map(g => (
                              <option key={g} value={g}>{g === 'Nachrichten' ? t('cat-Nachrichten', 'Nachrichten') : g === 'Klassik' ? t('cat-Klassik', 'Klassik') : g === 'Volksmusik' ? t('cat-Volksmusik', 'Volksmusik') : g === 'Schlager' ? t('cat-Schlager', 'Schlager') : g}</option>
                            ))}
                          </select>
                        ) : editingSource.type === 'webcams' ? (
                          <select
                            value={editingSource.category || ''}
                            onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                            className={`w-full p-4 rounded-2xl border appearance-none font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                          >
                            <option value="WebCam">Allgemein</option>
                            <option value="Tiere">Tiere</option>
                            <option value="Reisen">Reisen</option>
                            <option value="Stadt">Stadt</option>
                          </select>
                        ) : (
                          <select 
                            value={editingSource.category || ''} 
                            onChange={e => setEditingSource({...editingSource, category: e.target.value})}
                            className={`w-full p-4 rounded-2xl border appearance-none font-bold ${isDark ? 'bg-neutral-800 border-white/10 focus:border-orange-500' : 'bg-gray-50 border-gray-200 focus:border-orange-500'} transition-all outline-none`}
                          >
                            <option value="" disabled>Wählen...</option>
                            {FEED_CATEGORIES.map(cat => (
                              <option key={cat} value={cat}>{t('cat-' + cat, cat)}</option>
                            ))}
                          </select>
                        )}
                        <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-30 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2 ml-1">Icon / Logo</label>
                    <div className="flex items-center gap-4">
                      {(editFile || editingSource.imageUrl) && (
                        <img src={editFile ? URL.createObjectURL(editFile) : editingSource.imageUrl} 
                          alt="" 
                          className="w-16 h-16 rounded-2xl object-cover bg-black/5 dark:bg-white/5 border border-white/10 shadow-lg" referrerPolicy="no-referrer" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*"
                        id="edit-upload"
                        className="hidden"
                        onChange={e => e.target.files && setEditFile(e.target.files[0])}
                      />
                      <label 
                        htmlFor="edit-upload"
                        className={`flex-1 h-16 cursor-pointer flex items-center justify-center gap-3 rounded-2xl font-bold transition-all ${isDark ? 'bg-white/5 hover:bg-white/10 border border-white/10' : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600'}`}
                      >
                        <Upload className="w-5 h-5" />
                        BILD WÄHLEN
                      </label>
                    </div>
                  </div>

                  <div className="pt-4">
                    <button 
                      type="submit" 
                      disabled={editUploading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-black uppercase tracking-[0.2em] py-5 rounded-2xl transition-all shadow-xl shadow-orange-600/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
                    >
                      {editUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                        <>
                          <CheckCheck className="w-6 h-6" />
                          ÜBERNEHMEN
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
