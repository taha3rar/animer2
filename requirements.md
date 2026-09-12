# What I need from you

Nothing here blocks me from starting — I'm scaffolding the backend, database, and the
shared web/TV client right after this file, using the defaults listed under "Decisions
I'm making now" below. Fill in the real answers whenever, I'll adjust.

## 1. Tools on your dev machine

- [x] Node.js 22 (already installed)
- [x] npm 10 (already installed) — using npm workspaces instead of pnpm since pnpm
      isn't installed and npm workspaces need nothing extra. Say the word if you'd
      rather I install pnpm globally.
- [x] MongoDB Server — already installed on this machine as a Windows service and
      running on `localhost:27017`, used directly, no extra setup needed. (Docker was
      the original plan for the DB but was a dead end: Docker Desktop needs WSL2 →
      "Virtual Machine Platform" + BIOS virtualization, neither on. Landed on
      MongoDB per your call. There was a brief detour through a throwaway
      replica-set Mongo instance on port 27018 while the backend used Prisma, since
      Prisma needs Mongo transactions for upserts — that need went away once the
      backend moved from Prisma to Mongoose, per your request in the other session,
      so it's back to the plain standalone service on 27017 now.)
- [x] Git (already installed) — I'll init a local repo so we get history/checkpoints

## 2. LG TV — Developer Mode

Not needed yet (only required once we package the app onto the actual TV), but do this
whenever convenient so it's ready:

- Install the **Developer Mode** app from the LG Content Store on the TV
- Create a free LG webOS developer account at developer.lge.com and sign into it from
  the Developer Mode app on the TV
- Enable Dev Mode on the TV, note the **TV's local IP address**
- Make sure the TV and your dev PC are on the same LAN/Wi-Fi

## 3. Test media

Content acquisition is intentionally out of scope of the app itself, but I need
something playable to build/test the player against (progress saving, skip intro,
next/previous episode, resume). Two options — tell me which:

- **Point me at real files** — a folder path with a couple of episodes (mp4, h264/aac
  ideally — anything else and the browser/webOS player may not play it directly), plus
  optionally a `.vtt` subtitle file
- **Use a placeholder** — I wire up a couple of public domain test videos (e.g. Big Buck
  Bunny / Sintel) as fake "episodes" just so the player/progress/skip-intro logic is
  provable end to end. Swap in real content later.

**Default if you don't answer: I'll go with the placeholder option so nothing blocks.**

## 4. Where the backend runs long-term

For dev it'll run on this PC. For actual daily use, the TV needs to reach it over the
LAN at all times, so it needs to live somewhere that's always on:

- This PC (if it stays on)
- A NAS
- A Raspberry Pi or similar always-on box
- Something else

Doesn't block anything now — only matters once we're deploying instead of developing.

## 5. Account / profiles to seed

I'll seed one account with a placeholder email/password and a few profiles (Taha /
Amar / Maryam) so there's something to log into. Tell me real names/emails whenever,
or just change the password yourself later — nothing about this is precious data.

## 6. Scope decisions I'm making now (say something if you disagree)

- **Android TV client is deprioritized.** I'm building the shared web/TV UI first — it
  runs in an ordinary browser for dev, and it's *also* what eventually gets packaged for
  webOS, since webOS's video player is just HTML5 `<video>`. Android TV (Media3 /
  ExoPlayer, Kotlin) comes after the backend + webOS/web flow is solid end to end.
- **Backend:** NestJS on **MongoDB** instead of PostgreSQL (your call, see above),
  using **Mongoose** (also your call — replaced Prisma after you weren't a fan). A
  couple of uniqueness checks live in the service layer instead of DB constraints
  (MongoDB treats multiple missing/null fields as duplicate keys under a unique
  index, unlike Postgres, so a couple of "only one of episodeId/movieId is set"
  constraints couldn't be DB-level unique indexes) — see the notes in
  `apps/api/src/database/schemas/*.schema.ts`.
- **Monorepo:** npm workspaces (not pnpm, see above).
- **Auth:** JWT access token (short-lived) + refresh token (long-lived, stored on
  device) per your doc, so the TV doesn't need re-login constantly.
