/**
 * MoreBounceLabs Writers Room: local manuscript and replaceable lexical API adapter.
 * Nothing in this module uploads or publishes a lyric.
 */
export const BOOK_KEY = "mbl-writers-book-v1";
export const BOOK_VERSION = 1;
export const PAGE_KINDS = ["freestyle", "lyrics", "verse", "hook", "ideas"];
export const MAX_PAGES = 120;
export const MAX_BODY = 16000;
export const MAX_TITLE = 120;
const MAX_IMPORT_BYTES = 2_500_000;
const LEXICAL_MODES = ["rel_rhy", "rel_nry", "ml", "rel_trg"];

export function emptyBook() {
  return { version: BOOK_VERSION, pages: [] };
}

/** @param {any} value */
export function validateBook(value) {
  if (!value || typeof value !== "object" || value.version !== BOOK_VERSION ||
      !Array.isArray(value.pages) || value.pages.length > MAX_PAGES) {
    throw new Error("Not a supported MoreBounceLabs freestyle book (v1).");
  }
  const seen = new Set();
  const pages = value.pages.map((/** @type {any} */ page) => {
    if (!page || typeof page !== "object" || typeof page.id !== "string" ||
        !/^[a-zA-Z0-9_-]{6,100}$/.test(page.id) || seen.has(page.id) ||
        typeof page.title !== "string" || page.title.length > MAX_TITLE ||
        typeof page.body !== "string" || page.body.length > MAX_BODY ||
        !PAGE_KINDS.includes(page.kind) ||
        typeof page.createdAt !== "string" || page.createdAt.length > 40 ||
        !Number.isFinite(Date.parse(page.createdAt)) ||
        typeof page.updatedAt !== "string" || page.updatedAt.length > 40 ||
        !Number.isFinite(Date.parse(page.updatedAt))) {
      throw new Error("The imported book contains an invalid or oversized page.");
    }
    seen.add(page.id);
    return {
      id: page.id, title: page.title, kind: page.kind, body: page.body,
      createdAt: page.createdAt, updatedAt: page.updatedAt
    };
  });
  const book = { version: BOOK_VERSION, pages };
  if (JSON.stringify(book).length > MAX_IMPORT_BYTES) {
    throw new Error("The book is too large for this browser workspace.");
  }
  return book;
}

export function newPage(kind = "freestyle", id = createPageId(), now = new Date().toISOString()) {
  if (!PAGE_KINDS.includes(kind)) throw new Error("Invalid page type.");
  return { id, title: "", kind, body: "", createdAt: now, updatedAt: now };
}

export function createPageId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "page_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
}

/** Never replace an existing page silently. Divergent same-ID pages become copies. */
/** @param {any} current @param {any} imported @param {() => string} [makeId] */
export function mergeBooks(current, imported, makeId = createPageId) {
  const original = validateBook(current);
  const incoming = validateBook(imported);
  const pages = [...original.pages];
  const byId = new Map(pages.map((page) => [page.id, page]));
  let added = 0;
  let skipped = 0;
  for (const page of incoming.pages) {
    const existing = byId.get(page.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(page)) {
      skipped++;
      continue;
    }
    if (pages.length >= MAX_PAGES) throw new Error("Book is full. Export a backup before importing more.");
    const importedPage = existing
      ? { ...page, id: makeId(), title: (page.title || "Untitled").slice(0, MAX_TITLE - 17) + " (imported copy)" }
      : page;
    if (byId.has(importedPage.id)) throw new Error("Imported page ID conflicts with an existing page.");
    pages.push(importedPage);
    byId.set(importedPage.id, importedPage);
    added++;
  }
  return { book: validateBook({ version: BOOK_VERSION, pages }), added, skipped };
}

/** @param {string} text */
export function rhymeTarget(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(/([\p{L}\p{N}'’-]+)[^\p{L}\p{N}'’-]*$/u);
  return match ? match[1] : "";
}

/** Only the deliberately entered lookup term is sent to the third-party service. */
/** @param {string} mode @param {string} term */
export function lexicalUrl(mode, term) {
  if (!LEXICAL_MODES.includes(mode)) throw new Error("Unsupported lookup type.");
  if (typeof term !== "string" || !term.trim() || term.trim().length > 80) {
    throw new Error("Enter a word or short phrase (up to 80 characters).");
  }
  const params = new URLSearchParams();
  params.set(mode, term.trim());
  params.set("max", "32");
  return "https://api.datamuse.com/words?" + params.toString();
}

/** @param {any} payload */
export function cleanSuggestions(payload) {
  if (!Array.isArray(payload)) throw new Error("Unexpected word service response.");
  const seen = new Set();
  return payload.slice(0, 64).flatMap((/** @type {any} */ entry) => {
    if (!entry || typeof entry.word !== "string" || !entry.word.trim() ||
        entry.word.length > 80 || seen.has(entry.word.toLowerCase())) return [];
    seen.add(entry.word.toLowerCase());
    return [{
      word: entry.word,
      syllables: Number.isInteger(entry.numSyllables) && entry.numSyllables > 0 &&
        entry.numSyllables < 20 ? entry.numSyllables : null
    }];
  });
}
