import { Injectable } from "@nestjs/common";
import { parseVideoObject, ParsedAnizoneSubtitle } from "./anizone-video.parser";
import { estimateDurationFromVtt } from "./vtt-duration.util";

const ANIZONE_BASE_URL = "https://anizone.to/anime";

export type AnizoneEpisodeVideo = {
  videoUrl: string;
  chaptersUrl: string | null;
  storyboardUrl: string | null;
  subtitles: ParsedAnizoneSubtitle[];
  durationSeconds: number;
};

@Injectable()
export class AnizoneVideoService {
  // The playback info (HLS src, chapters, storyboard, subtitles) is embedded
  // directly in the episode page's server-rendered HTML — no Livewire
  // interaction needed here, so a plain fetch is enough (see anizone-video.parser.ts).
  async getEpisodeVideo(slug: string, episodeNumber: number): Promise<AnizoneEpisodeVideo | null> {
    const res = await fetch(`${ANIZONE_BASE_URL}/${slug}/${episodeNumber}`);
    if (!res.ok) return null;

    const html = await res.text();
    const video = parseVideoObject(html);
    if (!video) return null;

    const durationSeconds = video.chaptersUrl ? await this.estimateDuration(video.chaptersUrl) : 0;

    return {
      videoUrl: video.src,
      chaptersUrl: video.chaptersUrl,
      storyboardUrl: video.storyboardUrl,
      subtitles: video.subtitles,
      durationSeconds,
    };
  }

  private async estimateDuration(chaptersUrl: string): Promise<number> {
    try {
      const res = await fetch(chaptersUrl);
      if (!res.ok) return 0;
      return estimateDurationFromVtt(await res.text());
    } catch {
      return 0;
    }
  }
}
