import { Injectable } from "@nestjs/common";

const ANIMEHEAVEN_BASE_URL = "https://animeheaven.me";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

// AnimeHeaven doesn't expose a per-episode video URL directly — clicking an
// episode runs `gatea(hash)`, which sets a `key=<hash>` cookie client-side,
// then navigates to gate.php. gate.php reads that cookie server-side and
// renders a fresh, freshly-signed <source src=...> URL (a session token, not
// derivable from the hash alone) — so resolving a playable URL means
// replicating exactly that: set the cookie, fetch gate.php, parse the result.
// No browser/JS execution needed since gate.php's own response is plain HTML.
@Injectable()
export class AnimeheavenVideoService {
  async resolveVideoUrl(hash: string, refererSlug: string): Promise<string | null> {
    const res = await fetch(`${ANIMEHEAVEN_BASE_URL}/gate.php`, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: `key=${hash}`,
        Referer: `${ANIMEHEAVEN_BASE_URL}/anime.php?${refererSlug}`,
      },
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/<source src='([^']+)' type='video\/mp4'/);
    return match ? match[1] : null;
  }
}
