/**
 * Converts SRT to WebVTT. HTML5 <track> only accepts VTT, but these sources
 * ship SRT. The two formats differ only in the decimal separator in
 * timestamps and the leading "WEBVTT" header — cue-number lines are valid
 * (and ignored) in VTT too, so they don't need stripping.
 */
export function srtToVtt(srt: string): string {
  const body = srt.replace(/\r\n/g, "\n").replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}`;
}

function parseAssTimestamp(ts: string): number {
  // ASS timestamps are H:MM:SS.cc (centiseconds, single-digit hours).
  const m = ts.trim().match(/^(\d+):(\d{2}):(\d{2})\.(\d{2})$/);
  if (!m) return 0;
  const [, h, mm, ss, cc] = m;
  return Number(h) * 3600 + Number(mm) * 60 + Number(ss) + Number(cc) / 100;
}

function formatVttTimestamp(totalSeconds: number): string {
  const clamped = Math.max(0, totalSeconds);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

// Strips ASS override blocks ({\...}) and converts its line-break escapes to
// real newlines — enough to get plain readable text on screen. Positioning,
// karaoke timing, and styling have no WebVTT equivalent and aren't
// reproduced, same trade-off any "just extract the text" ASS consumer makes.
function cleanAssText(text: string): string {
  return text
    .replace(/\{[^}]*\}/g, "")
    .replace(/\\N/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\h/g, " ")
    .trim();
}

/**
 * Converts Advanced SubStation Alpha (.ass/.ssa) to WebVTT by extracting the
 * plain dialogue text and timing from each [Events] "Dialogue:" line — the
 * <track> element only understands VTT, and ASS isn't line-compatible with
 * SRT the way srtToVtt's regex swap handles, so this needs its own parser.
 */
export function assToVtt(ass: string): string {
  const lines = ass.replace(/\r\n/g, "\n").split("\n");

  let inEvents = false;
  let format: string[] | null = null;
  const cues: { start: number; end: number; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^\[Events\]/i.test(trimmed)) {
      inEvents = true;
      continue;
    }
    if (/^\[/.test(trimmed)) {
      inEvents = false;
      continue;
    }
    if (!inEvents) continue;

    if (/^Format:/i.test(trimmed)) {
      format = trimmed
        .slice(trimmed.indexOf(":") + 1)
        .split(",")
        .map((f) => f.trim().toLowerCase());
      continue;
    }
    if (!format || !/^Dialogue:/i.test(trimmed)) continue;

    const startIdx = format.indexOf("start");
    const endIdx = format.indexOf("end");
    const textIdx = format.indexOf("text");
    if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;

    // Text is always the last declared field and can itself contain commas,
    // so only the fields before it are split — everything from there on
    // (however many commas remain) is rejoined back into the text.
    const fields = trimmed.slice(trimmed.indexOf(":") + 1).split(",");
    const head = fields.slice(0, textIdx);
    const text = fields.slice(textIdx).join(",");

    const start = parseAssTimestamp(head[startIdx] ?? "");
    const end = parseAssTimestamp(head[endIdx] ?? "");
    const cleaned = cleanAssText(text);
    if (!cleaned || end <= start) continue;

    cues.push({ start, end, text: cleaned });
  }

  const body = cues
    .map((cue) => `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${cue.text}`)
    .join("\n\n");

  return `WEBVTT\n\n${body}`;
}

export type FetchableSubtitle = { url: string; format: "srt" | "vtt" | "ass" };

/**
 * Fetches a subtitle file and returns an object URL to a VTT Blob suitable
 * for a <track src>. Always goes through a Blob (even for already-VTT files)
 * so callers have one uniform, revocable URL to manage regardless of source format.
 */
export async function fetchSubtitleAsVttUrl(track: FetchableSubtitle): Promise<string> {
  const raw = await fetch(track.url).then((res) => res.text());
  const vtt = track.format === "srt" ? srtToVtt(raw) : track.format === "ass" ? assToVtt(raw) : raw;
  return URL.createObjectURL(new Blob([vtt], { type: "text/vtt" }));
}
