/**
 * Freestyle Dojo recordings are stored only in this origin's IndexedDB.
 * This database is independent of the versioned JSON Freestyle Book backup.
 */
const DB_NAME = "mbl-freestyle-dojo-v1";
const DB_VERSION = 2;
const STORE = "clips";
const BAR_STORE = "bar-samples";
export const MAX_BAR_SAMPLES_PER_PAGE = 24;
export const MAX_BAR_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_BAR_TEXT = 300;
export const BAR_AUDIO_SECONDS = 12;
export const MAX_BAR_REVIEW_NOTE = 600;

export type BarReview = {
  note: string;
  rating: number;
  keeper: boolean;
};

export function validateBarReview(review: BarReview): BarReview {
  const note = review?.note;
  const rating = review?.rating;
  const keeper = review?.keeper;
  if (typeof note !== "string" || note.length > MAX_BAR_REVIEW_NOTE ||
      !Number.isInteger(rating) || rating < 0 || rating > 5 ||
      typeof keeper !== "boolean") {
    throw new Error("Review must have a note of at most 600 characters, a 0–5 rating, and a keeper choice.");
  }
  return { note, rating, keeper };
}
export type BarSample = {
  id: string;
  pageId: string;
  text: string;
  createdAt: string;
  mimeType: string;
  audio?: Blob;
  reviewNote?: string;
  rating?: number;
  keeper?: boolean;
};
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
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("pageId", "pageId", { unique: false });
      }
      if (!db.objectStoreNames.contains(BAR_STORE)) {
        const samples = db.createObjectStore(BAR_STORE, { keyPath: "id" });
        samples.createIndex("pageId", "pageId", { unique: false });
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


/** All samples remain browser-local; old full-length takes in clips store are untouched. */
export async function listBarSamples(pageId: string): Promise<BarSample[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BAR_STORE, "readonly");
    const request = tx.objectStore(BAR_STORE).index("pageId").getAll(pageId);
    let samples: BarSample[] = [];
    request.onsuccess = () => { samples = request.result as BarSample[]; };
    tx.oncomplete = () => { db.close(); resolve(samples.sort((a, b) => b.createdAt.localeCompare(a.createdAt))); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not load saved bars.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Bar read aborted.")); };
  });
}

export async function saveBarSample(sample: BarSample): Promise<void> {
  if (!sample.id || !sample.pageId || !sample.text.trim() || sample.text.length > MAX_BAR_TEXT ||
      (sample.audio && (!(sample.audio instanceof Blob) || !sample.audio.size ||
        sample.audio.size > MAX_BAR_AUDIO_BYTES))) {
    throw new Error("Bar text or audio is missing, invalid, or too large.");
  }
  const existing = await listBarSamples(sample.pageId);
  if (existing.length >= MAX_BAR_SAMPLES_PER_PAGE) {
    throw new Error("This page has 24 bar samples. Export and delete one before adding more.");
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BAR_STORE, "readwrite");
    tx.objectStore(BAR_STORE).add(sample);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Bar sample storage failed.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Bar sample storage quota exceeded.")); };
  });
}

export async function deleteBarSample(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BAR_STORE, "readwrite");
    tx.objectStore(BAR_STORE).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error || new Error("Could not delete bar sample.")); };
    tx.onabort = () => { db.close(); reject(tx.error || new Error("Bar sample deletion aborted.")); };
  });
}


/**
 * Atomically updates one page's review. When promoting a keeper, clears the
 * previous keeper on that page only, retaining all recordings and notes.
 * Works with pre-R2 samples that have no review fields.
 */
export async function saveBarReview(pageId: string, sampleId: string, review: BarReview): Promise<void> {
  if (!pageId || !sampleId) throw new Error("Choose a saved bar sample first.");
  const validated = validateBarReview(review);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(BAR_STORE, "readwrite");
    const store = tx.objectStore(BAR_STORE);
    const request = store.index("pageId").getAll(pageId);
    let issue: Error | null = null;
    request.onsuccess = () => {
      const existing = request.result as BarSample[];
      const target = existing.find(item => item.id === sampleId);
      if (!target) {
        issue = new Error("Sample not found on the selected lyric page.");
        tx.abort();
        return;
      }
      if (validated.keeper) {
        for (const item of existing) {
          if (item.id !== sampleId && item.keeper) store.put({ ...item, keeper: false });
        }
      }
      store.put({
        ...target,
        reviewNote: validated.note,
        rating: validated.rating,
        keeper: validated.keeper
      } satisfies BarSample);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(issue || tx.error || new Error("Could not save review.")); };
    tx.onabort = () => { db.close(); reject(issue || tx.error || new Error("Review was not saved.")); };
  });
}
