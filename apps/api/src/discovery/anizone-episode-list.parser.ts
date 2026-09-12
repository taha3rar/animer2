import { decodeJsStringLiteral } from "./js-string-literal.util";

export type ParsedEpisode = {
  episodeNumber: number;
  title: string;
  sourceUrl: string;
};

// Matches one episode <a> block on an anime/{slug}/{n} page: the Alpine
// x-data carrying `epsTitles: JSON.parse('...')` (a per-language title map),
// followed eventually by wire:key="e-{n}" and href="...". Both attribute
// values are captured with the standard "quoted string with escapes" pattern
// so embedded escaped quotes/backslashes don't terminate the match early.
const EPISODE_BLOCK_PATTERN =
  /<a\s+x-data="\{[\s\S]*?epsTitles:\s*JSON\.parse\('((?:\\.|[^'\\])*)'\)[\s\S]*?wire:key="e-(\d+)"\s+href="((?:\\.|[^"\\])*)"/g;

// Key "1" is English in AniZone's language-id scheme (confirmed against the
// site's own titles — "1" is always the plain English title across episodes).
// Numeric-string object keys always enumerate in ascending numeric order per
// the JS spec, so falling back to the first enumerated value also lands on "1"
// whenever it's present, and on *some* title (better than nothing) when it isn't.
function pickEnglishTitle(epsTitles: unknown, episodeNumber: number): string {
  if (epsTitles && typeof epsTitles === "object") {
    const map = epsTitles as Record<string, string>;
    if (typeof map["1"] === "string" && map["1"].length > 0) return map["1"];
    const [first] = Object.values(map);
    if (typeof first === "string" && first.length > 0) return first;
  }
  return `Episode ${episodeNumber}`;
}

/**
 * Parses the episode sidebar out of an anime/{slug}/{n} page's raw HTML (any
 * episode page lists every episode, not just the one being viewed — AniZone
 * doesn't expose this as a plain API, so this is the only way to find the
 * episode count/titles for a show). Malformed individual blocks are skipped
 * rather than failing the whole page.
 */
export function parseEpisodeList(html: string): ParsedEpisode[] {
  const episodes: ParsedEpisode[] = [];

  for (const match of html.matchAll(EPISODE_BLOCK_PATTERN)) {
    const [, epsTitlesLiteral, episodeNumberRaw, hrefRaw] = match;
    const episodeNumber = Number(episodeNumberRaw);
    if (!Number.isFinite(episodeNumber)) continue;

    let epsTitles: unknown;
    try {
      epsTitles = JSON.parse(decodeJsStringLiteral(epsTitlesLiteral));
    } catch {
      epsTitles = null;
    }

    episodes.push({
      episodeNumber,
      title: pickEnglishTitle(epsTitles, episodeNumber),
      sourceUrl: decodeJsStringLiteral(hrefRaw),
    });
  }

  return episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);
}
