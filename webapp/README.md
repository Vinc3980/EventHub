# EventHub — Web

Full web port of the EventHub Flutter app: a local-first event booking and social
platform (weddings, funerals, corporate, social). Attendee and organizer are merged
into a single `user` role (everyone can attend *and* run events); `admin` stays a
separate role.

- **Stack**: React 18 + TypeScript + Vite + Tailwind CSS + Dexie (IndexedDB) + Vitest
- **Design system**: exactly the mobile palette/type/radii/elevation, Iconsax icons only,
  Plus Jakarta Sans, calm motion.
- **No backend.** Everything is stored locally in the browser; payments, SMS, push and
  payouts are simulated and marked `// SIMULATED` in the source.
- **Never a blank screen.** Every route change shows a full-screen loading spinner
  (`Suspense` fallback in `App.tsx`), auth guards show a loader instead of `null`, and an
  error boundary catches crashes/failed chunks with "Try again" / "Reload page".
- **Home is a post feed.** Vertical post frames (author → centred image/video →
  caption → like/comment), with the comment thread pinned to the right rail on desktop and in a
  bottom sheet on mobile; a composer lets you post text, an image (≤ 1.5 MB) or a
  video (≤ 15 MB). If you follow
  nobody (or the feed is empty) Home recommends people to follow — Explore has the
  same recommendations behind its **Who to follow** filter.
- **Registration asks the right questions**: full name, phone, dietary needs, relationship
  to the event (label/options vary by wedding / funeral / corporate / social), emergency
  contact, plus corporate "Company + Job title", funeral "Group or church", social
  "Table or group name". Hometown / address / religion / denomination were removed.

Full feature-by-feature parity accounting against the Flutter app lives in
[`PARITY_REPORT.md`](./PARITY_REPORT.md).

**Live**: <https://vinc3980.github.io/EventHub/> — the deployed site ships the full
seed data (wallpapers, events, posts, videos) in the bundle; every visitor's browser
gets its own local copy on first run.

## Getting started

```bash
cd webapp
npm install
npm run dev        # http://localhost:5173
```

| Script                | Purpose                                   |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Vite dev server                           |
| `npm run build`       | Type-check + production build to `dist/`  |
| `npm run preview`     | Serve the production build                |
| `npm run typecheck`   | `tsc --noEmit`                            |
| `npm run lint`        | ESLint (flat config), zero warnings       |
| `npm test`            | Vitest unit + service + navigation tests  |
| `npm run test:watch`  | Vitest watch mode                         |
| `npm run test:coverage` | Vitest with V8 coverage                 |
| `npm run seed:media`  | Rebuild `src/services/seedMedia.ts` from `public/seed/wallpapers/` |
| `npm run seed:posters` | Generate `.poster.jpg` frames for every seed video |
| `npm run seed:video`  | Regenerate the local feed video clips (needs `ffmpeg-static`) |

## Deployment (GitHub Pages)

`.github/workflows/deploy.yml` runs the gates, builds `webapp/dist` and publishes it
to GitHub Pages on every push to `main` (`actions/deploy-pages`):

- **Base path**: CI builds with `VITE_BASE=/EventHub/`, which sets Vite's `base` so
  the project site works under `/EventHub/`; local dev, preview and the test suite
  stay at `/`. Seed rows are prefixed when written (`src/lib/asset.ts` →
  `assetUrl`/`withAssetBase`), and `BrowserRouter` receives
  `basename = import.meta.env.BASE_URL`.
- **SPA routing**: GitHub Pages has no server-side fallback, so `public/404.html`
  bounces unknown paths back to `index.html?redirect=…`, where an inline snippet
  (in `index.html`) restores the real URL before the router boots.
- **Static files**: `public/.nojekyll` keeps Pages from running Jekyll; the
  manifest, offline page and service worker use scope-relative URLs so they work
  under the base path (SW registers `${BASE_URL}sw.js` and resolves its shell list
  against `self.registration.scope`).
- **Data**: there is still no backend — the live site is the same local-first app;
  each browser seeds its own IndexedDB copy.

## Demo credentials


All seeded accounts use the password **`demo123`** (stored as a salted SHA-256 hash
via WebCrypto — a deliberate deviation from the mobile app, which stores plain text).

| Persona   | Email                | User id  |
| --------- | -------------------- | -------- |
| Attendee  | `nana@eventhub.app`  | `att-1`  |
| Attendee  | `esi@eventhub.app`   | `att-2`  |
| Attendee  | `sandra@eventhub.app`| `att-14` (fresh account, follows nobody) |
| Organizer | `kwame@eventhub.app` | `org-1`  |
| Organizer | `ama@eventhub.app`   | `org-2`  |
| Admin     | `admin@eventhub.app` | `admin-1` |

"Attendee"/"Organizer" here are demo **personas**, not roles: every account carries the
single `user` role and can both register for and create events (the admin also has
`admin`).

Ten organizers (`org-1` … `org-10`), ten attendees (`att-1` … `att-10`), six extra
followable profiles (`org-11`/`org-12`, `att-11` … `att-14`), one admin and 100 events
are seeded on first run (idempotent, ~30 ms) from `src/services/seedService.ts` —
together with 35 Home-feed posts (8 of them local `.mp4` clips) and a deterministic
follow graph.

**Seed media is local, in three layers:**

- **Wallpaper bundle** — `public/seed/wallpapers/`, imported from the owner's
  `WALLPAPERS/` folder: **83 images + 3 videos**. Event covers, event galleries and
  image/video feed posts are drawn from it (`SEED_VERSION v6`). **Images carry no size
  limit**; videos must stay ≤ 10 MB — `scripts/seed-media-manifest.mjs` skips anything
  larger (the two oversized imports were re-encoded with `ffmpeg-static`). Swap files,
  then run `npm run seed:media` to rebuild `src/services/seedMedia.ts`.
- **Generated artwork** — category cover SVGs and avatars (`scripts/make-seed-art.mjs`)
  plus the four feed clips (`npm run seed:video`); still used for the Create-event cover
  presets, avatars, and as a fallback if the bundle folder is emptied. Every seed video
  also gets a generated `.poster.jpg` first-frame poster (`npm run seed:posters`), so the
  feed shows real video artwork instead of a black box or the old SVG.
- **No remote URLs, no stock service** — nothing is fetched at runtime, there are no API
  keys or media CDN config, and every seed URL must start with `/seed/` (enforced by
  tests). The wallpaper artwork is whatever the project owner supplied; licensing sits
  with the uploader, not a bundled stock API.

`sandra@eventhub.app` (`att-14`) is seeded with **zero follows**, so the
"people to follow" recommendation state is visible right after you sign in.

## Architecture

```
src/
  theme/      tokens.ts (THE colour/type/spacing/radius source of truth), global.css, cssVars.ts
  db/         Dexie schema (table names identical to the mobile Hive boxes) + liveQuery hooks
  models/     TypeScript mirrors of the Dart models (getters: isFree, effectivePrice, …)
  services/   One file per mobile service, function-for-function
  lib/        ids, currency/date formatting (Ghana style), business constants, password hashing
  hooks/      useQrScanner (real camera scan), useSavedEvents, useBreakpoint
  app/        AuthProvider (effectiveRole: `admin` | `user`), ToastProvider, guards
  layouts/    AppShell (bottom tabs <768, icon rail 768–1023, sidebar ≥1024)
  components/ ui primitives + cards
  screens/    shared / attendee / organizer / admin
  test/       Vitest setup + smoke tests; services/__tests__ carries the behavioural suite
```

- **Local-first**: UI state comes from `useLiveQuery(() => …)`; mutations go through
  `src/services/*`. No `fetch`, no network calls for domain data.
- **Session**: the Dexie `session` table (keys `uid`, `seedVersion`), mirroring mobile.
- **Business rules**: 2% platform fee, `effectivePrice` for every charge/capacity
  decision, capacity enforced at registration *and* at booking (atomic transaction),
  idempotent guest-list merges, waitlist promotion on cancellation, idempotent check-in.

## Simulated features (nothing leaves the device)

| Feature                  | Where                                                |
| ------------------------ | ---------------------------------------------------- |
| MoMo / card payments     | `services/registrationService.ts`, `promotionService.ts` |
| SMS (invites, thank-yous)| `services/invitationService.ts`, `eventService.ts`   |
| Push notifications       | `services/notificationService.ts`, `reminderService.ts` → in-app `notifications` table |
| Platform payouts         | `screens/organizer/PayoutSettingsScreen.tsx`         |
| Refund money movement    | `services/refundService.ts` (status transitions only) |

## Design-system rules (enforced)

1. Colour literals exist **only** in `src/theme/tokens.ts`; every other file uses Tailwind
   theme classes or `var(--eh-*)`. `applyCssVariables()` publishes them before first paint.
2. `accent` (Neon Pink) is reserved for: featured badges, filled save (heart/bookmark),
   filled star ratings, pinned-message highlight, unread dots, avatar gradient ring,
   filled post "liked" heart.
3. Icons come from `iconsax-react` only — no emoji, no other icon libraries.
4. `backgroundTinted` and `deepViolet` are computed (6% primary over surface; accent at
   55% over primary) and may appear only on the Explore backdrop and profile banner.
5. Motion is calm (≤500 ms, no springs/parallax); `prefers-reduced-motion` is disabled
   globally in `theme/global.css`.

## Known deviations from the mobile app

- Passwords are salted hashes instead of plain text.
- `dexie-react-livequery` does not exist on npm, so `src/db/live.ts` provides the
  `useLiveQuery`/`useLive` hooks.
- Camera capture for avatars/covers is file-upload, not a live stream: covers/avatars
  come from the bundled `public/seed/` gallery **or a device file upload** through
  `src/lib/media.ts` (cover ≤ 3 MB image / ≤ 20 MB video, composer ≤ 1.5 MB image /
  ≤ 15 MB video).
- **Roles merged**: attendee + organizer are one `user` role (`admin` stays separate).
  The choose-role screen/route, Settings role chips and the "become an organizer"
  upgrade are gone; organizer surfaces, payouts and event creation are open to every
  account (deviation 17 in `PARITY_REPORT.md`).
- **Video uploads**: the composer posts videos and `CreateEventScreen` accepts video
  covers; `Event.isVideo()` recognises `data:video/…` uploads and every cover renders
  through `components/ui/CoverMedia.tsx` (deviation 18).
- **Custom video player**: playback surfaces use `components/media/AppVideoPlayer.tsx`
  (seek, time, play/pause, mute, fullscreen) instead of native `controls`; silent
  previews and thumbnails stay bare muted `<video>` (deviation 20).
- **Event gallery**: the create/edit form has a "Photos & video" section — up to 12
  items (cover excluded) that become the saved event's `mediaUrls` (deviation 21).
- **Real QR camera scanning**: `QrScannerScreen` requests the camera for real
  (`hooks/useQrScanner.ts`: native `BarcodeDetector`, `@zxing/browser` fallback for
  Safari/Firefox, `facingMode: 'environment'`, released on unmount/tab-hide, repeat
  scans debounced); the old "Simulate scan" stand-in is gone, and manual code entry +
  name search stay as fallbacks for denied/unsupported cameras (deviation 22).
- **Per-device check-in notice**: the scanner's dismissible warning states that
  check-ins sync across tabs on this device only — duplicate check-ins across
  separate phones can't be caught without a shared backend (deviation 23).
- CSV **export** works; CSV **import** shows the mobile's "CSV upload is coming soon."
- Attendance "views" in analytics are derived from registrations (there is no analytics
  backend).
- MoMo networks are `MTN MoMo` / `Telecel Cash` / `AT Money` per the web spec, instead of
  the mobile list.
- **Registration fields were redesigned** for the web (per product direction): hometown,
  current location, residential address, religion and denomination are gone; phone,
  dietary, emergency contact and event-type-specific fields replace them.
- **Home is a social post feed** with likes and comments — the mobile Home is an event
  feed and has no post comments.
- Explore's filter chips are collapsed into a single scrollable row, ending with a
  **Who to follow** filter (people recommendations the mobile app does not have).
- Follow recommendations: `followService.suggestions()` + `SuggestedUsers`, seeded with
  6 extra profiles and a follow graph (27 users total).
