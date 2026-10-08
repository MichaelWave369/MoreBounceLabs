import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const root = new URL("../dj-bot-lab/", import.meta.url);
const embedHtml = readFileSync(new URL("embed.html", root), "utf8");
const hostTemplate = readFileSync(new URL("fixture.html", root), "utf8");

function serve(res, html) {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  res.end(html);
}
async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return "http://127.0.0.1:" + server.address().port;
}
async function shutdown(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

/** Two localhost ports create separate origins, mimicking an iframe boundary. */
export async function startDjBotFixture(trackCount = 10) {
  if (!Number.isInteger(trackCount) || trackCount < 1 || trackCount > 25) throw new Error("Fixture accepts 1–25 tracks");
  const iframeServer = createServer((_req, res) => serve(res, embedHtml));
  const embedOrigin = await listen(iframeServer);
  const hostHtml = hostTemplate.replaceAll("__TRACK_COUNT__", String(trackCount)).replaceAll("__EMBED_URL__", embedOrigin);
  const hostServer = createServer((_req, res) => serve(res, hostHtml));
  try {
    const hostOrigin = await listen(hostServer);
    return {
      url: hostOrigin,
      trackCount,
      async close() {
        await shutdown(hostServer);
        await shutdown(iframeServer);
      },
    };
  } catch (error) {
    await shutdown(iframeServer);
    throw error;
  }
}
