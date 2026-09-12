// Chapters cover the full episode, so the last cue's end timestamp is a good
// stand-in for episode duration until the real HLS stream is loaded (the player
// reads the actual duration from the stream at playback time regardless —
// this is just what gets stored on the Episode record).
const TIMESTAMP_PATTERN = /(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/g;

function toSeconds(hours: string | undefined, minutes: string, seconds: string, millis: string): number {
  return (hours ? Number(hours) * 3600 : 0) + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000;
}

export function estimateDurationFromVtt(vttText: string): number {
  let maxEnd = 0;
  for (const match of vttText.matchAll(TIMESTAMP_PATTERN)) {
    const [, , , , , endHours, endMinutes, endSeconds, endMillis] = match;
    const end = toSeconds(endHours, endMinutes, endSeconds, endMillis);
    if (end > maxEnd) maxEnd = end;
  }
  return Math.round(maxEnd);
}
