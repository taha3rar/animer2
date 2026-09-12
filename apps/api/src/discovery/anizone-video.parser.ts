import { decodeJsStringLiteral } from "./js-string-literal.util";

export type ParsedAnizoneSubtitle = {
  title: string;
  language: string;
  format: "srt" | "vtt" | "ass";
  url: string;
  default: boolean;
  forced: boolean;
};

// AniZone's own reported subtitle `format` field is unreliable — real .ass
// (Advanced SubStation Alpha, common for fansub "full"/styled tracks) files
// have been observed reported as "srt", which then gets fed through the
// SRT→VTT converter and produces garbage no browser can parse into cues
// (the track exists in the DOM, but nothing ever renders). The file
// extension is ground truth; the reported format is only a fallback for
// when the URL has no recognizable extension.
function detectSubtitleFormat(reportedFormat: string | undefined, fileUrl: string): "srt" | "vtt" | "ass" {
  const ext = fileUrl.toLowerCase().match(/\.(vtt|srt|ass|ssa)(?:\?|$)/)?.[1];
  if (ext === "vtt") return "vtt";
  if (ext === "ass" || ext === "ssa") return "ass";
  if (ext === "srt") return "srt";
  return reportedFormat === "vtt" ? "vtt" : reportedFormat === "ass" ? "ass" : "srt";
}

export type ParsedAnizoneVideo = {
  src: string;
  storyboardUrl: string | null;
  chaptersUrl: string | null;
  subtitles: ParsedAnizoneSubtitle[];
};

// Every anime/{slug}/{n} episode page embeds the actual playback info as
// `vidstackPlayer(JSON.parse('...'))` in an Alpine x-data attribute — no
// separate API call needed, a plain fetch of the page is enough. Same
// double-escaping scheme as the episode list (see js-string-literal.util.ts).
const VIDEO_OBJECT_PATTERN = /vidstackPlayer\(JSON\.parse\('((?:\\.|[^'\\])*)'\)\)/;

type RawAnizoneVideoObject = {
  src?: string;
  storyboard?: string | null;
  chapter?: string | null;
  subtitles?: Array<{
    title?: string;
    language?: string;
    format?: string;
    file?: string;
    default?: boolean;
    forced?: string | boolean;
  }> | null;
};

export function parseVideoObject(html: string): ParsedAnizoneVideo | null {
  const match = html.match(VIDEO_OBJECT_PATTERN);
  if (!match) return null;

  let raw: RawAnizoneVideoObject;
  try {
    raw = JSON.parse(decodeJsStringLiteral(match[1]));
  } catch {
    return null;
  }
  if (!raw.src) return null;

  return {
    src: raw.src,
    storyboardUrl: raw.storyboard ?? null,
    chaptersUrl: raw.chapter ?? null,
    subtitles: (raw.subtitles ?? [])
      .filter((s) => Boolean(s.title && s.language && s.file))
      .map((s) => ({
        title: s.title!,
        language: s.language!,
        format: detectSubtitleFormat(s.format, s.file!),
        url: s.file!,
        default: s.default === true,
        forced: s.forced === true || s.forced === "yes",
      })),
  };
}
