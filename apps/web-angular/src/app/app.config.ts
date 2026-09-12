import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withHashLocation } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';

// HashRouter-equivalent on purpose, same as apps/web: the eventual webOS build
// is static files with no server-side rewrites.
//
// Zoneless (no zone.js) rather than provideZoneChangeDetection: zone.js
// monkey-patches Promise/event-dispatch internals in ways that crashed
// outright on the TV's older embedded Chromium (webOS 6, ~Chromium 79) —
// "Class constructor cannot be invoked without 'new'" from zone.js's own
// patched event dispatch. The app is already signals-based throughout, which
// is what zoneless change detection schedules off natively.
export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
