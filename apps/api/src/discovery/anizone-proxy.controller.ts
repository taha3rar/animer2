import { Controller, Get, Headers, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { AnizoneProxyService } from "./anizone-proxy.service";

// Deliberately NOT behind JwtAuthGuard: hls.js and the player's own fetch()
// calls hit this URL directly (not through ApiClient), so they never attach a
// bearer token. Safe to leave public — AnizoneProxyService only forwards to an
// allowlisted CDN host, and the underlying media is unauthenticated on AniZone
// itself too (anyone with the URL can already play it directly).
@Controller("discovery/anizone")
export class AnizoneProxyController {
  constructor(private readonly proxyService: AnizoneProxyService) {}

  @Get("proxy")
  async proxy(@Query("url") rawUrl: string | undefined, @Headers("range") range: string | undefined, @Res() res: Response) {
    const url = this.proxyService.validateUrl(rawUrl);
    const result = await this.proxyService.fetch(url, range);

    res.status(result.status);
    res.set("content-type", result.contentType);
    for (const [key, value] of Object.entries(result.extraHeaders)) {
      res.set(key, value);
    }

    if (typeof result.body === "string") {
      res.send(result.body);
    } else {
      res.send(Buffer.from(result.body));
    }
  }
}
