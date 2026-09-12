import { ApiClient, LocalStorageTokenStore } from "@streaming/api-client";

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const apiClient = new ApiClient(baseUrl, new LocalStorageTokenStore());

// AniZone's video CDN only sends Access-Control-Allow-Origin: https://anizone.to,
// so the browser blocks every direct fetch/hls.js request from our own origin —
// curl and other non-browser tools don't enforce CORS at all, which is why this
// only shows up here. Routing through our own API sidesteps it (server-to-server
// fetches aren't CORS-restricted); see apps/api/src/discovery/anizone-proxy.*.
// Only wrap actual AniZone/vid-cdn URLs — a future real source (Crunchyroll) may
// not need this at all, so this stays a no-op for anything else.
export function toPlayableUrl(url: string): string {
  if (!/vid-cdn\.xyz/i.test(url)) return url;
  return `${baseUrl}/discovery/anizone/proxy?url=${encodeURIComponent(url)}`;
}
