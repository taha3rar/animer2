export type VttCue = { start: number; end: number; text: string };

// Accepts WebVTT's "HH:MM:SS.mmm" or "MM:SS.mmm" timestamp forms.
function parseVttTimestamp(raw: string): number {
  const match = raw.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/);
  if (!match) return NaN;
  const [, hours, minutes, seconds, millis] = match;
  return (
    (hours ? Number(hours) * 3600 : 0) + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000
  );
}

/**
 * Minimal WebVTT cue parser — enough for the plain cue files these sources
 * serve (chapters, storyboards): no cue settings, no nested markup, no NOTE
 * blocks needed. Every downstream consumer (chapters.ts, storyboard.ts) reads
 * a cue's text differently, so parsing stays generic here.
 */
export function parseVttCues(vttText: string): VttCue[] {
  const cues: VttCue[] = [];
  const blocks = vttText.replace(/\r\n/g, "\n").split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.split("\n").filter((line) => line.trim().length > 0);
    const timingLineIndex = lines.findIndex((line) => line.includes("-->"));
    if (timingLineIndex === -1) continue;

    const [startRaw, endRaw] = lines[timingLineIndex]
      .split("-->")
      .map((part) => part.trim().split(" ")[0]);
    const start = parseVttTimestamp(startRaw);
    const end = parseVttTimestamp(endRaw);
    if (Number.isNaN(start) || Number.isNaN(end)) continue;

    cues.push({ start, end, text: lines.slice(timingLineIndex + 1).join("\n").trim() });
  }

  return cues;
}
