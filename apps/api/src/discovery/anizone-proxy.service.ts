import { BadRequestException, Injectable } from "@nestjs/common";

// Only AniZone's own video CDN may be fetched through this proxy — without
// this allowlist, an open "fetch whatever url the client passes" endpoint is
// a classic SSRF hole (probing internal services, cloud metadata endpoints, etc).
const ALLOWED_HOST_SUFFIXES = [".vid-cdn.xyz"];

const PLAYLIST_PATTERN = /\.m3u8(\?|$)/i;

export type ProxiedResponse = {
  status: number;
  contentType: string;
  extraHeaders: Record<string, string>;
  body: string | ArrayBuffer;
};

@Injectable()
export class AnizoneProxyService {
  validateUrl(rawUrl: string | undefined): URL {
    if (!rawUrl) throw new BadRequestException("Missing url query parameter");
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new BadRequestException("Invalid url");
    }
    if (!ALLOWED_HOST_SUFFIXES.some((suffix) => url.hostname.endsWith(suffix))) {
      throw new BadRequestException("URL host is not an allowed AniZone media host");
    }
    return url;
  }

  buildProxyPath(target: string): string {
    return `/discovery/anizone/proxy?url=${encodeURIComponent(target)}`;
  }

  // The video CDN only sends Access-Control-Allow-Origin: https://anizone.to,
  // so browsers block every direct fetch from our app's origin (curl/server-side
  // fetch don't enforce CORS at all — that's a browser-only check — which is why
  // this "worked" from the command line but not from the player). Proxying
  // through our own API sidesteps that: the browser only ever talks to us.
  async fetch(url: URL, rangeHeader: string | undefined): Promise<ProxiedResponse> {
    const upstream = await fetch(url.toString(), {
      headers: rangeHeader ? { range: rangeHeader } : undefined,
    });

    const isPlaylist = PLAYLIST_PATTERN.test(url.pathname) || (upstream.headers.get("content-type") ?? "").includes("mpegurl");

    if (isPlaylist) {
      const text = await upstream.text();
      return {
        status: upstream.status,
        contentType: "application/vnd.apple.mpegurl",
        extraHeaders: {},
        body: this.rewritePlaylist(text, url),
      };
    }

    const extraHeaders: Record<string, string> = {};
    const contentRange = upstream.headers.get("content-range");
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (contentRange) extraHeaders["content-range"] = contentRange;
    if (acceptRanges) extraHeaders["accept-ranges"] = acceptRanges;

    return {
      status: upstream.status,
      contentType: upstream.headers.get("content-type") ?? "application/octet-stream",
      extraHeaders,
      body: await upstream.arrayBuffer(),
    };
  }

  // HLS playlists reference other playlists, segments, and encryption keys by
  // URL (absolute or relative to the playlist itself) — every one of those is
  // its own cross-origin request hls.js makes directly, so every one has to be
  // rewritten to go through this same proxy, recursively, or playback stalls
  // the moment it needs the first segment.
  private rewritePlaylist(text: string, baseUrl: URL): string {
    return text
      .split("\n")
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return line;

        if (trimmed.startsWith("#")) {
          // e.g. #EXT-X-KEY:METHOD=AES-128,URI="keys/abc.key",IV=...
          return line.replace(/URI="([^"]+)"/, (_match, uri: string) => {
            const absolute = new URL(uri, baseUrl).toString();
            return `URI="${this.buildProxyPath(absolute)}"`;
          });
        }

        // A bare URI line: a sub-playlist or segment reference.
        const absolute = new URL(trimmed, baseUrl).toString();
        return this.buildProxyPath(absolute);
      })
      .join("\n");
  }
}
