# EventHub

Event booking and social platform for weddings, funerals, corporate, and social events.

**Web build**: live at <https://vinc3980.github.io/EventHub/> — React app in
[`webapp/`](./webapp) (see [`webapp/README.md`](./webapp/README.md) and
[`webapp/PARITY_REPORT.md`](./webapp/PARITY_REPORT.md)).

## Getting Started

```bash
flutter pub get
flutter run
```

Admin credentials (pre-seeded): `admin@eventhub.app` / `admin123`

---

## iOS Parity Checklist

### SafeArea Audit

All screens using `Scaffold` with `AppBar` are safe-area-compliant by default — the AppBar automatically accounts for the top notch/Dynamic Island. Screens with `NavigationBar` (bottom nav) automatically account for the home indicator.

**Screens with explicit `SafeArea` wrappers** (body-only, no AppBar):
- `role_selection.dart` — body wrapped
- `signup.dart` — body wrapped
- `login.dart` — body wrapped
- `landing.dart` — body wrapped
- `explore.dart` — body wrapped
- `attendee_home.dart` — body wrapped
- `registration_form_screen.dart` — body wrapped
- `create_event.dart` — body wrapped
- `send_invitations.dart` — body wrapped
- `chat_thread_screen.dart` — input area wrapped

**No action needed** — all content is behind safe areas on devices with notches/home indicators.

### Info.plist Permission Strings (add manually in Xcode)

Since there is no `ios/` folder in the local-only scaffold yet, add these strings manually when creating the iOS project:

```xml
<!-- NSCameraUsageDescription — required by mobile_scanner for QR code scanning -->
<key>NSCameraUsageDescription</key>
<string>EventHub needs camera access to scan QR codes for event check-in.</string>

<!-- NSPhotoLibraryUsageDescription — required by image_picker for event cover photos -->
<key>NSPhotoLibraryUsageDescription</key>
<string>EventHub needs photo library access to let you choose event cover images.</string>

<!-- NSPhotoLibraryAddUsageDescription — required by image_picker on iOS 14+ for saving photos -->
<key>NSPhotoLibraryAddUsageDescription</key>
<string>EventHub may save photos to your library when you download event images.</string>
```

### Android Back Button vs iOS Swipe-Back

The following screens use `Navigator.of(context).pop()` for programmatic back navigation, which works identically on both platforms. No Android-specific `WillPopScope` / `BackButtonListener` is used anywhere.

**Known iOS差异 (no code change needed — Flutter handles it):**
- Flutter's default navigation stack supports iOS edge-swipe back gesture out of the box
- `AppBar` automatically shows a back button on iOS and a drawer toggle on Android
- `SnackBar` positioning is handled by the framework on both platforms

**Flag for future review:**
- `qr_scanner_screen.dart` — The camera view is full-screen; on iOS the status bar will overlay the camera unless the screen uses `Scaffold` with `AppBar` (it does — ✓ safe).
- `payment_screen.dart` — Uses `automaticallyImplyLeading: !_pending` to hide back button during pending state. On iOS this also hides the swipe-back gesture, which is the intended behavior.

---

## Android Configuration

### App Icon

App icon assets are needed in `android/app/src/main/res/` before submission. Use the Flutter launcher icons package or add manually:

- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

### Display Name

The app display name is set to **EventHub** in `pubspec.yaml` and will be used by the Flutter build system.

---

## Splash Screen

A placeholder splash screen is configured via `flutter_native_splash` in `pubspec.yaml`. The current placeholder uses a dark background (`#21295C`) with a calendar icon. **Replace with real brand assets before store submission.**

To regenerate after updating assets:
```bash
dart run flutter_native_splash:create
```

---

## Architecture

- **Local-first**: All services use Hive boxes via `LocalStore`. Firebase is staged for later.
- **Models**: `Event`, `Booking`, `Registration`, `InvitedGuest`, `Post`, `Review`, `Report`, etc.
- **Services**: `EventService`, `RegistrationService`, `ChatService`, `PromotionService`, etc.
- **Provider**: All services are provided above `MaterialApp` via `MultiProvider`.

### Hive Boxes (16 total)

`session`, `auth`, `users`, `events`, `guestList`, `registrations`, `bookings`, `payments`, `posts`, `chats`, `messages`, `reviews`, `reports`, `notifications`, `invitedGuests`, `promotions`, `payoutAccounts`

---

## Firebase Migration

When ready to go live, swap the Hive implementations in each service for Firestore:
1. Re-add `firebase_core`, `firebase_auth`, `cloud_firestore`, `firebase_storage`, `cloud_functions`, `firebase_messaging` to `pubspec.yaml`
2. Replace `LocalStore.watchBox(...)` calls with Firestore `.snapshots()` queries
3. Replace `LocalStore.readDoc(...)` / `box.put(...)` with Firestore `get()` / `set()` calls
4. Remove the `LocalStore` class entirely
5. See `firestore.rules` in repo root for the security rules (already written)

No screens, models, or service method signatures need to change — only the internal persistence implementation.
