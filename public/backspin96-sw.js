/* BackSpin96 offline helper. Only owned same-origin assets are intercepted.
 * No user-loaded tracks, microphones, or external streaming URLs are cached.
 */
const CACHE = "backspin96-local-pack-v1";
const BASE = new URL("./", self.registration.scope).pathname;
const META = BASE + "backspin96-offline-index.json";
const ALLOWED_PREFIXES = [
  BASE + "backspin96/",
  BASE + "assets/",
  BASE + "backspin96-",
];
const EXACT = new Set([BASE + "backspin.html", BASE + "backspin96.webmanifest"]);

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

function allowed(url) {
  return url.origin === self.location.origin &&
    (EXACT.has(url.pathname) || ALLOWED_PREFIXES.some((prefix) => url.pathname.startsWith(prefix)));
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (!allowed(url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === "basic") {
        await cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch {
      return (await cache.match(event.request)) || Response.error();
    }
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "BACKSPIN_OFFLINE_PREPARE" || !event.ports?.[0]) return;
  const port = event.ports[0];
  event.waitUntil((async () => {
    try {
      // Fetch the fresh build's exact asset inventory. GitHub Pages is
      // immutable enough for hashed bundles but not for the entry HTML.
      const inventoryResponse = await fetch(META, { cache: "no-store" });
      if (!inventoryResponse.ok) throw new Error("Offline inventory not available.");
      const inventory = await inventoryResponse.json();
      if (inventory.format !== "backspin96-offline-v1" || !inventory.runtimeReady ||
          !Array.isArray(inventory.files) || inventory.files.length < 8 ||
          inventory.files.length > 350) throw new Error("The verified DJ runtime is not ready for offline use.");
      const names = [...new Set([META, ...inventory.files])];
      if (!names.includes(BASE + "backspin.html") ||
          !names.includes(BASE + "backspin96/mbl-stage.json"))
        throw new Error("Offline inventory is missing required booth components.");
      if (names.some((name) => typeof name !== "string" || !name.startsWith(BASE) ||
            name.includes("..") || !allowed(new URL(name, self.location.origin))))
        throw new Error("Offline inventory contains an unsafe path.");
      // Complete all fetches first; then record the result in this origin's
      // CacheStorage. No music files or third-party assets are added.
      const responses = [];
      for (let index = 0; index < names.length; index++) {
        const name = names[index];
        const response = await fetch(name, { cache: "reload" });
        if (!response.ok || response.type !== "basic") throw new Error("Could not save " + name.split("/").pop());
        responses.push([name, response]);
        port.postMessage({ type: "progress", done: index + 1, total: names.length });
      }
      const cache = await caches.open(CACHE);
      for (const [name, response] of responses) await cache.put(name, response);
      port.postMessage({ type: "ready", total: names.length });
    } catch (error) {
      port.postMessage({ type: "error", detail: error instanceof Error ? error.message : "Could not prepare offline assets." });
    } finally {
      port.close();
    }
  })());
});
