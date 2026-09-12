import { GatewayTimeoutException, Injectable } from "@nestjs/common";
import type { HTTPRequest } from "puppeteer";
import type { AnizoneSearchItem, AnizoneSearchResult, AnizoneTag } from "@streaming/types";
import { AnizoneBrowserService } from "./anizone-browser.service";

const ANIZONE_INDEX_URL = "https://anizone.to/anime";
// AniZone's search box is a Livewire-bound input with no stable id/name — this
// class selector is what scrape.js found to work when this was reverse-engineered.
const SEARCH_INPUT_SELECTOR = "input.border-slate-700";
const SEARCH_TIMEOUT_MS = 20_000;

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

@Injectable()
export class AnizoneService {
  constructor(private readonly browserService: AnizoneBrowserService) {}

  async search(query: string): Promise<AnizoneSearchResult> {
    const browser = await this.browserService.getBrowser();
    const page = await browser.newPage();

    try {
      const payload = await this.captureSearchResponse(page, query);
      return {
        items: (payload.items ?? []).map(toAnizoneSearchItem),
        hasMore: Boolean(payload.hasMore),
      };
    } finally {
      await page.close().catch(() => {});
    }
  }

  // Mirrors scrape.js: AniZone's search box has no plain HTTP API, so we drive
  // a real page, type into the Livewire-bound input, and capture the resulting
  // /livewire/update request's JSON response instead of scraping rendered HTML.
  private captureSearchResponse(
    page: import("puppeteer").Page,
    query: string
  ): Promise<RawAnizoneSearchPayload> {
    return new Promise<RawAnizoneSearchPayload>((resolve, reject) => {
      let matchedRequest: HTTPRequest | null = null;
      let settled = false;

      const finish = (fn: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        fn();
      };

      const timeout = setTimeout(() => {
        finish(() => reject(new GatewayTimeoutException("Timed out waiting for AniZone search results")));
      }, SEARCH_TIMEOUT_MS);

      page.on("request", (request) => {
        try {
          const url = new URL(request.url());
          if (url.pathname === "/livewire/update") matchedRequest = request;
        } catch {
          // ignore requests with unparseable URLs
        }
      });

      page.on("response", (response) => {
        if (!matchedRequest || response.request() !== matchedRequest) return;
        response
          .json()
          .then((body) => finish(() => resolve(extractSearchPayload(body))))
          .catch((err) => finish(() => reject(err instanceof Error ? err : new Error(String(err)))));
      });

      (async () => {
        await page.goto(ANIZONE_INDEX_URL, { waitUntil: "networkidle2" });
        await page.waitForSelector(SEARCH_INPUT_SELECTOR);
        await page.click(SEARCH_INPUT_SELECTOR, { count: 3 });
        await page.keyboard.press("Backspace");
        await page.type(SEARCH_INPUT_SELECTOR, query, { delay: 50 });
      })().catch((err) => finish(() => reject(err)));
    });
  }
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
