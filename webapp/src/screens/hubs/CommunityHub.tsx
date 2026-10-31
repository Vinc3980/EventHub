/**
 * Community hub (section 3.6) — chats, the feed and the people graph.
 */
import { Activity, Add, Message, NotificationBing, People, Profile2User } from 'iconsax-react';
import { HubPage, type HubTileData } from '../../components/hub';
import { useCommunityCounts } from '../../components/hubCounts';
import { useAuth } from '../../app/AuthProvider';

export default function CommunityHub() {
  const { uid } = useAuth();
  const counts = useCommunityCounts();
  const profileBase = uid ? `/u/${uid}` : '/profile';

  const tiles: HubTileData[] = [
    {
      id: 'chats',
      label: 'Chats',
      description: 'Group chats for your events.',
      icon: Message,
      to: '/chats',
      count: counts.chats,
      featured: true,
    },
    {
      id: 'feed',
      label: 'Feed updates',
      description: 'Photos and news from the community.',
      icon: Activity,
      to: '/home',
    },
    {
      id: 'compose',
      label: 'Share an update',
      description: 'Post photos or news to your followers.',
      icon: Add,
      to: '/home?compose=1',
    },
    {
      id: 'following',
      label: 'Following',
      description: 'People whose updates you see.',
      icon: Profile2User,
      to: `${profileBase}/following`,
      count: counts.following,
    },
    {
      id: 'followers',
      label: 'Followers',
      description: 'People following your profile.',
      icon: People,
      to: `${profileBase}/followers`,
      count: counts.followers,
    },
    {
      id: 'notifications',
      label: 'Notifications',
      description: 'Registrations, replies and reminders.',
      icon: NotificationBing,
      to: '/notifications',
      count: counts.notifications,
    },
  ];

  return <HubPage sections={[{ id: 'community', title: 'Community', tiles }]} />;
}
