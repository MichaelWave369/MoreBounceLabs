import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BookOpen, Copy, Download, FileUp, Lightbulb, PenLine, Plus, Search, Trash2 } from "lucide-react";
import {
  BOOK_KEY, MAX_BODY, MAX_PAGES, MAX_TITLE, PAGE_KINDS,
  cleanSuggestions, emptyBook, lexicalUrl, mergeBooks, newPage, rhymeTarget, validateBook
} from "../../scripts/writers-room.mjs";

type PageKind = "freestyle" | "lyrics" | "verse" | "hook" | "ideas";
type Page = { id: string; title: string; kind: PageKind; body: string; createdAt: string; updatedAt: string };
type Book = { version: number; pages: Page[] };
type Suggestion = { word: string; syllables: number | null };
type Group = { name: string; words: Suggestion[] };
type Tab = "book" | "rhymes" | "related";

function readSaved(): { book: Book; blocked: boolean; warning: string } {
  if (typeof window === "undefined") return { book: emptyBook(), blocked: false, warning: "" };
  try {
    const raw = window.localStorage.getItem(BOOK_KEY);
    return { book: raw ? validateBook(JSON.parse(raw)) : emptyBook(), blocked: false, warning: "" };
  } catch {
    return {
      book: emptyBook(), blocked: true,
      warning: "Saved book could not be read or browser storage is unavailable. New writing stays in this tab only. Export a backup; existing storage will not be overwritten."
    };
  }
}

const TAB_NAMES: Array<{ id: Tab; title: string; detail: string }> = [
  { id: "book", title: "Freestyle Book", detail: "Lyrics, hooks and loose ideas" },
  { id: "rhymes", title: "Rhyme Finder", detail: "Exact and near rhymes" },
  { id: "related", title: "Word Connections", detail: "Similar words and phrase sparks" }
];

const LOOKUPS = {
  rhymes: [
    { code: "rel_rhy", name: "Rhymes" },
    { code: "rel_nry", name: "Near rhymes" }
  ],
  related: [
    { code: "ml", name: "Similar meanings and phrases" },
    { code: "rel_trg", name: "Associated ideas" }
  ]
} as const;

export function WritersRoom() {
  const [loaded] = useState(readSaved);
  const [book, setBook] = useState<Book>(loaded.book);
  const [activeId, setActiveId] = useState(loaded.book.pages[0]?.id || "");
  const [tab, setTab] = useState<Tab>("book");
  const [filter, setFilter] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [newKind, setNewKind] = useState<PageKind>("freestyle");
  const [notice, setNotice] = useState(loaded.warning || "Pages save in this browser as you type.");
  const [term, setTerm] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupNotice, setLookupNotice] = useState("");
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  const page = book.pages.find((item) => item.id === activeId);
  const filtered = book.pages
    .filter((item) => (kindFilter === "all" || item.kind === kindFilter) &&
      [item.title, item.body].join(" ").toLowerCase().includes(filter.toLowerCase().trim()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  function commit(next: Book, success = "Saved on this device.") {
    setBook(next);
    if (loaded.blocked) {
      setNotice("Browser storage is unavailable or unreadable. Export this book before closing the tab.");
      return;
    }
    try {
      const validated = validateBook(next);
      window.localStorage.setItem(BOOK_KEY, JSON.stringify(validated));
      setNotice(success);
    } catch {
      setNotice("Could not save in this browser (storage full or blocked). Export your book now.");
    }
  }

  function addPage() {
    if (book.pages.length >= MAX_PAGES) {
      setNotice("Book is full. Export a backup before adding more pages.");
      return;
    }
    const next = newPage(newKind) as Page;
    commit({ version: 1, pages: [...book.pages, next] });
    setActiveId(next.id);
    setTab("book");
  }

  function editPage(patch: Partial<Pick<Page, "title" | "body" | "kind">>) {
    if (!page) return;
    const next = {
      version: 1,
      pages: book.pages.map((item) => item.id === page.id
        ? { ...item, ...patch, updatedAt: new Date().toISOString() }
        : item)
    };
    commit(next);
  }

  function deletePage() {
    if (!page || !window.confirm("Delete this page from this browser? This cannot be undone. Export a backup first if you need one.")) return;
    const pages = book.pages.filter((item) => item.id !== page.id);
    commit({ version: 1, pages }, "Page deleted from this browser.");
    setActiveId(pages[0]?.id || "");
  }

  function exportBook() {
    try {
      const blob = new Blob([JSON.stringify(validateBook(book), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "morebouncelabs-freestyle-book.json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice("Book backup downloaded. Keep it somewhere safe.");
    } catch {
      setNotice("Unable to export this book. Reduce oversized pages and try again.");
    }
  }

  async function importBook(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_500_000) throw new Error("File is too large (2.5 MB maximum).");
      const incoming = validateBook(JSON.parse(await file.text()));
      const result = mergeBooks(book, incoming);
      if (result.added > 0) {
        commit(result.book, "Imported " + result.added + " pages; existing pages were preserved.");
        setActiveId(result.book.pages[result.book.pages.length - 1].id);
      } else {
        setNotice("No new pages to import (" + result.skipped + " identical pages already here).");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to import this book.");
    } finally {
      input.value = "";
    }
  }

  function switchTab(next: Tab) {
    request.current?.abort();
    request.current = null;
    setLookupBusy(false);
    setLookupNotice("");
    setGroups([]);
    setTab(next);
  }

  async function lookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (tab === "book") return;
    const target = tab === "rhymes" ? rhymeTarget(term) : term.trim();
    if (!target) {
      setLookupNotice("Enter a word or phrase first.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLookupBusy(true);
    setGroups([]);
    setLookupNotice("");
    const modes = LOOKUPS[tab];
    const timeout = window.setTimeout(() => controller.abort(), 9000);
    try {
      const responses = await Promise.allSettled(modes.map(async (mode) => {
        const response = await fetch(lexicalUrl(mode.code, target), {
          signal: controller.signal,
          headers: { Accept: "application/json" }
        });
        if (!response.ok) throw new Error("Word lookup service unavailable.");
        return cleanSuggestions(await response.json()) as Suggestion[];
      }));
      if (controller.signal.aborted) return;
      const next: Group[] = modes.map((mode, index) => {
        const response = responses[index];
        return { name: mode.name, words: response.status === "fulfilled" ? response.value : [] };
      });
      setGroups(next);
      const failures = responses.filter((value) => value.status === "rejected").length;
      setLookupNotice(failures
        ? "Some lookups failed. Try again; your book was not sent or changed."
        : next.every((group) => group.words.length === 0)
          ? "No matches found. Try a different spelling or a shorter phrase."
          : "Tap a word to add it to your current book page.");
    } catch {
      if (!controller.signal.aborted) setLookupNotice("Word lookup failed. Your book remains available offline.");
    } finally {
      window.clearTimeout(timeout);
      if (request.current === controller) {
        setLookupBusy(false);
        if (controller.signal.aborted) setLookupNotice("Lookup timed out or was canceled. Try again.");
      }
    }
  }

  function addWord(word: string) {
    if (!page) {
      setLookupNotice("Create or select a page in Freestyle Book first.");
      return;
    }
    const addition = (page.body ? "\n" : "") + word;
    if (page.body.length + addition.length > MAX_BODY) {
      setLookupNotice("Current page is full. Start another page to collect more words.");
      return;
    }
    editPage({ body: page.body + addition });
    setLookupNotice("Added \"" + word + "\" to " + (page.title || "Untitled page") + ".");
  }

  async function copyWord(word: string) {
    try {
      await navigator.clipboard.writeText(word);
      setLookupNotice("Copied: " + word);
    } catch {
      setLookupNotice("Clipboard not available; select the word to copy manually.");
    }
  }

  return (
    <section className="mx-auto max-w-6xl space-y-5 pb-12" aria-label="MoreBounceLabs Writers Room">
      <header className="overflow-hidden rounded-3xl border border-amber/30 bg-gradient-to-br from-[#322011] via-[#17120f] to-[#141323] p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber">MoreBounceLabs · Creative headquarters</p>
            <h1 className="mt-2 flex items-center gap-3 font-display text-4xl sm:text-5xl"><BookOpen aria-hidden="true" /> Writers Room</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#dbcbbb]">
              A private freestyle collection book, a rhyme bench, and a word-association playground.
              Write a line, chase a rhyme, save the verse. Nothing publishes automatically.
            </p>
          </div>
          <span className="rounded-xl border border-amber/30 bg-black/30 px-3 py-2 text-sm text-amber">{book.pages.length} / {MAX_PAGES} pages</span>
        </div>
      </header>

      <div role="tablist" aria-label="Writers Room tools" className="grid gap-2 sm:grid-cols-3">
        {TAB_NAMES.map((item) => (
          <button key={item.id} type="button" role="tab" aria-selected={tab === item.id}
            onClick={() => switchTab(item.id)}
            className={"min-h-16 rounded-2xl border px-4 py-3 text-left " +
              (tab === item.id ? "border-amber bg-[#53321b] text-cream" : "border-line bg-surface text-mist hover:border-amber/50")}>
            <span className="block font-semibold">{item.title}</span>
            <span className="block text-xs opacity-80">{item.detail}</span>
          </button>
        ))}
      </div>

      {tab === "book" ? (
        <div role="tabpanel" className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-line bg-surface p-4">
            <h2 className="flex items-center gap-2 font-display text-xl"><BookOpen size={19} aria-hidden="true" /> My collections</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              <select aria-label="New page type" value={newKind} onChange={(event) => setNewKind(event.target.value as PageKind)}
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-bg px-2 text-sm">
                {PAGE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
              <button type="button" onClick={addPage} className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-amber px-3 font-semibold text-ink">
                <Plus size={17} aria-hidden="true" /> New
              </button>
            </div>
            <div className="mt-4 space-y-2">
              <label htmlFor="writer-filter" className="text-xs text-mist">Find a page</label>
              <input id="writer-filter" value={filter} onChange={(event) => setFilter(event.target.value)}
                placeholder="Search titles and lyrics"
                className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm" />
              <select aria-label="Filter page type" value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm">
                <option value="all">All collections</option>
                {PAGE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
              </select>
            </div>
            <ul className="mt-4 max-h-[480px] space-y-2 overflow-y-auto">
              {filtered.length === 0 && <li className="text-sm text-mist">No pages yet. Start a freestyle or write a hook.</li>}
              {filtered.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setActiveId(item.id)}
                    aria-current={activeId === item.id ? "page" : undefined}
                    className={"min-h-14 w-full rounded-xl border p-3 text-left " +
                      (activeId === item.id ? "border-amber bg-amber/15" : "border-line bg-black/20 hover:border-amber/50")}>
                    <span className="block truncate font-semibold">{item.title || "Untitled page"}</span>
                    <span className="mt-1 block text-xs capitalize text-mist">{item.kind} · {new Date(item.updatedAt).toLocaleDateString()}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-4 sm:p-6">
            {page ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor="writer-title" className="text-sm font-semibold text-amber">Page title</label>
                  <button type="button" onClick={deletePage} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-heat/50 px-3 text-sm text-heat">
                    <Trash2 size={16} aria-hidden="true" /> Delete page
                  </button>
                </div>
                <input id="writer-title" value={page.title} maxLength={MAX_TITLE}
                  placeholder="Name this freestyle, verse, song, or collection"
                  onChange={(event) => editPage({ title: event.target.value })}
                  className="min-h-12 w-full rounded-xl border border-line bg-bg px-4 text-lg font-semibold" />
                <label htmlFor="writer-kind" className="block text-sm text-mist">Collection</label>
                <select id="writer-kind" value={page.kind}
                  onChange={(event) => editPage({ kind: event.target.value as PageKind })}
                  className="min-h-11 rounded-xl border border-line bg-bg px-3 text-sm capitalize">
                  {PAGE_KINDS.map((kind) => <option key={kind} value={kind}>{kind}</option>)}
                </select>
                <label htmlFor="writer-body" className="flex items-center gap-2 text-sm font-semibold text-amber"><PenLine size={17} aria-hidden="true" /> Lyrics &amp; notes</label>
                <textarea id="writer-body" value={page.body} maxLength={MAX_BODY} spellCheck
                  onChange={(event) => editPage({ body: event.target.value })}
                  placeholder={"First thought, first bar...\n\nVerse 1\n\nHook\n\nIdeas, punchlines, rhyme schemes..."}
                  className="min-h-[420px] w-full resize-y rounded-xl border border-line bg-bg p-4 font-mono text-sm leading-7 text-cream focus:border-amber focus:outline-none" />
                <p className="flex flex-wrap justify-between gap-2 text-xs text-mist">
                  <span>{page.body.trim() ? page.body.trim().split(/\s+/).length : 0} words · {page.body.length}/{MAX_BODY} characters</span>
                  <span>Updated {new Date(page.updatedAt).toLocaleString()}</span>
                </p>
              </>
            ) : (
              <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 text-center">
                <Lightbulb className="text-amber" size={34} aria-hidden="true" />
                <h2 className="font-display text-2xl">The blank page is waiting</h2>
                <p className="max-w-sm text-sm text-mist">Choose a collection type and press New. Every freestyle needs somewhere to land.</p>
                <button type="button" onClick={addPage} className="min-h-11 rounded-xl bg-amber px-5 font-semibold text-ink">Create first page</button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div role="tabpanel" className="rounded-2xl border border-line bg-surface p-4 sm:p-6">
          <h2 className="font-display text-2xl">{tab === "rhymes" ? "Find the next rhyme" : "Find another way to say it"}</h2>
          <p className="mt-2 text-sm text-mist">
            {tab === "rhymes"
              ? "Enter a word or lyric ending. For a line, the last word is used for rhyme matching."
              : "Enter a word or short phrase. Explore semantic alternatives and associated images or ideas."}
          </p>
          <form onSubmit={lookup} className="mt-5 flex flex-wrap items-center gap-2">
            <label htmlFor="writers-lookup" className="sr-only">Word or phrase to explore</label>
            <input id="writers-lookup" value={term} maxLength={80} onChange={(event) => setTerm(event.target.value)}
              placeholder={tab === "rhymes" ? "e.g. vibration" : "e.g. the long road home"}
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-4 text-cream" />
            <button type="submit" disabled={lookupBusy} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber px-5 font-semibold text-ink disabled:opacity-50">
              <Search size={18} aria-hidden="true" /> {lookupBusy ? "Searching…" : "Find words"}
            </button>
          </form>
          <p className="mt-3 text-xs text-mist">
            Only the word or phrase you search is sent to Datamuse. Your lyrics and book stay in this browser. Searches require internet; they are not AI-generated lyric rewrites.
          </p>
          <p aria-live="polite" className="mt-3 text-sm text-amber">{lookupNotice}</p>
          {groups.length > 0 && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {groups.map((group) => (
                <section key={group.name} className="rounded-xl border border-line bg-bg p-4">
                  <h3 className="font-display text-xl">{group.name}</h3>
                  {group.words.length === 0
                    ? <p className="mt-3 text-sm text-mist">No results in this group.</p>
                    : <ul className="mt-4 flex flex-wrap gap-2">
                      {group.words.map((item) => (
                        <li key={item.word} className="flex items-center gap-1 rounded-xl border border-amber/25 bg-[#261b14] p-1">
                          <button type="button" onClick={() => addWord(item.word)} title="Add to current book page"
                            className="min-h-10 rounded-lg px-2 text-sm hover:bg-amber/20">
                            {item.word}{item.syllables ? <span className="ml-1 text-xs text-mist">({item.syllables})</span> : null}
                          </button>
                          <button type="button" onClick={() => void copyWord(item.word)}
                            aria-label={"Copy " + item.word} title="Copy word"
                            className="flex min-h-10 min-w-10 items-center justify-center rounded-lg text-mist hover:bg-amber/20">
                            <Copy size={15} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>}
                </section>
              ))}
            </div>
          )}
          <p className="mt-5 text-xs text-mist">Tip: Open Freestyle Book, select a page, then come back here. Tapping a result appends it to that page.</p>
        </div>
      )}

      <footer className="rounded-2xl border border-line bg-[#201713] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p aria-live="polite" className="max-w-2xl text-sm text-[#e9d5bc]">{notice}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportBook} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber/40 px-3 text-sm text-cream">
              <Download size={17} aria-hidden="true" /> Export book
            </button>
            <label htmlFor="writer-import" className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber/40 px-3 text-sm text-cream">
              <FileUp size={17} aria-hidden="true" /> Import book
            </label>
            <input id="writer-import" type="file" accept=".json,application/json" onChange={(event) => void importBook(event)}
              className="sr-only" aria-label="Import a MoreBounceLabs book backup" />
          </div>
        </div>
        <p className="mt-3 text-xs text-mist">Private-by-default means device-local, not encrypted or cloud-synced. Browser data can be cleared. Export regularly and avoid shared devices for sensitive writing. Imports merge; they do not overwrite existing pages.</p>
      </footer>
    </section>
  );
}
