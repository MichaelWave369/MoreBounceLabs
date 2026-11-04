/**
 * Freestyle Dojo recordings are stored only in this origin's IndexedDB.
 * This database is independent of the versioned JSON Freestyle Book backup.
 */
const DB_NAME = "mbl-freestyle-dojo-v1";
const STORE = "clips";
export const MAX_CLIP_BYTES = 32 * 1024 * 1024;
export const MAX_CLIPS_PER_PAGE = 12;
export const MAX_RECORD_SECONDS = 180;

export type DojoClip = {
  id: string;
  pageId: string;
  title: string;
  createdAt: string;
  bpm: number;
  bars: number;
  mimeType: string;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("pageId", "pageId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open recording storage."));
    request.onblocked = () => reject(new Error("Recording storage is blocked by another open tab."));
  });
}

export async function listDojoClips(pageId: string): Promise<DojoClip[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).index("pageId").getAll(pageId);
    let clips: DojoClip[] = [];
    request.onsuccess = () => { clips = request.result as DojoClip[]; };
    tx.oncomplete = () => {
      db.close();
      resolve(clips.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not read saved recordings.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Recording read aborted.")); };
  });
}

export async function saveDojoClip(clip: DojoClip): Promise<void> {
  if (!clip.pageId || !clip.id || !(clip.blob instanceof Blob) ||
      !clip.blob.size || clip.blob.size > MAX_CLIP_BYTES) {
    throw new Error("Recording is empty, oversized, or missing a lyric page.");
  }
  const existing = await listDojoClips(clip.pageId);
  if (existing.length >= MAX_CLIPS_PER_PAGE) {
    throw new Error("This page already has 12 recordings. Export or remove one before saving more.");
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add(clip);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Recording storage failed.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Recording storage quota exceeded.")); };
  });
}

export async function deleteDojoClip(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not delete the recording.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Recording deletion aborted.")); };
  });
}
