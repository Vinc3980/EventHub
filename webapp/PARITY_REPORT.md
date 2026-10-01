# EventHub Web — Parity Report

Deliverable required by the spec's final section. Because the spec document itself was
not persisted to disk, this table is **derived from the mobile codebase**
(`F:\Eventhub\lib`): every Dart screen, service and shared widget is inventoried below
and mapped to its web implementation. Routes are taken from the spec's route list as
recorded during planning.

Legend: **Y** implemented · **P** partial (noted) · **N** not implemented

Verification commands (all run from `F:\Eventhub\webapp`):

| Command | Result |
| --- | --- |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ production build succeeds |
| `npm test` | ✅ 21 files / 148 tests passing |

---

## 1. Screens

### 1.1 Attendee

| # | Mobile file | Web file | Route | | Notes |
| --- | --- | --- | --- | :-: | --- |
| 1 | `attendee/attendee_home.dart` | `screens/attendee/HomeScreen.tsx` | `/home` | Y | For You / Following segments, greeting, bell kept; feed itself is a **post feed** (see deviation 13) with a desktop comment rail |
| 2 | `attendee/explore.dart` | `screens/attendee/ExploreScreen.tsx` | `/explore` | Y | Deep-violet gradient backdrop, search + category/date/free filters, 2→3→4-col grid, offline state |
| 3 | `attendee/event_page.dart` | `screens/attendee/EventDetailScreen.tsx` | `/event/:eventId` | Y | Media, info, tiers (`effectivePrice`), schedule, guests, posts, reviews, RSVP CTA, report |
| 4 | `attendee/registration_form_screen.dart` | `screens/attendee/RegistrationScreen.tsx` | `/event/:eventId/register` | Y | Full field set + Dart validation strings, discount code, waitlist when full |
| 5 | `attendee/payment_screen.dart` | `screens/attendee/PaymentScreen.tsx` | `/event/:eventId/pay/:bookingId` | Y | MoMo number/network, subtotal-discount-fee-total, `// SIMULATED` pending → result, retry |
| 6 | `attendee/booking_confirmation_screen.dart` | `screens/attendee/BookingScreen.tsx` | `/booking/:bookingId` | Y | QR ticket (`qrcode.react`), print view, refund request, rate link |
| 7 | `attendee/my_bookings_screen.dart` | `screens/attendee/BookingsScreen.tsx` | `/bookings` | Y | Upcoming / Past / Cancelled tabs |
| 8 | `attendee/saved_events_screen.dart` | `screens/attendee/SavedScreen.tsx` | `/saved` | Y | Live `savedEventIds`, empty state |
| 9 | `attendee/event_photos_screen.dart` | `screens/attendee/EventPhotosScreen.tsx` | `/event/:eventId/photos` | Y | Grid + lightbox (custom player), report |
| 10 | `attendee/rate_organizer_screen.dart` | `screens/attendee/RateOrganizerScreen.tsx` | `/event/:eventId/rate` | Y | Star rating + comment, `hasReviewed` guard |

### 1.2 Organizer

| # | Mobile file | Web file | Route | | Notes |
| --- | --- | --- | --- | :-: | --- |
| 11 | `organizer/organizer_dashboard.dart` | `screens/organizer/OrganizerDashboard.tsx` | `/organizer` | Y | Metrics, quick links, recent events |
| 12 | *(same file, "My events" tabs)* | `screens/organizer/MyEventsScreen.tsx` | `/organizer/events` | Y | Published / Pending / Draft tabs promoted to their own route |
| 13 | `organizer/create_event.dart` | `screens/organizer/CreateEventScreen.tsx` | `/organizer/events/new`, `/organizer/events/:id/edit` | Y | Full form + tiers + early bird + collaborators + photo/video gallery (≤12), draft/submit |
| 14 | `organizer/event_detail.dart` | `screens/organizer/OrganizerEventDetail.tsx` | `/organizer/events/:id` | Y | Status actions, metrics, sub-nav, attendee chat, CSV export |
| 15 | `organizer/event_analytics_screen.dart` | `screens/organizer/EventAnalyticsScreen.tsx` | `/organizer/events/:id/analytics` | Y | Charts from DOM bars, per-tier capacity, rating |
| 16 | `organizer/discount_codes_screen.dart` | `screens/organizer/DiscountCodesScreen.tsx` | `/organizer/events/:id/discounts` | Y | Create/list/validate codes |
| 17 | `organizer/refund_requests_screen.dart` | `screens/organizer/RefundRequestsScreen.tsx` | `/organizer/events/:id/refunds` | P | Approve/deny works; list is **per event** (mobile is organizer-wide) |
| 18 | `organizer/boost_event_screen.dart` | `screens/organizer/BoostEventScreen.tsx` | `/organizer/events/:id/boost` | Y | Tiers priced by `priceForTier`, `// SIMULATED` payment |
| 19 | `organizer/guest_list.dart` | `screens/organizer/GuestListScreen.tsx` | `/organizer/events/:id/guests` | Y | Live list, search, check-in (idempotent), manual add, CSV export |
| 20 | `organizer/send_invitations.dart` | `screens/organizer/SendInvitationsScreen.tsx` | `/organizer/events/:id/invite` | Y | Recipient pick, message, RSVP link, notify followers, `// SIMULATED` bulk SMS |
| 21 | `organizer/qr_scanner_screen.dart` | `screens/organizer/QrScannerScreen.tsx` | `/organizer/events/:id/scan` | Y | **Real camera scan** via `hooks/useQrScanner.ts` (native `BarcodeDetector` → `@zxing/browser` fallback, permission/denied/no-camera states), manual QR/seat entry + name search, dismissible per-device check-in notice |
| 22 | `organizer/payout_settings_screen.dart` | `screens/organizer/PayoutSettingsScreen.tsx` | `/organizer/payouts` | Y | Account form + payout history grouped by event + non-processing notice |
| 23 | `organizer/organizer_profile_screen.dart` | `screens/shared/ProfileScreen.tsx` (organizer variant) | `/profile` | Y | Merged into the shared profile; every account gets Events / Tickets / Saved tabs (roles merged, deviation 17) |

### 1.3 Shared

| # | Mobile file | Web file | Route | | Notes |
| --- | --- | --- | --- | :-: | --- |
| 24 | `shared/landing.dart` | `screens/shared/LandingScreen.tsx` | `/landing` | Y | |
| 25 | `shared/login.dart` | `screens/shared/LoginScreen.tsx` | `/login` | Y | Verbatim errors + demo-credential fill rows |
| 26 | `shared/signup.dart` | `screens/shared/SignUpScreen.tsx` | `/signup` | Y | |
| 27 | `shared/role_selection.dart` | `screens/shared/ChooseRoleScreen.tsx` | `/choose-role` | - | **Removed** with the role merge (deviation 17); sign-up goes straight to `/home` |
| 28 | `shared/profile_screen.dart` | `screens/shared/ProfileScreen.tsx` | `/profile` | Y | Duotone banner, stats, tabs, edit sheet |
| 29 | *(profile patterns)* | `screens/shared/UserProfileScreen.tsx` | `/u/:uid` | Y | Follow, message, report, block |
| 30 | `shared/follow_list_screen.dart` | `screens/shared/FollowListScreen.tsx` | `/u/:uid/followers`, `/u/:uid/following` | Y | |
| 31 | `shared/notifications_screen.dart` | `screens/shared/NotificationsScreen.tsx` | `/notifications` | Y | Grouping, deep links, mark-all-read |
| 32 | `shared/chat_list_screen.dart` | `screens/shared/ChatListScreen.tsx` | `/chats` | Y | Search, unread, mute; pin/mute via row menu (no swipe gesture) |
| 33 | `shared/chat_thread_screen.dart` | `screens/shared/ChatThreadScreen.tsx` | `/chats/:chatId` | Y | Bubbles, day separators, pin/reply, read-only after event |
| 34 | `shared/settings_screen.dart` | `screens/shared/SettingsScreen.tsx` | `/settings` | Y | Account (incl. "Member since"), notifications, payments, security, sign-out - role chips and the organizer upgrade were removed (deviation 17) |
| 35 | `shared/blocked_accounts_screen.dart` | `screens/shared/BlockedAccountsScreen.tsx` | `/settings/blocked` | Y | |
| 36 | `shared/payment_methods_screen.dart` | `screens/shared/PaymentMethodsScreen.tsx` | `/settings/payment-methods` | Y | Masked MoMo number + network |

### 1.4 Admin

| # | Mobile file | Web file | Route | | Notes |
| --- | --- | --- | --- | :-: | --- |
| 37 | `admin/admin_dashboard.dart` | `screens/admin/AdminDashboard.tsx` | `/admin` | Y | KPIs, moderation queue, reports, bookings |
| 38 | *(pending-review section of the above)* | `screens/admin/AdminEventsScreen.tsx` | `/admin/events` | Y | |
| 39 | `admin/event_review.dart` | `screens/admin/EventReviewScreen.tsx` | `/admin/events/:id/review` | Y | Approve/reject with reason |
| 40 | *(users section of `admin_dashboard.dart`)* | `screens/admin/AdminUsersScreen.tsx` | `/admin/users` | Y | Suspend/reinstate, verify, delete |
| 41 | `admin/admin_reports_screen.dart` | `screens/admin/AdminReportsScreen.tsx` | `/admin/reports` | Y | Dismiss / remove content |
| 42 | — (spec route only) | `screens/admin/AdminSettingsScreen.tsx` | `/admin/settings` | Y | Seed version, table counts, reseed, simulated-features disclosure |
| 43 | — (web SPA) | `screens/shared/NotFoundScreen.tsx` | `*` | Y | 404 with Home action |

**Screens: 43 web files covering all 37 mobile screens (2 mobile screens merged into
their web counterpart, 6 web-only additions).**

---

## 2. Services (`lib/services/*` → `src/services/*`)

| # | Mobile service | Web file | | Notes |
| --- | --- | --- | :-: | --- |
| 1 | `auth_service.dart` | `authService.ts` | Y | Same errors/codes/messages; passwords now salted SHA-256 (deviation) |
| 2 | `chat_service.dart` | `chatService.ts` | Y | Live query streams; `sending → sent` after `MESSAGE_DELAY_MS` (`// SIMULATED`) |
| 3 | `discount_service.dart` | `discountService.ts` | Y | Same four validation messages |
| 4 | `event_schedule_service.dart` | `eventScheduleService.ts` | Y | |
| 5 | `event_service.dart` | `eventService.ts` | Y | Feeds, status transitions, capacity counts, CSV export, `// SIMULATED` SMS thanks |
| 6 | `follow_service.dart` | `followService.ts` | Y | Counter maintenance + notification |
| 7 | `guest_list_service.dart` | `guestListService.ts` | Y | Bulk add + idempotent merge |
| 8 | `invitation_service.dart` | `invitationService.ts` | Y | RSVP link; bulk SMS `// SIMULATED` |
| 9 | `local_db.dart` | `db/db.ts` + `lib/ids.ts` | Y | Same table/box names, `newId()` semantics, session keys |
| 10 | `momo_service.dart` | `momoService.ts` | Y | `// SIMULATED` pending payment row, never charges |
| 11 | `notification_service.dart` | `notificationService.ts` | Y | In-app persistence; FCM token API kept but no real FCM |
| 12 | `post_service.dart` | `postService.ts` | Y | |
| 13 | `promotion_service.dart` | `promotionService.ts` | Y | `// SIMULATED` boost payment |
| 14 | `refund_service.dart` | `refundService.ts` | Y | Payment→`refunded`, booking cancel, guest-list removal, waitlist notify |
| 15 | `registration_service.dart` | `registrationService.ts` | Y | Capacity at registration **and** booking (atomic tx), MoMo `// SIMULATED`, idempotent check-in |
| 16 | `reminder_service.dart` | `reminderService.ts` | Y | Flutter plugin → local timers + `notifications` rows (`// SIMULATED`) |
| 17 | `report_service.dart` | `reportService.ts` | Y | |
| 18 | `review_service.dart` | `reviewService.ts` | Y | |
| 19 | `seed_service.dart` | `seedService.ts` | Y | 20/20 people + 100/100 events byte-identical to Dart, plus admin `admin-1`, 6 extra followable profiles (27 users), 35 feed posts (8 with local mp4 video) and a deterministic follow graph; everyone is seeded with the single `user` role (admin also `admin`, deviation 17);
`SEED_VERSION` `v1` → `v6` (v4: merged roles, v5–v6: wallpaper media bundle) |
| 20 | `waitlist_service.dart` | `waitlistService.ts` | Y | Positions + promotion notification (`// SIMULATED` push) |

**Services: 20/20 ported.** React bindings for Dexie live queries live in `src/db/live.ts`
(`dexie-react-livequery` does not exist on npm).

---

## 3. Shared widgets (`lib/widgets/*`)

| Mobile widget | Web implementation | | Notes |
| --- | --- | :-: | --- |
| `primary_button.dart` | `components/ui/Button.tsx` (`primary`) | Y | |
| `secondary_button.dart` | `components/ui/Button.tsx` (`secondary`) | Y | |
| `text_action_button.dart` | `components/ui/Button.tsx` (`TextActionButton`) | Y | |
| `status_tag.dart` | `components/ui/Display.tsx` (`StatusTag`) | Y | Same word → tone map |
| `shimmer_skeleton.dart` | `components/ui/Display.tsx` (`Skeleton`) | Y | |
| `state_widgets.dart` | `Display.tsx` (`EmptyState`/`ErrorState`) | Y | |
| `placeholder_view.dart` | `Display.tsx` (`EmptyState`) | Y | |
| `event_card.dart` | `components/ui/cards.tsx` (`EventCard`) | Y | |
| `event_feed_card.dart` | `components/ui/cards.tsx` (`EventFeedCard`) | Y | |
| `event_grid_tile.dart` | `components/ui/cards.tsx` (`EventGridTile`) | Y | |
| `report_dialog.dart` | `components/EventReportDialog.tsx` | Y | |
| `role_card.dart` | *(removed with `ChooseRoleScreen`, deviation 17)* | - | |
| `profile_header_parts.dart` | `components/SocialProfile.tsx` | Y | |
| `connectivity_banner.dart` | `Display.tsx` (`OfflineBanner`) in `AppShell` | Y | Promoted to a global banner (mobile shows it per-screen) |

---

## 4. Routes

| Route | Screen | | Route | Screen | |
| --- | --- | :-: | --- | --- | :-: |
| `/` | redirect (authed → `/home`, else `/landing`) | Y | `/organizer` | OrganizerDashboard | Y |
| `/landing` | LandingScreen | Y | `/organizer/events` | MyEventsScreen | Y |
| `/login` | LoginScreen | Y | `/organizer/events/new` | CreateEventScreen | Y |
| `/signup` | SignUpScreen | Y | `/organizer/events/:id/edit` | CreateEventScreen | Y |
| `/choose-role` | *(removed - deviation 17)* | - | `/organizer/events/:id` | OrganizerEventDetail | Y |
| `/home` | HomeScreen | Y | `…/:id/analytics` | EventAnalyticsScreen | Y |
| `/explore` | ExploreScreen | Y | `…/:id/discounts` | DiscountCodesScreen | Y |
| `/chats` | ChatListScreen | Y | `…/:id/refunds` | RefundRequestsScreen | Y |
| `/chats/:chatId` | ChatThreadScreen | Y | `…/:id/boost` | BoostEventScreen | Y |
| `/profile` | ProfileScreen | Y | `…/:id/guests` | GuestListScreen | Y |
| `/u/:uid` | UserProfileScreen | Y | `…/:id/invite` | SendInvitationsScreen | Y |
| `/u/:uid/followers` | FollowListScreen | Y | `…/:id/scan` | QrScannerScreen | Y |
| `/u/:uid/following` | FollowListScreen | Y | `/organizer/payouts` | PayoutSettingsScreen | Y |
| `/event/:eventId` | EventDetailScreen | Y | `/admin` | AdminDashboard | Y |
| `/event/:eventId/register` | RegistrationScreen | Y | `/admin/events` | AdminEventsScreen | Y |
| `/event/:eventId/pay/:bookingId` | PaymentScreen | Y | `/admin/events/:id/review` | EventReviewScreen | Y |
| `/booking/:bookingId` | BookingScreen | Y | `/admin/users` | AdminUsersScreen | Y |
| `/bookings` | BookingsScreen | Y | `/admin/reports` | AdminReportsScreen | Y |
| `/saved` | SavedScreen | Y | `/admin/settings` | AdminSettingsScreen | Y |
| `/event/:eventId/photos` | EventPhotosScreen | Y | `*` | NotFoundScreen | Y |
| `/event/:eventId/rate` | RateOrganizerScreen | Y | | | |
| `/notifications` | NotificationsScreen | Y | | | |
| `/settings` | SettingsScreen | Y | | | |
| `/settings/blocked` | BlockedAccountsScreen | Y | | | |
| `/settings/payment-methods` | PaymentMethodsScreen | Y | | | |

**Routes: 44/45 reachable** (`/choose-role` removed with the role merge). Auth gate and
role priority (`admin > user`) mirror `lib/routes/app_router.dart` via
`src/app/guards.tsx` - `RequireRole` now only guards the admin section.

---

## 5. Cross-cutting requirements

| Requirement | | Where / evidence |
| --- | :-: | --- |
| Colour tokens defined once | Y | `src/theme/tokens.ts`; published as CSS vars by `theme/cssVars.ts`, consumed by `tailwind.config.ts` |
| `backgroundTinted` + `deepViolet` computed, not hard-coded | Y | `blend()` in `tokens.ts` (6% primary over surface; accent @55% over primary) |
| Plus Jakarta Sans everywhere | Y | `@fontsource/plus-jakarta-sans` 400–800 imported in `main.tsx`; `font-sans` is the Tailwind default |
| Iconsax only | Y | audited — zero imports from any other icon library; zero emoji in rendered UI |
| Accent pink reserved | Y | audited — only featured badge, filled save, filled stars, pinned message, unread dots, avatar ring (plus the token definitions themselves) |
| Breakpoints 768 / 1024 | Y | `layouts/AppShell.tsx`: bottom tabs `<768`, icon rail `768–1023`, sidebar `≥1024`; Tailwind `tablet:`/`desktop:` |
| Content max width ≈1200px | Y | `AppShell` `max-w-[1200px]` |
| Calm motion ≤500ms, no springs/parallax | Y | `animate-fadeup` (250ms) + `duration-200/300`; no spring/parallax code exists |
| `prefers-reduced-motion` honoured | Y | `src/theme/global.css:107` disables all non-essential motion |
| Focus-visible ring, never removed | Y | `src/theme/global.css` `:focus-visible` → 2px primary outline |
| Local-first Dexie, exact table names | Y | `src/db/db.ts` — 22 tables with the mobile box names |
| Services layer 1:1 | Y | §2 |
| Seed: 10 organizers, 10 attendees, 100 events, local covers | Y | `services/seedService.ts` + `public/seed/wallpapers/` (owner-supplied bundle: 83 images with no size limit, 3 videos ≤ 10 MB — drives covers, galleries and post media) + `public/seed/*.svg` (presets/avatars/fallback) + `public/seed/*.mp4` (zero remote URLs), idempotent, ~30ms; also seeds 35 feed posts with comments, 6 extra profiles and a follow graph |
| Demo credentials incl. admin | Y | `nana@` / `kwame@` / `admin@eventhub.app`, password `demo123` (README) |
| 2% platform fee | Y | `lib/constants.ts` + tests (`platformFee.test.ts`) |
| `effectivePrice` for all pricing/capacity | Y | `EventTicket.effectivePrice` + `eventTicket.test.ts` |
| Capacity enforced at registration **and** booking | Y | atomic Dexie transaction in `registrationService.confirmFreeBooking`; concurrency test passes |
| Waitlist promotion on cancellation | Y | `waitlistService.notifyNextInLine` (called from `registrationService.cancelBooking`) |
| Idempotent check-in | Y | second scan → `already_checked_in` / "This ticket has already been scanned." (Dart string) |
| Guest-list merge idempotent (by `regId`) | Y | `guestListService` |
| Status → colour map (published/success …) | Y | `Display.tsx` `STATUS_TONE` + `StatusTag` |
| Currency `GHS 80.00` / `GHS 80`, Ghana dates, `Africa/Accra` | Y | `lib/format.ts` + `format.test.ts` |
| Route-level code splitting | Y | every screen `React.lazy`; build emits per-route chunks |
| PWA: manifest, icons, service worker, offline page | Y | `public/manifest.webmanifest`, `public/icons/*`, `public/sw.js`, `public/offline.html`, SW registered only in production |
| Test suite (Vitest) | Y | 21 files / 148 tests: fee, capacity race, discounts, refunds, waitlist, check-in, feeds, posts/comments/likes, follow suggestions, auth, seed (incl. follow graph and the wallpaper media bundle), block, formatting + route smoke tests + navigation/loading + every-screen render regression tests + local media uploads (composer video, event cover, event gallery) + custom video player + QR scanner (camera states, debounce, visibility release, per-device notice) + merged-role regression tests |
| No network for domain data | Y | zero `fetch`/`XMLHttpRequest` in `src/` (service worker caches static assets only) |

---

## 6. Confirmations (audits)

| Assertion | Method | Result |
| --- | --- | --- |
| Zero foreign icon libraries | `grep` over `src/**` for `react-icons`, `lucide`, `@mui`, `@heroicons`, `@tabler` + ESLint `no-restricted-imports` | ✅ none |
| Zero emoji / symbol glyphs in the UI | regex scan for `[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]` over `src/**` | ✅ none (the one `✓` glyph was replaced with an Iconsax `TickCircle`) |
| Zero raw hex outside the token file | regex `#[0-9a-fA-F]{3,8}` over `src/**/*.ts(x)` excluding `theme/tokens.ts` | ✅ none (hex in `index.html`/`manifest.webmanifest`/`offline.html` is app metadata/standalone shell, not UI) |
| Accent restricted to reserved uses | grep for `COLORS.accent`, `text-accent`, `bg-accent` across `src/**` | ✅ only FeaturedBadge, filled save, filled stars, pinned-message highlight, unread dots, avatar gradient ring (3 non-reserved uses found and removed during audit: avatar tint, required-field asterisk, ticket-price/status banners) |
| Reduced motion | `src/theme/global.css:107` | ✅ global `prefers-reduced-motion: reduce` block |
| No horizontal overflow at 320px | code audit: every list/grid uses `min-w-0`, `truncate`, `flex-wrap`, `grid-cols-2 …`; wide tables wrapped in `overflow-x-auto` | ⚠️ verified by review only — no browser/viewport test harness exists in this environment |
| Build/type/lint/test | commands above | ✅ all green |

---

## 7. Deviations from the mobile app

1. **Passwords** are salted SHA-256 hashes (`src/lib/crypto.ts`) instead of plain text.
2. **Live data**: `dexie-react-livequery` does not exist on npm → `src/db/live.ts` provides
   `useLiveQuery` / `useLive` on Dexie's own `liveQuery`.
3. **Navigation** is URL-based (React Router) instead of imperative `Navigator.push`;
   the attendee/organizer tab bar lives in `AppShell` rather than in each screen, and
   "My events" is its own route instead of a tab inside the dashboard.
4. **Organizer profile** merged into the shared `/profile` (role-switched) rather than a
   separate screen; **`admin_users`/`admin_settings`** are separate routes (mobile keeps
   them inside the admin dashboard).
5. **MoMo networks**: `MTN MoMo` / `Telecel Cash` / `AT Money` (web spec) instead of the
   mobile's `Vodafone Cash` / `AirtelTigo`.
6. **Offline banner** shown globally from `AppShell` instead of per-screen.
7. **Refund requests** listed per event (`refundsForEvent`) rather than organizer-wide.
8. **Media**: no camera capture — covers and avatars are chosen from the bundled
   `public/seed/` gallery (wallpapers + SVG presets) **or uploaded from the device**
   through the shared
   `src/lib/media.ts` helper (cover image ≤ 3 MB, cover video ≤ 20 MB, composer image
   ≤ 1.5 MB, composer video ≤ 15 MB; uploads are stored inline as data URLs because
   Dexie has no blob store).
9. **Analytics "views"** derived from registrations (no analytics backend).
10. **CSV export** downloads a Blob in the browser; mobile wrote a temp file. CSV **import**
    shows the mobile's own "CSV upload is coming soon."
11. **Chat gestures**: swipe-to-mute/reply and long-press are replaced by pointer-swipe,
    right-click and a row overflow menu (touch devices get a 600ms long-press).
12. **Icon substitutions** where the mobile used Material/`iconsax_plus` names that the web
   Iconsax set lacks (e.g. `push_pin → Flag`, `reply → ArrowRotateLeft`,
   `done_all → Check`, `event_outlined → Calendar`) — all still Iconsax.
13. **Registration fields redesigned** (explicit product direction): hometown, current
   location, residential address, religion and denomination removed. Added phone number
   (required), dietary requirements, emergency contact name + number, and event-type
   fields — corporate: company name (required) + job title; funeral: group or church;
   social: table or group name; the relationship chip relabels per category
   ("Relationship to the couple" / "… family" / "Delegate type" / "Attendee type").
   CSV export, analytics breakdowns, guest-list rows and seed data follow suit.
14. **Home is a social post feed**: vertical post frames (centred image/video, like +
   comment), comments embedded on the post row (no new Dexie table), a composer, a
   sticky desktop comment rail and a mobile comment sheet, 35 seeded posts (8 with
   local video — generated clips from `scripts/make-seed-video.mjs` plus imported
   wallpaper clips). The mobile Home remains an event
   feed and has no post comments.
15. **Explore filters collapsed to a single row**: the category row and the date/free-only
   row were merged into one horizontally scrollable line.
16. **Follow recommendations (web-only)**: when the Home feed has nobody to follow or
   nothing to show, it recommends people via `followService.suggestions()`; Explore gains
   a `Who to follow` filter on the same single filter row. The seed adds 6 extra
   followable profiles (`org-11`/`org-12`, `att-11`–`att-14`) and a deterministic follow
   graph — `att-14` deliberately follows nobody so the recommendation state is reachable
   out of the box (27 users in total; the mobile app has no such feature).
17. **Roles merged (product decision)**: the mobile app's `attendee` / `organizer` split
   is collapsed into a single `user` role; only `admin` stays separate.
   `effectiveRole()` returns `'admin' | 'user'`, `RequireRole` guards only the admin
   section, `ChooseRoleScreen`/`/choose-role` and the post-signup role step are gone
   (sign-up creates the profile row directly and lands on `/home`), Settings dropped the
   role chips and the "Also become an organizer" upgrade (it now shows "Member since"),
   the sidebar shows a join date for users and "Admin" for admins, the organizer nav
   group and "Create event" are available to everyone, Profile gained a **Tickets** tab
   for every account, and seeds store `roles: ['user']` (`SEED_VERSION` `v3` → `v4`).
   Where "organizer" still matters it is derived from **owning events**
   (`followService` ranking, the Organizer badge in `SuggestedUsers`, event-ownership
   stats), never from a role literal.
18. **Video everywhere**: the Composer accepts video (`accept="image/*,video/*"`, ≤ 15 MB)
   and posts it with `isVideo: true`; `CreateEventScreen` gained an "Upload from your
   device" cover tile; `Event.isVideo()` detects `data:video/…` uploads; and every cover
   renderer goes through the shared `components/ui/CoverMedia.tsx` (`<video>` for video
   covers, `<img>` for images, caller's fallback when empty), including chat list/thread
   avatars and the event Photos grid. Seeded videos use generated `.poster.jpg`
   first-frame posters (`npm run seed:posters`) instead of the old SVG poster; device
   uploads get no poster attribute.
19. **Wallpaper media bundle (owner-supplied)**: seeded event covers, event galleries and
    feed-post media are drawn from `public/seed/wallpapers/` — 83 images imported **with
    no size limit** and 3 videos capped at 10 MB (`scripts/seed-media-manifest.mjs` skips
    anything larger; the two oversized imports were re-encoded with `ffmpeg-static`).
    `src/services/seedMedia.ts` is generated by `npm run seed:media`; generated category
    SVGs remain the Create-event cover presets, avatars and the fallback when the bundle
    folder is empty. Still zero remote URLs and no stock API/keys — the artwork is
    whatever the project owner dropped into `WALLPAPERS/`.
 20. **Custom video player**: every playback surface (feed post, event-detail hero and
     Updates, photo lightbox, organizer event hero) uses
     `components/media/AppVideoPlayer.tsx` — seek track, time, play/pause, mute and
     fullscreen in an app-styled bar — instead of the browser's native `controls`.
     Silent surfaces stay bare `<video muted>`: composer previews, cover thumbnails
     (`CoverMedia`), gallery/Photos grid tiles and the create-form gallery previews.
     The native `controls` attribute appears nowhere in `src/`.
 21. **Event gallery in the create/edit form**: `CreateEventScreen` gained a
     "Photos & video" section (up to 12 items, image ≤3 MB, video ≤20 MB, cover
     excluded from `mediaUrls`) whose state drives the saved event's gallery — the
     mobile form only had cover media.
 22. **Real QR camera scanning** (mobile camera path was simulated): `hooks/useQrScanner.ts`
     feature-detects the native `BarcodeDetector` API and decodes on animation frames from
     a `getUserMedia({ facingMode: 'environment' })` stream; browsers without it
     (Safari/Firefox) fall back to `@zxing/browser`'s `BrowserQRCodeReader`
     (`decodeFromStream` on the same stream). The stream is released on stop, unmount and
     `visibilitychange` → hidden, identical codes are debounced (2s window / 1.5s decode
     pause), and the UI distinguishes requesting/scanning/denied/unsupported/error with a
     retry plus the untouched manual-entry and name-search fallbacks. The old
     "Simulate scan" button is gone.
 23. **Per-device check-in honesty banner**: the scanner opens with a dismissible
     `warningBg` notice (same visual language as `OfflineBanner`) stating that check-ins
     sync live across tabs on one device/browser profile only — not between separate
     physical devices — so duplicate check-ins for the same ticket won't be caught across
     multiple scanning phones. Dismissal is remembered per event in `localStorage`
     (`eh:scan-checkin-note:<eventId>`). **No cross-device sync is implemented** (no
     backend/relay); this stage ships the limitation as visible truth, not a workaround.

## 8. Simulated features (nothing leaves the device)

| Feature | Location |
| --- | --- |
| MoMo / card payment authorisation and settlement | `registrationService.ts`, `promotionService.ts`, `momoService.ts` |
| SMS invites and thank-you messages | `invitationService.ts`, `eventService.ts` |
| Push notifications and event reminders | `notificationService.ts`, `reminderService.ts` → `notifications` table + local timers |
| Platform payouts | `PayoutSettingsScreen.tsx` (history computed locally, transfers explicitly not processed) |
| Refund money movement | `refundService.ts` (status transitions only) |
| Chat delivery latency | `chatService.ts` (`sending → sent` after 400ms) |

Every one of these call sites carries a `// SIMULATED` comment in source.

## 9. Partial / not implemented

| Item | Status | Note |
| --- | --- | --- |
| Camera capture (avatar, event cover) | P | Avatar/cover pickers use the seed asset gallery or a **device file upload** (no camera stream); QR scanning itself uses a real camera stream |
| Real FCM push / device tokens | N | `saveFcmToken` API kept; delivery is the in-app table |
| Real payment gateway / payouts / SMS | N | out of scope by spec — simulated |
| CSV import of a guest list | N | mobile is also unimplemented (`UnimplementedError`) |
| Chart library in analytics | N | bars/meters built from DOM (spec forbade extra deps) |
| Multi-tab live sync via `BroadcastChannel` | N | not in the mobile app either; Dexie handles same-tab reactivity |
| Machine-verified 320px layout | P | no browser harness available — see §6 |
