// Mirrors apps/web/src/lib/apiClient.ts's VITE_API_BASE_URL default. Angular has
// no import.meta.env by default here, so this is a plain constant — override by
// editing this file (or wiring Angular file-replacement environments later).
export const API_BASE_URL = 'https://animer2.onrender.com';

// AniZone's video CDN only sends Access-Control-Allow-Origin: https://anizone.to,
// so the browser blocks every direct fetch/hls.js request from our own origin.
// Routing through our own API sidesteps it. See apps/api/src/discovery/anizone-proxy.*.
export function toPlayableUrl(url: string): string {
  if (!/vid-cdn\.xyz/i.test(url)) return url;
  return `${API_BASE_URL}/discovery/anizone/proxy?url=${(url)}`;
}
