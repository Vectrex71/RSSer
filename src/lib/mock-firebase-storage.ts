export class Storage {
  app: any;
  bucket?: string;
  constructor(app: any, bucket?: string) {
    this.app = app;
    this.bucket = bucket;
  }
}

export const getStorage = (app: any, bucket?: string) => {
  return new Storage(app, bucket);
};

export class StorageReference {
  path: string;
  constructor(path: string) {
    this.path = path;
  }
}

export function ref(storage: any, path: string): StorageReference {
  return new StorageReference(path);
}

export async function uploadBytes(ref: StorageReference, data: Blob | Uint8Array | ArrayBuffer) {
  console.log(`Uploaded mock file to ${ref.path}`);
  return {
    ref,
    metadata: {
      fullPath: ref.path,
      name: ref.path.split('/').pop() || ''
    }
  };
}

export async function getDownloadURL(ref: StorageReference) {
  return `https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop`;
}
