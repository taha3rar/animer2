# Private Streaming App

See [project.md](project.md) for the original architecture doc and
[requirements.md](requirements.md) for what's needed from you as this evolves.

Monorepo (npm workspaces):

```text
apps/
  api/          NestJS + Mongoose + MongoDB backend
  web-angular/  THE frontend — Angular. Runs in a browser for dev, and is what
                gets packaged for LG webOS (webOS's player is just HTML5
                <video>). See apps/web-angular/README.md
  web/          React/Vite TV UI — frozen, kept for reference only. Not
                developed further; all frontend work happens in web-angular.
packages/
  types/       shared TS types (API <-> clients)
  player/      PlayerAdapter interface + Html5PlayerAdapter (framework-agnostic,
               used by both clients)
  api-client/  typed fetch wrapper — only apps/web (React) still uses this;
               apps/web-angular uses Angular's own HttpClient instead
```

## Database: MongoDB

Plain standalone MongoDB — no replica set, no Docker needed. This machine already
has MongoDB Server installed as a Windows service on port 27017; `apps/api/.env`'s
`DATABASE_URL` points at it directly (`mongodb://localhost:27017/streaming`).

(Earlier revisions of this project used Prisma, which needs Mongo running as a
replica set purely for its internal transaction use on upserts — that's why you
may see references to a throwaway single-node-replica-set mongod on port 27018 in
git history. Once the backend moved to Mongoose, that requirement went away
entirely, so there's nothing special to set up.)

## First-time setup

```bash
npm install

cp apps/api/.env.example apps/api/.env
npm run --workspace=apps/api seed   # creates a login + a few placeholder episodes/movie

cp apps/web/.env.example apps/web/.env

# build the shared packages once (and again whenever you edit packages/*)
npm run build --workspace=packages/types --workspace=packages/player --workspace=packages/api-client
```

## Running

```bash
npm run dev:api           # http://localhost:3000
npm run dev:web           # http://localhost:5173 (React)
npm run dev:web-angular   # http://localhost:4200 (Angular)
```

The seed script prints the login email/password and profile names it created —
use those on the login screen.

## Notes

- Web app uses `HashRouter` on purpose: the eventual webOS build is static files
  with no server-side rewrites.
- TV remote navigation is a small custom spatial-navigation implementation
  (`apps/web/src/tv-navigation`) — arrow keys move focus between elements tagged
  `data-focusable="true"` (the `<Focusable>` component sets this), Enter activates
  via native button semantics, Backspace/Escape/webOS "GoBack" navigates back.
- Seeded content uses public-domain sample clips just to exercise playback,
  progress-saving, skip-intro, and next/previous episode end to end — see
  requirements.md, section 3, for swapping in real media.
- MongoDB has no DB-level cascading deletes and, unlike Postgres, treats multiple
  documents with the same missing/null field as duplicates under a unique index —
  see the notes in `apps/api/src/database/schemas/*.schema.ts` for where that
  changed how a couple of things (profile deletion cleanup, "only one of
  episodeId/movieId" uniqueness) had to be handled in the service layer instead of
  at the DB level.
