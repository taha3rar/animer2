import { GatewayTimeoutException, Injectable } from "@nestjs/common";
import type { AnizoneSearchItem, AnizoneSearchResult, AnizoneTag } from "@streaming/types";

const ANIZONE_INDEX_URL = "https://anizone.to/anime";
const ANIZONE_UPDATE_URL = "https://anizone.to/livewire/update";
const ANIZONE_COMPONENT_NAME = "pages.anime-index";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

type RawAnizoneItem = {
  slug: string;
  url: string;
  cover?: string | null;
  main_title: string;
  title_list?: Record<string, string> | null;
  type?: string | null;
  is_ongoing?: boolean;
  is_unsafe?: boolean;
  start_year?: number | null;
  episode_count?: number | null;
  tags?: AnizoneTag[] | null;
};

type RawAnizoneSearchPayload = {
  items?: RawAnizoneItem[];
  hasMore?: boolean;
};

type LivewireBootstrap = {
  cookieHeader: string;
  csrfToken: string;
  snapshot: string;
};

// AniZone's search box is a Laravel Livewire v3 component with no plain REST
// API. Rather than driving a real browser (puppeteer) to type into it and
// capture the resulting XHR, we replicate Livewire's wire protocol directly:
// the index page's HTML embeds a `wire:snapshot` blob (server-signed state,
// replayed byte-for-byte — we never need to forge its checksum) plus a CSRF
// token and session cookies, which is everything /livewire/update needs to
// simulate "the user typed a search query". See poc-lightweight-anizone-search.js
// at the repo root for the reverse-engineering notes and verification this
// was cross-checked against a real puppeteer-captured request.
@Injectable()
export class AnizoneService {
  async search(query: string): Promise<AnizoneSearchResult> {
    const bootstrap = await this.fetchLivewireBootstrap();
    const payload = await this.postLivewireSearchUpdate(bootstrap, query);
    return {
      items: (payload.items ?? []).map(toAnizoneSearchItem),
      hasMore: Boolean(payload.hasMore),
    };
  }

  private async fetchLivewireBootstrap(): Promise<LivewireBootstrap> {
    const res = await fetch(ANIZONE_INDEX_URL, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html" },
    });
    if (!res.ok) {
      throw new GatewayTimeoutException(`Failed to load AniZone index page: ${res.status}`);
    }

    const cookieHeader = res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    const html = await res.text();

    const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)">/);
    if (!csrfMatch) throw new GatewayTimeoutException("AniZone csrf-token meta tag not found");

    const snapshotRe = /wire:snapshot="([^"]*)"/g;
    let match: RegExpExecArray | null;
    let snapshot: string | null = null;
    while ((match = snapshotRe.exec(html))) {
      const decoded = decodeHtmlAttrEntities(match[1]);
      if (decoded.includes(`"${ANIZONE_COMPONENT_NAME}"`)) {
        snapshot = decoded;
        break;
      }
    }
    if (!snapshot) throw new GatewayTimeoutException("AniZone search component snapshot not found");

    return { cookieHeader, csrfToken: csrfMatch[1], snapshot };
  }

  private async postLivewireSearchUpdate(
    bootstrap: LivewireBootstrap,
    query: string
  ): Promise<RawAnizoneSearchPayload> {
    const payload = {
      _token: bootstrap.csrfToken,
      components: [
        {
          snapshot: bootstrap.snapshot,
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
        "x-livewire": "",
        Referer: ANIZONE_INDEX_URL,
        Cookie: bootstrap.cookieHeader,
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new GatewayTimeoutException(`AniZone search request failed: ${res.status}`);
    }

    return extractSearchPayload(JSON.parse(text));
  }
}

function decodeHtmlAttrEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

// The search results live wherever the Livewire response dispatched an event
// carrying an `items` array — found by shape rather than a fixed index/name,
// since AniZone controls the event name and dispatch ordering, not us.
function extractSearchPayload(body: unknown): RawAnizoneSearchPayload {
  const components = (body as { components?: unknown[] })?.components ?? [];
  for (const component of components) {
    const dispatches = (component as { effects?: { dispatches?: unknown[] } })?.effects?.dispatches ?? [];
    for (const dispatch of dispatches) {
      const params = (dispatch as { params?: unknown })?.params;
      if (params && Array.isArray((params as RawAnizoneSearchPayload).items)) {
        return params as RawAnizoneSearchPayload;
      }
    }
  }
  return { items: [] };
}

function toAnizoneSearchItem(raw: RawAnizoneItem): AnizoneSearchItem {
  return {
    slug: raw.slug,
    sourceUrl: raw.url,
    title: raw.main_title,
    alternateTitles: raw.title_list ?? null,
    coverUrl: raw.cover ?? null,
    type: raw.type ?? null,
    isOngoing: Boolean(raw.is_ongoing),
    isUnsafe: Boolean(raw.is_unsafe),
    startYear: raw.start_year ?? null,
    episodeCount: raw.episode_count ?? null,
    tags: raw.tags ?? [],
  };
}
