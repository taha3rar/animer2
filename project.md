# Private Streaming App — Initial Architecture

## 1. Goal

Build a private Netflix-style streaming application with a shared backend and client apps for:

* Android TV / Xiaomi TV Stick
* LG webOS TV
* Potential future web/mobile clients

For now, the media source itself is intentionally out of scope.

The first version should focus on:

* Authentication
* Multiple user profiles
* Continue Watching
* Playback progress
* Favorites
* Watchlist
* Viewing history
* User/profile preferences
* Episode navigation
* Netflix-style playback controls
* Skip Intro
* Resume playback
* Next / Previous episode

---

# 2. High-Level Architecture

```text
                    ┌─────────────────────┐
                    │      Backend API    │
                    │                     │
                    │ Auth                │
                    │ Profiles            │
                    │ Library Metadata    │
                    │ Progress            │
                    │ Watchlist           │
                    │ Favorites           │
                    │ Preferences         │
                    └──────────┬──────────┘
                               │
                               │
                     ┌─────────▼─────────┐
                     │     Database      │
                     │      MongoDB      │
                     └───────────────────┘


         ┌──────────────────┐      ┌──────────────────┐
         │   Android TV     │      │     LG webOS     │
         │                  │      │                  │
         │ Shared TV UI     │      │ Shared TV UI     │
         │ Media3 Player    │      │ HTML5 Player     │
         └──────────────────┘      └──────────────────┘
```

---

# 3. Suggested Tech Stack

## Frontend

Shared application logic:

```text
React
TypeScript
TanStack Query
Zustand
```

Possible structure:

```text
/apps
    /android-tv
    /webos

/packages
    /ui
    /player
    /api-client
    /types
    /utils
```

The goal is to share as much code as possible between TV platforms.

Platform-specific functionality should live behind adapters.

Example:

```ts
interface PlayerAdapter {
  play(): Promise<void>;
  pause(): Promise<void>;

  seekTo(seconds: number): Promise<void>;
  seekBy(seconds: number): Promise<void>;

  getCurrentTime(): number;
  getDuration(): number;

  setSubtitleTrack(trackId: string | null): Promise<void>;
  setAudioTrack(trackId: string): Promise<void>;
}
```

Implementations:

```text
AndroidPlayerAdapter
    ↓
Media3 / ExoPlayer

WebOSPlayerAdapter
    ↓
HTML5 video / webOS APIs
```

---

# 4. Backend

Suggested stack:

```text
Node.js
NestJS
MongoDB
Prisma
```

The backend should be responsible for:

* Accounts
* Authentication
* Profiles
* Content metadata
* Seasons
* Episodes
* Progress
* Continue Watching
* History
* Favorites
* Watchlist
* Preferences

The backend should **not** contain platform-specific playback logic.

---

# 5. Authentication Model

An account represents the household.

Example:

```text
Account
    Taha
        Profile: Taha
        Profile: Wife
        Profile: Maryam
```

Login should happen at the account level.

Profiles exist underneath an account.

Example flow:

```text
Open app
    ↓
Already authenticated?
    ↓
Yes
    ↓
Choose Profile
```

If authentication expires:

```text
Open app
    ↓
Login
    ↓
Choose Profile
```

---

# 6. Database

MongoDB (see requirements.md — this was originally scoped as PostgreSQL, but the
actual build uses MongoDB only; the `sql` blocks below are schema shape, not literal
SQL).

---

## User

Represents the account owner.

```sql
users

id                  uuid PK
email               varchar unique
password_hash       varchar
display_name        varchar
created_at          timestamp
updated_at          timestamp
last_login_at       timestamp nullable
```

---

## Profile

Netflix-style individual profile.

```sql
profiles

id                  uuid PK
user_id             uuid FK -> users.id

name                varchar
avatar_url          varchar nullable

is_kids_profile     boolean default false
pin_hash            varchar nullable

created_at          timestamp
updated_at          timestamp
```

---

# 7. Profile Preferences

Preferences belong to the profile rather than the main account.

```sql
profile_preferences

id                      uuid PK
profile_id               uuid FK -> profiles.id unique

preferred_audio_language varchar nullable
preferred_subtitle_language varchar nullable

subtitles_enabled        boolean default false

autoplay_next_episode    boolean default true

skip_seconds_forward     integer default 10
skip_seconds_backward    integer default 10

default_playback_speed   decimal default 1.0

created_at               timestamp
updated_at               timestamp
```

Possible future preferences:

```text
subtitle size
subtitle color
subtitle background
audio normalization
default quality
HDR preference
autoplay previews
UI language
```

---

# 8. Content Structure

Basic hierarchy:

```text
Series
  └── Season
        └── Episode

Movie
```

---

## Series

```sql
series

id                  uuid PK

title               varchar
description         text nullable

poster_url          varchar nullable
backdrop_url        varchar nullable

release_year        integer nullable

created_at          timestamp
updated_at          timestamp
```

---

## Seasons

```sql
seasons

id                  uuid PK
series_id           uuid FK -> series.id

season_number       integer
title               varchar nullable

poster_url          varchar nullable

created_at          timestamp
updated_at          timestamp
```

Unique constraint:

```text
series_id + season_number
```

---

## Episodes

```sql
episodes

id                  uuid PK
season_id           uuid FK -> seasons.id

episode_number      integer

title               varchar
description         text nullable

duration_seconds    integer

thumbnail_url       varchar nullable

intro_start_seconds integer nullable
intro_end_seconds   integer nullable

credits_start_seconds integer nullable

created_at          timestamp
updated_at          timestamp
```

Example:

```text
Episode duration:
1440 seconds

Intro:
0 → 80 seconds

intro_start_seconds = 0
intro_end_seconds = 80
```

The player can therefore perform:

```ts
seekTo(episode.introEndSeconds);
```

---

# 9. Movies

Movies should be their own entity instead of pretending they are episodes.

```sql
movies

id                  uuid PK

title               varchar
description         text nullable

duration_seconds    integer

poster_url          varchar nullable
backdrop_url        varchar nullable

release_year        integer nullable

intro_start_seconds integer nullable
intro_end_seconds   integer nullable

credits_start_seconds integer nullable

created_at          timestamp
updated_at          timestamp
```

---

# 10. Playback Progress

Progress should be saved per **profile**.

```sql
playback_progress

id                  uuid PK

profile_id          uuid FK -> profiles.id

episode_id          uuid FK -> episodes.id nullable
movie_id            uuid FK -> movies.id nullable

position_seconds    integer

duration_seconds    integer

completed           boolean default false

last_watched_at     timestamp

created_at          timestamp
updated_at          timestamp
```

Only one of:

```text
episode_id
movie_id
```

should be set.

---

# 11. Progress Saving

Progress should periodically sync while the user watches.

Recommended interval:

```text
every 10–15 seconds
```

Also save when:

```text
Pause
Back
Next Episode
Previous Episode
App closes
Playback finishes
```

Example request:

```http
PUT /profiles/:profileId/progress
```

```json
{
  "episodeId": "...",
  "positionSeconds": 843,
  "durationSeconds": 1440
}
```

---

# 12. Continue Watching

Continue Watching should **not require its own table**.

It can be derived from:

```text
playback_progress
```

Query approximately:

```sql
WHERE completed = false
AND position_seconds > minimum_progress
ORDER BY last_watched_at DESC
```

For example, don't show something under Continue Watching if the user watched only:

```text
0–20 seconds
```

Possible threshold:

```text
30 seconds
```

---

# 13. Completion Rules

An episode can automatically be considered completed when:

```text
progress >= 90–95%
```

or when:

```text
credits_start_seconds
```

has been reached.

Example:

```ts
const completed =
  position >= creditsStart ||
  position / duration >= 0.95;
```

---

# 14. Viewing History

Unlike Continue Watching, history should be permanent.

```sql
watch_history

id                  uuid PK

profile_id          uuid FK -> profiles.id

episode_id          uuid nullable
movie_id            uuid nullable

watched_at          timestamp

completed           boolean
```

Useful later for:

```text
Recently Watched
Recommendations
Watch statistics
Resume previous series
```

---

# 15. Watchlist

Watchlist means:

> I want to watch this later.

```sql
watchlist

id                  uuid PK

profile_id          uuid FK -> profiles.id

series_id           uuid nullable
movie_id            uuid nullable

created_at          timestamp
```

Unique per profile/content pair.

---

# 16. Favorites

Favorites are separate from Watchlist.

Favorite means:

> I like this content.

```sql
favorites

id                  uuid PK

profile_id          uuid FK -> profiles.id

series_id           uuid nullable
movie_id            uuid nullable

created_at          timestamp
```

This distinction allows:

```text
♥ Favorite

+ My List
```

just like most streaming platforms.

---

# 17. Home Screen

Initial home screen sections could be:

```text
Continue Watching

My List

Favorites

Recently Watched

Series

Movies
```

Example:

```text
┌───────────────────────────────────────┐
│ PrivateFlix                           │
│                                       │
│ Continue Watching                     │
│ [Naruto] [Sherlock] [Movie]           │
│                                       │
│ My List                               │
│ [....] [....] [....]                  │
│                                       │
│ Favorites                             │
│ [....] [....] [....]                  │
└───────────────────────────────────────┘
```

---

# 18. Player

The player should have Netflix/YouTube-style controls.

Do **not** use the default browser controls.

Build our own UI.

Example:

```text
──────────────────────────────────────────────

                 VIDEO

──────────────────────────────────────────────

 Naruto
 S02 E14 — Episode Name

 38:21 ━━━━━━━━━━━━━━━●━━━━━━━━━━━━  52:04

 [Prev] [◀ 10] [Play/Pause] [10 ▶] [Next]

 [Skip Intro]    [Audio & Subtitles]    [⚙]

──────────────────────────────────────────────
```

---

# 19. Player Controls

Required controls:

```text
Play / Pause

Seek backward 10 seconds

Seek forward 10 seconds

Previous episode

Next episode

Skip Intro

Audio track

Subtitle track

Playback progress

Current time

Remaining / total duration
```

Optional later:

```text
Playback speed

Quality selection

Episode list

Subtitle appearance

Picture information

Debug statistics
```

---

# 20. Skip Intro

Skip Intro should be a **permanent player control**, not an automatically appearing popup.

Example:

```text
[ Previous ]
[ -10 ]
[ Play ]
[ +10 ]
[ Next ]
[ Skip Intro ]
```

The episode stores:

```text
intro_start_seconds
intro_end_seconds
```

Example:

```json
{
  "introStartSeconds": 0,
  "introEndSeconds": 80
}
```

Clicking:

```text
Skip Intro
```

performs:

```ts
player.seekTo(80);
```

If there is no intro metadata:

```text
Skip Intro
```

can be disabled or hidden.

---

# 21. Previous / Next Episode

The backend should expose neighboring episodes.

Example API:

```http
GET /episodes/:episodeId/context
```

Response:

```json
{
  "previousEpisode": {
    "id": "...",
    "episodeNumber": 13
  },

  "currentEpisode": {
    "id": "...",
    "episodeNumber": 14
  },

  "nextEpisode": {
    "id": "...",
    "episodeNumber": 15
  }
}
```

The player therefore doesn't need to understand season ordering itself.

---

# 22. Autoplay Next Episode

When an episode finishes:

```text
If autoplayNextEpisode = true
        ↓
Start next episode
```

Optionally display:

```text
Next episode starting in 10 seconds
```

This can be added later.

The user can disable autoplay from their profile preferences.

---

# 23. Resume Playback

When starting content with saved progress:

```text
Resume from 38:21?

[Resume]

[Start From Beginning]
```

Alternatively we can behave more like Netflix and automatically resume unless the user explicitly selects:

```text
Play From Beginning
```

---

# 24. API Structure

Initial API could look like:

```text
/auth
    POST /login
    POST /logout
    POST /refresh

/profiles
    GET /
    POST /
    PATCH /:id
    DELETE /:id

/series
    GET /
    GET /:id

/seasons
    GET /:id

/episodes
    GET /:id
    GET /:id/context

/movies
    GET /
    GET /:id

/progress
    GET /
    PUT /

/watchlist
    GET /
    POST /
    DELETE /

/favorites
    GET /
    POST /
    DELETE /

/history
    GET /

/preferences
    GET /
    PATCH /
```

---

# 25. Authentication Tokens

Recommended:

```text
Access Token
+
Refresh Token
```

The TV should remain logged in for long periods.

Example:

```text
Access token:
~15–60 minutes

Refresh token:
months
```

The refresh token can be securely stored on the device.

Users should not need to type their password every time they turn on the TV.

---

# 26. TV Navigation

Everything must work using:

```text
↑
↓
←
→
OK
Back
Play/Pause
```

No mouse should ever be required.

Every clickable element should support focus.

Example:

```css
.card:focus {
  transform: scale(1.08);
}
```

The selected item should always be visually obvious.

---

# 27. Application State

Keep temporary UI state client-side:

```text
selected profile
currently selected menu
player visibility
player controls visibility
focused UI element
current playback state
```

Keep permanent state server-side:

```text
progress
watchlist
favorites
history
preferences
profiles
```

---

# 28. Suggested Repository Structure

```text
private-streaming-app/

apps/

    api/
        src/
            auth/
            profiles/
            content/
            playback/
            watchlist/
            favorites/
            history/

    android-tv/

    webos/


packages/

    ui/

    player/
        Player.ts
        PlayerAdapter.ts

    api-client/

    types/

    utils/


prisma/

    schema.prisma


docs/

    ARCHITECTURE.md
```

---

# 29. Main Shared Types

Example:

```ts
type Profile = {
  id: string;
  name: string;
  avatarUrl?: string;
};

type Series = {
  id: string;
  title: string;
  description?: string;
  posterUrl?: string;
};

type Episode = {
  id: string;

  seasonNumber: number;
  episodeNumber: number;

  title: string;

  durationSeconds: number;

  introStartSeconds?: number;
  introEndSeconds?: number;
};

type PlaybackProgress = {
  episodeId?: string;
  movieId?: string;

  positionSeconds: number;
  durationSeconds: number;

  completed: boolean;
};
```

---

# 30. MVP

For the first proper version, build only:

```text
Authentication

Profile selection

Home page

Series page

Season / episode selection

Player

Progress saving

Continue Watching

Favorites

Watchlist

Previous / Next Episode

Skip Intro

Profile preferences
```

Ignore for now:

```text
Recommendations

Ratings

Social features

Download/offline playback

Multiple quality levels

Parental restrictions

Advanced analytics

Content acquisition

Transcoding

DRM
```

---

# 31. Important Design Principle

The TV applications should primarily act as clients.

Business logic and persistent user state should live on the backend.

```text
TV
    ↓
"User watched episode 7 until 21:34"

Backend
    ↓
stores progress

Different TV/device
    ↓
opens same profile

Backend
    ↓
"Resume episode 7 at 21:34"
```

This means switching between:

```text
LG TV
Xiaomi Stick
Web
Phone
```

will preserve the same:

```text
profile

watch progress

favorites

watchlist

history

preferences
```

That cross-device state should be part of the architecture from day one.
