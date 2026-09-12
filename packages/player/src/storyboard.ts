import { parseVttCues } from "./vtt";

export type StoryboardCue = {
  start: number;
  end: number;
  imageUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

const CUE_TEXT_PATTERN = /^(.+?)#xywh=(\d+),(\d+),(\d+),(\d+)$/;

/**
 * storyboard.vtt cue text looks like "storyboard.webp#xywh=180,0,180,135" — a
 * filename relative to the VTT file itself, plus the crop rect for that
 * timestamp's thumbnail inside the sprite sheet.
 */
export function parseStoryboard(vttText: string, baseUrl: string): StoryboardCue[] {
  const cues: StoryboardCue[] = [];

  for (const cue of parseVttCues(vttText)) {
    const match = cue.text.match(CUE_TEXT_PATTERN);
    if (!match) continue;
    const [, file, x, y, width, height] = match;
    cues.push({
      start: cue.start,
      end: cue.end,
      imageUrl: new URL(file, baseUrl).toString(),
      x: Number(x),
      y: Number(y),
      width: Number(width),
      height: Number(height),
    });
  }

  return cues;
}

export function findStoryboardCue(cues: StoryboardCue[], time: number): StoryboardCue | undefined {
  return cues.find((cue) => time >= cue.start && time < cue.end) ?? cues[cues.length - 1];
}
