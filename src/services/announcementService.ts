import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import { collection, addDoc, query, orderBy, Timestamp, limit, getDocsFromServer, updateDoc, doc } from "firebase/firestore";
import { translateContent } from "./geminiService";

export interface Announcement {
  id: string;
  content: {
    de: string;
    en: string;
    fr: string;
    es: string;
    [key: string]: string;
  };
  createdAt: any;
}

export const fetchAnnouncements = async (): Promise<Announcement[]> => {
  const path = 'announcements';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'));
    const snap = await getDocsFromServer(q);
    return snap.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    } as Announcement));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const fetchLatestAnnouncement = async (): Promise<Announcement | null> => {
  const path = 'announcements';
  try {
    const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(1));
    const snap = await getDocsFromServer(q);
    if (snap.empty) return null;
    return { id: snap.docs[0].id, ...snap.docs[0].data() } as Announcement;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const createAnnouncement = async (content: { de: string, en: string, fr: string, es: string }): Promise<void> => {
  const path = 'announcements';
  
  try {
    const announcementData = {
      content,
      createdAt: Timestamp.now()
    };

    await addDoc(collection(db, path), announcementData);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const retranslateAnnouncement = async (id: string, germanContent: string): Promise<void> => {
  const path = 'announcements';
  try {
    const translations = await translateContent(germanContent, ['en', 'fr', 'es']);
    
    await updateDoc(doc(db, path, id), {
      content: {
        de: germanContent,
        en: translations.en || germanContent,
        fr: translations.fr || germanContent,
        es: translations.es || germanContent
      }
    });
  } catch (error) {
    console.error("Retranslation failed:", error);
    throw error;
  }
};
