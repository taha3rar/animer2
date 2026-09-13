import { GatewayTimeoutException, Injectable } from "@nestjs/common";
import type { AnizoneSearchItem, AnizoneSearchResult } from "@streaming/types";

const ANIMEHEAVEN_BASE_URL = "https://animeheaven.me";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// Unlike AniZone (a Livewire SPA with no plain search endpoint), AnimeHeaven's
// search results are plain server-rendered HTML — no session/CSRF dance
// needed, just parse the anchors out directly. Shaped to the same
// AnizoneSearchItem/Result contract (search.php has no equivalent of most of
// those fields — alternateTitles/type/startYear/episodeCount/tags come back
// empty) so the existing search/preview/import UI works against either
// source unchanged; a real AnimeheavenSearchItem type isn't worth
// introducing just to immediately widen it back out.
@Injectable()
export class AnimeheavenService {
  async search(query: string): Promise<AnizoneSearchResult> {
    const res = await fetch(`${ANIMEHEAVEN_BASE_URL}/search.php?s=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) {
      throw new GatewayTimeoutException(`AnimeHeaven search request failed: ${res.status}`);
    }

    const html = await res.text();
    return { items: parseSearchResults(html), hasMore: false };
  }
}

// Each result looks like:
//   <a href='anime.php?ukr6y'><img class='coverimg' src='image.php?ez7kl' alt='Naruto' loading='lazy'></a>
function parseSearchResults(html: string): AnizoneSearchItem[] {
  const items: AnizoneSearchItem[] = [];
  const re = /<a href='anime\.php\?([^']+)'><img class='coverimg' src='([^']+)' alt='([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const slug = match[1];
    items.push({
      slug,
      sourceUrl: `${ANIMEHEAVEN_BASE_URL}/anime.php?${slug}`,
      title: decodeHtmlEntities(match[3]),
      alternateTitles: null,
      coverUrl: `${ANIMEHEAVEN_BASE_URL}/${match[2]}`,
      type: null,
      isOngoing: false,
      isUnsafe: false,
      startYear: null,
      episodeCount: null,
      tags: [],
    });
  }
  return items;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
