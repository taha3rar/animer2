# PrivateFlix — Angular client

The active frontend going forward — `apps/web` (React) is no longer being
developed and is kept only for reference; all frontend work happens here.

Still shares the framework-agnostic pieces with the (frozen) React app:

```text
packages/types    shared TS types (API <-> clients)
packages/player    PlayerAdapter interface + Html5PlayerAdapter, chapters/
                   storyboard/subtitle VTT parsing — framework-agnostic
```

It does **not** use `packages/api-client` (the shared fetch-based ApiClient) —
this app talks to the API through Angular's own `HttpClient` instead (see
`core/api.service.ts` and `core/auth.interceptor.ts` below), for proper DI,
interceptor-based token refresh, and testability. `packages/api-client`
still exists only because `apps/web` (React) depends on it.

Angular-specific code (`src/app/`):

```text
core/            ApiService (HttpClient-based, mirrors the old ApiClient's
                 method surface), AuthService, TokenService (localStorage),
                 auth.interceptor (attaches the bearer token, refreshes on
                 401 — one shared in-flight refresh, then retries once),
                 ProfileService (persisted active profile), API base URL config
tv/              spatial navigation (ported from apps/web/src/tv-navigation,
                 plain DOM — no framework dependency to port), the
                 FocusableDirective, TvNavigationService (remote/keyboard
                 D-pad + Back key), autoFocus helper
guards/          authGuard, profileGuard (route guards mirroring
                 RequireAuth/RequireProfile)
components/      RowComponent, ContentCardComponent, AnizoneResultCardComponent,
                 AnizonePreviewModalComponent (the one series-detail surface —
                 there is no separate series page/route)
pages/           LoginPage, ProfileSelectPage, HomePage, PlayerPage
```

Every component/page is split into `.ts` + `.html` + `.scss` (no inline
`template`/`styles` in the `@Component` decorator) — keep new ones the same
way. Shared cross-component visuals (`.card`, `.row`, `.hero`, `.episode-row`,
etc.) live in the global `src/styles.scss`; a component's own `.scss` is for
that component's own layout tweaks only.

Uses Angular's hash location strategy (`withHashLocation()`) for the same
reason `apps/web` uses `HashRouter`: the webOS build is static files with no
server-side rewrites.

## Running

```bash
npm run dev:web-angular   # from repo root — http://localhost:4200
```

The API must be running (`npm run dev:api`) and seeded (see repo root
README) — login with the same seeded email/password.

## LG webOS packaging

The same static build is what runs on the TV (webOS's video element is plain
HTML5 `<video>`, same as the browser dev build):

```bash
npm run package:webos --workspace=apps/web-angular
```

This builds for production and assembles `apps/web-angular/webos-dist/`
(the built app + `webos/appinfo.json` + icons). From there, with LG's
`ares-cli` installed and Dev Mode enabled on the TV (see requirements.md
section 2 in the repo root for the one-time TV setup):

```bash
ares-package webos-dist
ares-install <the .ipk> -d <device name from ares-setup-device>
```

`webos/icon.png` / `webos/largeIcon.png` are solid-color placeholders —
swap them for real artwork before shipping to the TV.
