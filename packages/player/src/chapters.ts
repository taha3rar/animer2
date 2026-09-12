import { parseVttCues } from "./vtt";

export type Chapter = { start: number; end: number; title: string };

export function parseChapters(vttText: string): Chapter[] {
  return parseVttCues(vttText).map((cue) => ({ start: cue.start, end: cue.end, title: cue.text }));
}

export type IntroRange = { start: number; end: number };

export type IntroOverride = {
  introStartSeconds?: number | null;
  introEndSeconds?: number | null;
};

// Matches chapter titles like "Opening", "OP", "OP2", "Intro" / "Ending",
// "ED", "ED2", "Outro" — sources label these inconsistently, so title
// matching is tried first and only falls back to the duration/position
// heuristics below when nothing matches (e.g. AniZone's plain, untitled
// "Chapter 1/2/3..." files).
const OPENING_TITLE_PATTERN = /\b(opening|op\d*|intro)\b/i;
const ENDING_TITLE_PATTERN = /\b(ending|ed\d*|outro)\b/i;

// Real intros/outros run up to about a minute and a half.
const OPENING_MAX_DURATION_SECONDS = 90;
// ... and an ending chapter never starts before this point.
const ENDING_MIN_START_SECONDS = 15 * 60;

function findByTitle(chapters: Chapter[], pattern: RegExp): Chapter | undefined {
  return chapters.find((c) => pattern.test(c.title.trim()));
}

/**
 * Resolves the Skip Intro range. A DB override always wins — for the rare
 * episode with a cold open or an unusual chapter layout — otherwise prefers
 * a chapter titled like "Opening"/"OP"/"Intro" wherever it falls (some
 * sources put a "Prologue" cold-open chapter before it), and only falls
 * back to "the first chapter, if it's short enough to plausibly be an OP"
 * when no chapter title gives it away.
 */
export function resolveIntroRange(chapters: Chapter[], override?: IntroOverride | null): IntroRange | null {
  if (override?.introStartSeconds != null && override?.introEndSeconds != null) {
    return { start: override.introStartSeconds, end: override.introEndSeconds };
  }
  const opening = findByTitle(chapters, OPENING_TITLE_PATTERN);
  if (opening) return { start: opening.start, end: opening.end };

  const first = chapters[0];
  if (first && first.end - first.start <= OPENING_MAX_DURATION_SECONDS) {
    return { start: first.start, end: first.end };
  }

  return null;
}

export type EndingRange = { start: number };

/**
 * Resolves the point past which a "Next Episode" prompt should show —
 * prefers a chapter titled like "Ending"/"ED"/"Outro", falling back to the
 * first chapter starting past the 15-minute mark when chapter titles are
 * generic (AniZone's plain "Chapter 1/2/3..." files).
 */
export function resolveEndingRange(chapters: Chapter[]): EndingRange | null {
  const ending = findByTitle(chapters, ENDING_TITLE_PATTERN);
  if (ending) return { start: ending.start };

  const fallback = chapters.find((c) => c.start >= ENDING_MIN_START_SECONDS);
  return fallback ? { start: fallback.start } : null;
}
