// Subscriber registry for real-time reactivity in onSnapshot
const snapshotListeners = new Set<{
  targetPath: string; // collection base path or specific doc path
  isCollection: boolean;
  callback: (snapshot: any) => void;
}>();

// Helper to load/save the mock DB
function getDBData(): Record<string, any> {
  try {
    const raw = localStorage.getItem('mock_db');
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveDBData(data: Record<string, any>) {
  try {
    localStorage.setItem('mock_db', JSON.stringify(data));
  } catch (e) {}
  
  // Trigger subscribers
  notifyListeners();
}

function notifyListeners() {
  const data = getDBData();
  snapshotListeners.forEach(listener => {
    if (listener.isCollection) {
      // Collection callback
      const docs = Object.keys(data)
        .filter(path => {
          // Check if path starts with targetPath, e.g. "users/uid/feeds/feedId" starts with "users/uid/feeds"
          // and has exactly one extra segment (the document ID)
          const subPath = path.substring(listener.targetPath.length + 1);
          return path.startsWith(listener.targetPath + '/') && !subPath.includes('/');
        })
        .map(path => {
          const docId = path.split('/').pop() || '';
          return {
            id: docId,
            exists: () => true,
            data: () => data[path]
          };
        });
      
      listener.callback({
        empty: docs.length === 0,
        docs,
        forEach: (cb: any) => docs.forEach(cb)
      });
    } else {
      // Document callback
      const docData = data[listener.targetPath];
      listener.callback({
        id: listener.targetPath.split('/').pop() || '',
        exists: () => docData !== undefined,
        data: () => docData || null
      });
    }
  });
}

// Interfaces and Classes
export class Firestore {
  firestoreDatabaseId?: string;
  constructor(app: any, databaseId?: string) {
    this.firestoreDatabaseId = databaseId;
  }
}

export const getFirestore = (app: any, databaseId?: string) => {
  return new Firestore(app, databaseId);
};

export const initializeFirestore = (app: any, settings?: any, databaseId?: string) => {
  return new Firestore(app, databaseId);
};

export class CollectionReference {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class DocumentReference {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export class Query {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

// collection function
export function collection(db: any, ...segments: string[]): CollectionReference {
  const path = segments.filter(Boolean).map(s => typeof s === 'object' ? (s as any).path : s).join('/');
  return new CollectionReference(path);
}

// doc function
export function doc(parent: any, ...segments: string[]): DocumentReference {
  let basePath = '';
  if (parent instanceof CollectionReference || parent instanceof DocumentReference) {
    basePath = parent.path;
  }
  const cleanSegments = segments.filter(Boolean).map(s => typeof s === 'object' ? (s as any).path : s);
  const path = [basePath, ...cleanSegments].filter(Boolean).join('/');
  return new DocumentReference(path);
}

export function query(ref: any, ...constraints: any[]): Query {
  return new Query(ref.path);
}

export function where(field: string, op: string, val: any) {
  return { type: 'where', field, op, val };
}

export function orderBy(field: string, direction?: string) {
  return { type: 'orderBy', field, direction };
}

export function limit(num: number) {
  return { type: 'limit', num };
}

// Firestore writes
export async function setDoc(docRef: DocumentReference, data: any, options?: { merge?: boolean }) {
  const dbData = getDBData();
  const path = docRef.path;
  if (options?.merge && dbData[path]) {
    dbData[path] = { ...dbData[path], ...data };
  } else {
    dbData[path] = { ...data, id: path.split('/').pop() };
  }
  saveDBData(dbData);
}

export async function addDoc(colRef: CollectionReference, data: any) {
  const dbData = getDBData();
  const id = 'mock_id_' + Math.random().toString(36).substring(2, 12);
  const path = `${colRef.path}/${id}`;
  dbData[path] = { ...data, id };
  saveDBData(dbData);
  return new DocumentReference(path);
}

export async function updateDoc(docRef: DocumentReference, data: any) {
  const dbData = getDBData();
  const path = docRef.path;
  dbData[path] = { ...dbData[path], ...data };
  saveDBData(dbData);
}

export async function deleteDoc(docRef: DocumentReference) {
  const dbData = getDBData();
  const path = docRef.path;
  delete dbData[path];
  saveDBData(dbData);
}

// Firestore reads
export async function getDoc(docRef: DocumentReference) {
  const dbData = getDBData();
  const path = docRef.path;
  const docData = dbData[path];
  return {
    id: path.split('/').pop() || '',
    exists: () => docData !== undefined,
    data: () => docData || null
  };
}

export async function getDocFromServer(docRef: DocumentReference) {
  return getDoc(docRef);
}

export async function getDocs(q: any) {
  const dbData = getDBData();
  const targetPath = q.path;
  const docs = Object.keys(dbData)
    .filter(path => {
      const subPath = path.substring(targetPath.length + 1);
      return path.startsWith(targetPath + '/') && !subPath.includes('/');
    })
    .map(path => {
      const docId = path.split('/').pop() || '';
      return {
        id: docId,
        exists: () => true,
        data: () => dbData[path]
      };
    });
  
  return {
    empty: docs.length === 0,
    docs,
    forEach: (cb: any) => docs.forEach(cb)
  };
}

export async function getDocsFromServer(q: any) {
  return getDocs(q);
}

export class Timestamp {
  seconds: number;
  nanoseconds: number;
  constructor(seconds: number, nanoseconds: number) {
    this.seconds = seconds;
    this.nanoseconds = nanoseconds;
  }
  static now() {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  static fromDate(date: Date) {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6);
  }
  toDate() {
    return new Date(this.seconds * 1000 + this.nanoseconds / 1e6);
  }
}

export function serverTimestamp() {
  return Timestamp.now();
}

// onSnapshot
export function onSnapshot(ref: any, onNext: any, onError?: any) {
  const targetPath = ref.path;
  const isCollection = ref instanceof CollectionReference || ref instanceof Query;
  
  const listener = {
    targetPath,
    isCollection,
    callback: onNext
  };
  
  snapshotListeners.add(listener);
  
  // Trigger initial snapshot immediately
  setTimeout(() => {
    const data = getDBData();
    if (isCollection) {
      const docs = Object.keys(data)
        .filter(path => {
          const subPath = path.substring(targetPath.length + 1);
          return path.startsWith(targetPath + '/') && !subPath.includes('/');
        })
        .map(path => {
          const docId = path.split('/').pop() || '';
          return {
            id: docId,
            exists: () => true,
            data: () => data[path]
          };
        });
      onNext({
        empty: docs.length === 0,
        docs,
        forEach: (cb: any) => docs.forEach(cb)
      });
    } else {
      const docData = data[targetPath];
      onNext({
        id: targetPath.split('/').pop() || '',
        exists: () => docData !== undefined,
        data: () => docData || null
      });
    }
  }, 0);
  
  return () => {
    snapshotListeners.delete(listener);
  };
}
