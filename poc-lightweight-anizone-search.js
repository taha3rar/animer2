// poc-lightweight-anizone-search.js
//
// PROOF OF CONCEPT: replace puppeteer with plain `fetch()` for AniZone search.
//
// RESULT: IT WORKS. AniZone's search box is a Laravel Livewire v3 component
// with no REST API, but Livewire's wire protocol turns out to be fully
// replicable over plain HTTP — no browser, no JS execution, no Cloudflare
// challenge encountered. Verified end-to-end against the real site.
//
// -----------------------------------------------------------------------
// HOW LIVEWIRE'S PROTOCOL WORKS (and why this doesn't need a checksum forge)
// -----------------------------------------------------------------------
// 1. GET https://anizone.to/anime returns server-rendered HTML. Embedded in
//    it, each Livewire component carries a `wire:snapshot="{...}"` attribute
//    — a JSON blob of the component's current server-side state:
//      { data: {...}, memo: { id, name, path, method, ... }, checksum }
//    The `checksum` is an HMAC computed server-side (over data+memo, salted
//    with the app's secret key) so a client can't forge a *new* one. But we
//    don't need to: we just resend the exact snapshot string the server just
//    gave us, byte for byte. The checksum still matches because we haven't
//    changed it — only the separate `updates` field says what changed.
// 2. The page also has `<meta name="csrf-token" content="...">` and sets two
//    cookies (`XSRF-TOKEN`, `anizone_session`) via Set-Cookie.
// 3. When you type in the search box, the browser's Livewire JS POSTs to
//    /livewire/update with a body of the form:
//      {
//        "_token": "<csrf token from the meta tag>",
//        "components": [{
//          "snapshot": "<the exact wire:snapshot JSON, as a STRING>",
//          "updates": { "search": "<query>" },
//          "calls": []
//        }]
//      }
//    with header `Content-Type: application/json` and the session cookies
//    attached. This shape was confirmed by instrumenting the existing
//    scrape.js (puppeteer) with `matchedRequest.postData()` — see the
//    "Verification" note at the bottom of this file for how it was captured.
// 4. The server responds with a new snapshot plus `effects.dispatches`, one
//    of which (name varies — here it's "filters-reset") carries
//    `params.items`, an array of anime search results in the same shape the
//    production `anizone.service.ts` already expects/parses.
//
// So: no browser needed. Two plain HTTP round-trips (GET index, POST
// update) fully replace puppeteer's "launch Chromium, load page, type into
// input, wait for the request" dance for this one piece of functionality.
//
// -----------------------------------------------------------------------
// Usage: node poc-lightweight-anizone-search.js "naruto"
// -----------------------------------------------------------------------

const ANIZONE_INDEX_URL = "https://anizone.to/anime";
const ANIZONE_UPDATE_URL = "https://anizone.to/livewire/update";

// A normal desktop Chrome UA. Plain fetch() without a UA at all also seemed
// to work in testing (no Cloudflare/bot-check was observed either way), but
// sending a realistic one is cheap insurance against UA-based heuristics.
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function decodeHtmlAttrEntities(value) {
  // wire:snapshot="..." is an HTML attribute, so the JSON inside it is
  // HTML-entity-escaped (quotes become &quot; etc). Undo that before
  // JSON.parse-ing it.
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function cookieHeaderFromSetCookies(setCookieHeaders) {
  // We only need name=value pairs for the outgoing Cookie header; Set-Cookie
  // attributes like Path/Expires/SameSite are for the browser's jar, not us.
  return setCookieHeaders.map((c) => c.split(";")[0]).join("; ");
}

// Fetch the AniZone anime-index page and extract everything needed to talk
// to /livewire/update: the CSRF token, session cookies, and the raw
// wire:snapshot string for the `pages.anime-index` Livewire component
// (identified by its component name inside the decoded snapshot, since
// AniZone doesn't expose a stable DOM id/selector for it).
async function fetchLivewireBootstrap() {
  const res = await fetch(ANIZONE_INDEX_URL, {
    headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
  });
  if (!res.ok) {
    throw new Error(`GET ${ANIZONE_INDEX_URL} failed: ${res.status}`);
  }

  const cookieHeader = cookieHeaderFromSetCookies(res.headers.getSetCookie());
  const html = await res.text();

  const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)">/);
  if (!csrfMatch) throw new Error("csrf-token meta tag not found");
  const csrfToken = csrfMatch[1];

  const snapshotRe = /wire:snapshot="([^"]*)"/g;
  let match;
  let snapshot = null;
  while ((match = snapshotRe.exec(html))) {
    const decoded = decodeHtmlAttrEntities(match[1]);
    if (decoded.includes('"pages.anime-index"')) {
      snapshot = decoded;
      break;
    }
  }
  if (!snapshot) throw new Error("pages.anime-index wire:snapshot not found");

  return { cookieHeader, csrfToken, snapshot };
}

// POST the Livewire "property update" request that simulates typing `query`
// into the search input, and return the parsed JSON response.
async function postLivewireSearchUpdate({ cookieHeader, csrfToken, snapshot }, query) {
  const payload = {
    _token: csrfToken,
    components: [
      {
        snapshot,
        updates: { search: query },
        calls: [],
      },
    ],
  };

  const res = await fetch(ANIZONE_UPDATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
      // Livewire's client sends this (empty-valued) header on every request;
      // harmless to include, and matches what the real browser sends.
      "x-livewire": "",
      Referer: ANIZONE_INDEX_URL,
      Cookie: cookieHeader,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`POST /livewire/update failed: ${res.status} ${text.slice(0, 500)}`);
  }
  return JSON.parse(text);
}

// Same "find by shape, not by fixed index/dispatch name" approach as the
// production anizone.service.ts, since AniZone controls the dispatch name
// (observed as "filters-reset" here, but that's an implementation detail we
// shouldn't hard-code against).
function extractSearchItems(livewireResponse) {
  const components = livewireResponse?.components ?? [];
  for (const component of components) {
    const dispatches = component?.effects?.dispatches ?? [];
    for (const dispatch of dispatches) {
      const items = dispatch?.params?.items;
      if (Array.isArray(items)) return items;
    }
  }
  return [];
}

async function searchAnizone(query) {
  const bootstrap = await fetchLivewireBootstrap();
  const response = await postLivewireSearchUpdate(bootstrap, query);
  return extractSearchItems(response);
}

// ---- run as a CLI ----
(async () => {
  const query = process.argv[2] || "naruto";
  const t0 = Date.now();

  console.log(`Searching AniZone for "${query}" via plain HTTP (no browser)...`);
  const items = await searchAnizone(query);
  const elapsedMs = Date.now() - t0;

  console.log(`\nFound ${items.length} result(s) in ${elapsedMs}ms (2 HTTP round-trips, no Chromium launch):\n`);
  for (const item of items) {
    console.log(`  - ${item.main_title}  (slug: ${item.slug})`);
  }
  console.log(
    `\nFor comparison: puppeteer's browser launch + page navigation + render alone` +
      ` typically costs 1-3+ seconds on top of the network time, plus a ~170-300MB` +
      ` Chromium download in the deploy image. This approach needs neither.`
  );
})().catch((err) => {
  console.error("POC FAILED:", err.message);
  process.exit(1);
});

// -----------------------------------------------------------------------
// Verification note
// -----------------------------------------------------------------------
// This was cross-checked against a real browser-driven request captured by
// instrumenting scrape.js (the existing puppeteer POC at the repo root) to
// log `matchedRequest.headers()` and `matchedRequest.postData()` for the
// /livewire/update request it already listens for. The captured payload
// shape (`_token` + `components[0].{snapshot,updates,calls}`) and headers
// (`Content-Type: application/json`, `x-livewire: ""`) matched exactly what
// this file constructs from a fresh, browser-free HTTP session — confirming
// the snapshot/checksum pair from a fresh page load is valid to replay
// as-is, with only the `updates.search` value changed.
