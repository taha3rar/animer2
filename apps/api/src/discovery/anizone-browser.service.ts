import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import puppeteer, { Browser } from "puppeteer";

// Keeps one headless browser warm for the lifetime of the process instead of
// paying puppeteer's multi-second launch cost on every AniZone search.
@Injectable()
export class AnizoneBrowserService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnizoneBrowserService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleInit() {
    try {
      await this.getBrowser();
    } catch (err) {
      // Don't crash API boot if AniZone is briefly unreachable — retried lazily on first search.
      this.logger.warn(
        `Failed to launch AniZone browser on startup, will retry on first search: ${
          err instanceof Error ? err.message : err
        }`
      );
    }
  }

  async onModuleDestroy() {
    await this.browser?.close().catch(() => {});
  }

  async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;

    if (!this.launching) {
      this.launching = puppeteer
        .launch({ headless: true })
        .then((browser) => {
          this.browser = browser;
          browser.once("disconnected", () => {
            if (this.browser === browser) this.browser = null;
          });
          return browser;
        })
        .finally(() => {
          this.launching = null;
        });
    }

    return this.launching;
  }
}
