import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

import '../../services/auth_service.dart';
import '../../services/follow_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/shimmer_skeleton.dart';
import '../organizer/organizer_profile_screen.dart';

/// Displays a list of users (followers or following) for a given profile.
///
/// [userId] — the profile owner whose followers/following to display.
/// [type] — either 'followers' or 'following'.
class FollowListScreen extends StatelessWidget {
  const FollowListScreen({
    super.key,
    required this.userId,
    required this.type,
  });

  final String userId;
  final String type; // 'followers' or 'following'

  @override
  Widget build(BuildContext context) {
    final followService = context.read<FollowService>();
    final currentUid = context.read<AuthService>().currentUid ?? '';
    final stream = type == 'followers'
        ? followService.followerProfiles(userId)
        : followService.followingProfiles(userId);

    return Scaffold(
      appBar: AppBar(
        title: Text(type == 'followers' ? 'Followers' : 'Following'),
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: stream,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load list.'));
          }
          if (!snapshot.hasData) {
            return const Center(
              child: SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            );
          }
          final users = snapshot.data!;
          if (users.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ShimmerSkeleton.box(width: 72, height: 72, radius: 24),
                  const SizedBox(height: 20),
                  Text(
                    type == 'followers' ? 'No followers yet' : 'Not following anyone',
                    style: const TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    type == 'followers'
                        ? 'When people follow you, they\'ll appear here.'
                        : 'When you follow people, they\'ll appear here.',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 14,
                      color: AppColors.textMuted,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            );
          }
          return ListView.separated(
            itemCount: users.length,
            separatorBuilder: (_, __) => const Divider(height: 1, indent: 72),
            itemBuilder: (context, index) {
              final user = users[index];
              final uid = user['uid'] as String? ?? '';
              final name = user['name'] as String? ?? 'User';
              final avatarUrl = user['avatarUrl'] as String? ?? '';
              final initial = name.isEmpty ? '?' : name[0].toUpperCase();
              final isSelf = uid == currentUid;

              return ListTile(
                leading: CircleAvatar(
                  radius: 20,
                  backgroundColor: AppColors.skeleton,
                  backgroundImage:
                      avatarUrl.isNotEmpty && !avatarUrl.startsWith('http')
                          ? FileImage(File(avatarUrl))
                          : null,
                  child: avatarUrl.isEmpty
                      ? Text(
                          initial,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                            color: AppColors.textPrimary,
                          ),
                        )
                      : null,
                ),
                title: Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                subtitle: Text(
                  (user['bio'] as String?)?.isNotEmpty == true
                      ? user['bio'] as String
                      : (user['email'] as String? ?? ''),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
                trailing: isSelf
                    ? null
                    : _FollowButton(
                        targetUserId: uid,
                        currentUserId: currentUid,
                      ),
                onTap: uid.isNotEmpty && !isSelf
                    ? () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) =>
                                OrganizerProfileScreen(organizerId: uid),
                          ),
                        );
                      }
                    : null,
              ).animate().fadeIn(
                    duration: 250.ms,
                    delay: Duration(milliseconds: 30 * index),
                  );
            },
          );
        },
      ),
    );
  }
}

class _FollowButton extends StatefulWidget {
  const _FollowButton({
    required this.targetUserId,
    required this.currentUserId,
  });

  final String targetUserId;
  final String currentUserId;

  @override
  State<_FollowButton> createState() => _FollowButtonState();
}

class _FollowButtonState extends State<_FollowButton> {
  bool _loading = false;

  @override
  Widget build(BuildContext context) {
    if (widget.currentUserId.isEmpty) return const SizedBox.shrink();

    return StreamBuilder<bool>(
      stream: context.read<FollowService>().isFollowingStream(
            widget.currentUserId,
            widget.targetUserId,
          ),
      builder: (context, snapshot) {
        final isFollowing = snapshot.data ?? false;
        return SizedBox(
          height: 32,
          child: OutlinedButton(
            onPressed: _loading
                ? null
                : () async {
                    setState(() => _loading = true);
                    await context.read<FollowService>().toggleFollow(
                          widget.currentUserId,
                          widget.targetUserId,
                        );
                    if (mounted) setState(() => _loading = false);
                  },
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              side: BorderSide(
                color: isFollowing ? AppColors.border : AppColors.accent,
                width: 1,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
              ),
              backgroundColor:
                  isFollowing ? AppColors.skeleton : Colors.transparent,
            ),
            child: Text(
              isFollowing ? 'Following' : 'Follow',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isFollowing ? AppColors.textMuted : AppColors.accent,
              ),
            ),
          ),
        );
      },
    );
  }
}
