import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './app/AuthProvider';
import { ErrorBoundary } from './app/ErrorBoundary';
import { withChunkRetry } from './app/lazyScreen';
import { ToastProvider } from './app/ToastProvider';
import { RedirectIfAuthed, RequireAuth, RequireRole } from './app/guards';
import { FullScreenLoader } from './components/ui';
import { AppShell } from './layouts/AppShell';

const LandingScreen = lazy(withChunkRetry(() => import('./screens/shared/LandingScreen')));
const LoginScreen = lazy(withChunkRetry(() => import('./screens/shared/LoginScreen')));
const SignUpScreen = lazy(withChunkRetry(() => import('./screens/shared/SignUpScreen')));

const HomeScreen = lazy(withChunkRetry(() => import('./screens/attendee/HomeScreen')));
const ExploreScreen = lazy(withChunkRetry(() => import('./screens/attendee/ExploreScreen')));
const EventDetailScreen = lazy(withChunkRetry(() => import('./screens/attendee/EventDetailScreen')));
const RegistrationScreen = lazy(withChunkRetry(() => import('./screens/attendee/RegistrationScreen')));
const PaymentScreen = lazy(withChunkRetry(() => import('./screens/attendee/PaymentScreen')));
const BookingScreen = lazy(withChunkRetry(() => import('./screens/attendee/BookingScreen')));
const BookingsScreen = lazy(withChunkRetry(() => import('./screens/attendee/BookingsScreen')));
const SavedScreen = lazy(withChunkRetry(() => import('./screens/attendee/SavedScreen')));
const EventPhotosScreen = lazy(withChunkRetry(() => import('./screens/attendee/EventPhotosScreen')));
const RateOrganizerScreen = lazy(withChunkRetry(() => import('./screens/attendee/RateOrganizerScreen')));

const ChatListScreen = lazy(withChunkRetry(() => import('./screens/shared/ChatListScreen')));
const ChatThreadScreen = lazy(withChunkRetry(() => import('./screens/shared/ChatThreadScreen')));
const ProfileScreen = lazy(withChunkRetry(() => import('./screens/shared/ProfileScreen')));
const UserProfileScreen = lazy(withChunkRetry(() => import('./screens/shared/UserProfileScreen')));
const FollowListScreen = lazy(withChunkRetry(() => import('./screens/shared/FollowListScreen')));
const NotificationsScreen = lazy(withChunkRetry(() => import('./screens/shared/NotificationsScreen')));
const BlockedAccountsScreen = lazy(withChunkRetry(() => import('./screens/shared/BlockedAccountsScreen')));
const PaymentMethodsScreen = lazy(withChunkRetry(() => import('./screens/shared/PaymentMethodsScreen')));

// Hub pages (section 3.6) — categorical landings for each module.
const HostHub = lazy(withChunkRetry(() => import('./screens/hubs/HostHub')));
const TicketsHub = lazy(withChunkRetry(() => import('./screens/hubs/TicketsHub')));
const CommunityHub = lazy(withChunkRetry(() => import('./screens/hubs/CommunityHub')));
const AccountHub = lazy(withChunkRetry(() => import('./screens/hubs/AccountHub')));
const AdminHub = lazy(withChunkRetry(() => import('./screens/hubs/AdminHub')));
const HelpHub = lazy(withChunkRetry(() => import('./screens/hubs/HelpHub')));
const HelpArticleScreen = lazy(withChunkRetry(() => import('./screens/hubs/HelpArticleScreen')));
const AccountSettingsScreen = lazy(
  withChunkRetry(() => import('./screens/shared/AccountSettingsScreen')),
);
const SecuritySettingsScreen = lazy(
  withChunkRetry(() => import('./screens/shared/SecuritySettingsScreen')),
);
const NotificationSettingsScreen = lazy(
  withChunkRetry(() => import('./screens/shared/NotificationSettingsScreen')),
);

const MyEventsScreen = lazy(withChunkRetry(() => import('./screens/organizer/MyEventsScreen')));
const CreateEventScreen = lazy(withChunkRetry(() => import('./screens/organizer/CreateEventScreen')));
const OrganizerEventDetail = lazy(withChunkRetry(() => import('./screens/organizer/OrganizerEventDetail')));
const EventAnalyticsScreen = lazy(withChunkRetry(() => import('./screens/organizer/EventAnalyticsScreen')));
const DiscountCodesScreen = lazy(withChunkRetry(() => import('./screens/organizer/DiscountCodesScreen')));
const RefundRequestsScreen = lazy(withChunkRetry(() => import('./screens/organizer/RefundRequestsScreen')));
const BoostEventScreen = lazy(withChunkRetry(() => import('./screens/organizer/BoostEventScreen')));
const GuestListScreen = lazy(withChunkRetry(() => import('./screens/organizer/GuestListScreen')));
const SendInvitationsScreen = lazy(withChunkRetry(() => import('./screens/organizer/SendInvitationsScreen')));
const QrScannerScreen = lazy(withChunkRetry(() => import('./screens/organizer/QrScannerScreen')));
const PayoutSettingsScreen = lazy(withChunkRetry(() => import('./screens/organizer/PayoutSettingsScreen')));

const AdminDashboard = lazy(withChunkRetry(() => import('./screens/admin/AdminDashboard')));
const AdminEventsScreen = lazy(withChunkRetry(() => import('./screens/admin/AdminEventsScreen')));
const EventReviewScreen = lazy(withChunkRetry(() => import('./screens/admin/EventReviewScreen')));
const AdminUsersScreen = lazy(withChunkRetry(() => import('./screens/admin/AdminUsersScreen')));
const AdminReportsScreen = lazy(withChunkRetry(() => import('./screens/admin/AdminReportsScreen')));
const AdminSettingsScreen = lazy(withChunkRetry(() => import('./screens/admin/AdminSettingsScreen')));

const NotFoundScreen = lazy(withChunkRetry(() => import('./screens/shared/NotFoundScreen')));

function ScrollReset() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}

// GitHub Pages serves the build from /EventHub/ (VITE_BASE); local dev and the
// test suite run at '/', where no basename should be applied at all.
const routerBasename =
  import.meta.env.BASE_URL === '/' ? undefined : import.meta.env.BASE_URL.replace(/\/$/, '');

export default function App() {
  return (
    <BrowserRouter basename={routerBasename}>
      <AuthProvider>
        <ToastProvider>
          <ScrollReset />
          <ErrorBoundary>
            <Suspense fallback={<FullScreenLoader />}>
              <Routes>
                {/* ---- auth screens (focused layout, no shell) ------------ */}
                <Route
                  path="/login"
                  element={
                    <RedirectIfAuthed>
                      <LoginScreen />
                    </RedirectIfAuthed>
                  }
                />
                <Route
                  path="/signup"
                  element={
                    <RedirectIfAuthed>
                      <SignUpScreen />
                    </RedirectIfAuthed>
                  }
                />

                {/* ---- public browsing (shell, no session required) ------- */}
                <Route element={<AppShell />}>
                  <Route path="/" element={<LandingScreen />} />
                  <Route
                    path="/landing"
                    element={
                      <RedirectIfAuthed>
                        <LandingScreen />
                      </RedirectIfAuthed>
                    }
                  />
                  <Route path="/explore" element={<ExploreScreen />} />
                  <Route path="/event/:eventId" element={<EventDetailScreen />} />
                  <Route path="/event/:eventId/register" element={<RegistrationScreen />} />
                  <Route path="/u/:uid" element={<UserProfileScreen />} />
                  <Route path="/u/:uid/followers" element={<FollowListScreen mode="followers" />} />
                  <Route path="/u/:uid/following" element={<FollowListScreen mode="following" />} />
                  <Route path="/help" element={<HelpHub />} />
                  <Route path="/help/:slug" element={<HelpArticleScreen />} />
                </Route>

                {/* ---- signed-in app (shell behind a session) ------------- */}
                <Route element={<RequireAuth><AppShell /></RequireAuth>}>
                  <Route path="/home" element={<HomeScreen />} />
                  <Route path="/chats" element={<ChatListScreen />} />
                  <Route path="/chats/:chatId" element={<ChatThreadScreen />} />
                  <Route path="/profile" element={<ProfileScreen />} />
                  <Route path="/notifications" element={<NotificationsScreen />} />

                  <Route path="/tickets" element={<TicketsHub />} />
                  <Route path="/bookings" element={<BookingsScreen />} />
                  <Route path="/saved" element={<SavedScreen />} />
                  <Route path="/booking/:bookingId" element={<BookingScreen />} />
                  <Route path="/event/:eventId/pay/:bookingId" element={<PaymentScreen />} />
                  <Route path="/event/:eventId/photos" element={<EventPhotosScreen />} />
                  <Route path="/event/:eventId/rate" element={<RateOrganizerScreen />} />

                  <Route path="/community" element={<CommunityHub />} />

                  <Route path="/host" element={<HostHub />} />
                  <Route path="/organizer" element={<Navigate to="/host" replace />} />
                  <Route path="/organizer/events" element={<MyEventsScreen />} />
                  <Route path="/organizer/events/new" element={<CreateEventScreen />} />
                  <Route path="/organizer/payouts" element={<PayoutSettingsScreen />} />
                  <Route path="/organizer/events/:id/edit" element={<CreateEventScreen />} />
                  <Route path="/organizer/events/:id" element={<OrganizerEventDetail />} />
                  <Route path="/organizer/events/:id/analytics" element={<EventAnalyticsScreen />} />
                  <Route path="/organizer/events/:id/discounts" element={<DiscountCodesScreen />} />
                  <Route path="/organizer/events/:id/refunds" element={<RefundRequestsScreen />} />
                  <Route path="/organizer/events/:id/boost" element={<BoostEventScreen />} />
                  <Route path="/organizer/events/:id/guests" element={<GuestListScreen />} />
                  <Route path="/organizer/events/:id/invite" element={<SendInvitationsScreen />} />
                  <Route path="/organizer/events/:id/scan" element={<QrScannerScreen />} />

                  <Route path="/settings" element={<AccountHub />} />
                  <Route path="/settings/account" element={<AccountSettingsScreen />} />
                  <Route path="/settings/security" element={<SecuritySettingsScreen />} />
                  <Route path="/settings/notifications" element={<NotificationSettingsScreen />} />
                  <Route path="/settings/blocked" element={<BlockedAccountsScreen />} />
                  <Route path="/settings/payment-methods" element={<PaymentMethodsScreen />} />

                  <Route
                    path="/admin"
                    element={
                      <RequireRole role="admin">
                        <AdminHub />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/overview"
                    element={
                      <RequireRole role="admin">
                        <AdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/events"
                    element={
                      <RequireRole role="admin">
                        <AdminEventsScreen />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/events/:id/review"
                    element={
                      <RequireRole role="admin">
                        <EventReviewScreen />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/users"
                    element={
                      <RequireRole role="admin">
                        <AdminUsersScreen />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/reports"
                    element={
                      <RequireRole role="admin">
                        <AdminReportsScreen />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="/admin/settings"
                    element={
                      <RequireRole role="admin">
                        <AdminSettingsScreen />
                      </RequireRole>
                    }
                  />

                  <Route path="*" element={<NotFoundScreen />} />
                </Route>
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
