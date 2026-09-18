import { collection, getDocs, addDoc, query, where, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { DEFAULT_SOURCES } from './defaultSourcesData';

export { DEFAULT_SOURCES };

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

