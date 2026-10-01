import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:iconsax_plus/iconsax_plus.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/message_model.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../../widgets/primary_button.dart';
import '../../widgets/shimmer_skeleton.dart';
import '../attendee/explore.dart';
import 'chat_thread_screen.dart';

enum _ChatFilter { all, unread }

class ChatListScreen extends StatefulWidget {
  const ChatListScreen({super.key});

  @override
  State<ChatListScreen> createState() => _ChatListScreenState();
}

class _ChatListScreenState extends State<ChatListScreen> {
  _ChatFilter _filter = _ChatFilter.all;
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    final chatService = context.read<ChatService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Chats',
          style: TextStyle(fontWeight: FontWeight.w700, color: Colors.white),
        ),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        centerTitle: false,
        systemOverlayStyle: SystemUiOverlayStyle.light,
      ),
      body: StreamBuilder<List<Map<String, dynamic>>>(
        stream: chatService.chatsForUser(uid),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(child: Text('Could not load chats.'));
          }
          if (!snapshot.hasData) {
            return Center(
              child: ShimmerSkeleton.box(width: 240, height: 72, radius: 16),
            );
          }
          final chats = snapshot.data!;
          final unreadChats = [
            for (final chat in chats)
              if (chatService.hasUnread(chat['id'] as String, uid)) chat,
          ];
          final base = _filter == _ChatFilter.unread ? unreadChats : chats;
          final query = _query.trim().toLowerCase();
          final shown = query.isEmpty
              ? base
              : [
                  for (final chat in base)
                    if ((chatService.eventTitleForChat(chat['id'] as String) ??
                            'Event chat')
                        .toLowerCase()
                        .contains(query))
                      chat,
                ];

          return Column(
            children: [
              _FilterTabs(
                filter: _filter,
                unreadCount: unreadChats.length,
                onFilterChanged: (f) => setState(() => _filter = f),
              ),
              _SearchField(
                controller: _searchController,
                onChanged: (value) => setState(() => _query = value),
              ),
              Expanded(
                child: shown.isEmpty
                    ? (query.isNotEmpty
                        ? _EmptyChatsState(
                            icon: IconsaxPlusLinear.search_normal,
                            title: 'No chats match',
                            subtitle:
                                'Nothing found for "${_query.trim()}".',
                          )
                        : (_filter == _ChatFilter.unread
                            ? const _EmptyChatsState(
                                icon: IconsaxPlusLinear.message_tick,
                                title: "You're all caught up",
                              )
                            : const _EmptyChatsState(
                                icon: IconsaxPlusLinear.message,
                                title: 'No chats yet',
                                subtitle:
                                    'Your event chats will show up here once you RSVP to something.',
                                showExploreButton: true,
                              )))
                    : _buildList(shown, uid, chatService),
              ),
            ],
          );
        },
      ),
    );
  }

  /// Continuous messaging-style list: full-bleed surface rows with inset
  /// dividers (WhatsApp/Telegram convention) instead of gap-separated cards.
  /// Swipe a row left to toggle mute for this user.
  Widget _buildList(
    List<Map<String, dynamic>> chats,
    String uid,
    ChatService chatService,
  ) {
    return ListView.separated(
      itemCount: chats.length,
      // Inset to align with the text start (padding + unread gutter +
      // avatar + gap = 16 + 16 + 48 + 12).
      separatorBuilder: (_, __) => Container(
        height: 1,
        color: AppColors.border,
        margin: const EdgeInsets.only(left: 92),
      ),
      itemBuilder: (context, index) {
        final chat = chats[index];
        final chatId = chat['id'] as String;
        final eventTitle =
            chatService.eventTitleForChat(chatId) ?? 'Event chat';
        final coverUrl = chatService.eventCoverForChat(chatId);
        final lastMsg = chatService.lastMessageForChat(chatId);
        final unread = chatService.hasUnread(chatId, uid);
        final muted = chatService.isMuted(chatId, uid);

        final preview = _previewFor(chatService, lastMsg, uid);
        final timeLabel =
            lastMsg != null ? _listTimeLabel(lastMsg.sentAt) : '';
        // Own last message: single tick (delivered) / bold primary tick
        // once every other member has read it.
        final ownMessage = lastMsg != null && lastMsg.senderId == uid;
        final readByAll = ownMessage && _isReadByAll(chat, lastMsg, uid);

        return Dismissible(
          key: ValueKey('chat-$chatId'),
          direction: DismissDirection.endToStart,
          confirmDismiss: (_) async {
            await chatService.toggleMute(chatId, uid);
            return false;
          },
          background: Container(
            color: AppColors.neutralBg,
            alignment: Alignment.centerRight,
            padding: const EdgeInsets.only(right: AppSpacing.lg),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  muted ? IconsaxPlusLinear.volume_high : IconsaxPlusLinear.volume_slash,
                  size: 20,
                  color: muted ? AppColors.primary : AppColors.textMuted,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  muted ? 'Unmute' : 'Mute',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color:
                        muted ? AppColors.primary : AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
          child: GestureDetector(
            onTap: () {
              chatService.markRead(chatId, uid);
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => ChatThreadScreen(
                    chatId: chatId,
                    chatTitle: eventTitle,
                  ),
                ),
              );
            },
            child: Container(
              color: AppColors.surface,
              padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.lg, vertical: 10),
              child: Row(
                children: [
                  // Accent unread dot in a reserved leading gutter.
                  SizedBox(
                    width: 16,
                    child: unread
                        ? Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: AppColors.accent,
                              shape: BoxShape.circle,
                            ),
                          )
                        : null,
                  ),
                  _ChatAvatar(coverUrl: coverUrl),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                eventTitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontWeight: unread
                                      ? FontWeight.w700
                                      : FontWeight.w600,
                                  fontSize: 15,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                            ),
                            if (timeLabel.isNotEmpty) ...[
                              const SizedBox(width: AppSpacing.sm),
                              Text(
                                timeLabel,
                                style: const TextStyle(
                                    fontSize: 12,
                                    color: AppColors.textMuted),
                              ),
                            ],
                            if (ownMessage) ...[
                              const SizedBox(width: 4),
                              Icon(
                                readByAll
                                    ? IconsaxPlusBold.check
                                    : IconsaxPlusLinear.check,
                                size: 13,
                                color: readByAll
                                    ? AppColors.primary
                                    : AppColors.textMuted,
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 3),
                        Text(
                          preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: unread
                                ? FontWeight.w700
                                : FontWeight.w400,
                            color: AppColors.textMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ).animate().fadeIn(
              duration: 300.ms,
              delay: Duration(milliseconds: 40 * index),
            );
      },
    );
  }

  /// Last-message preview: "You: " prefix for own messages, "Name: text"
  /// for others, "📷 Photo" when there's no text body.
  String _previewFor(
    ChatService chatService,
    Message? lastMsg,
    String uid,
  ) {
    if (lastMsg == null) return 'No messages yet';
    final body = lastMsg.text.isEmpty ? '📷 Photo' : lastMsg.text;
    if (lastMsg.senderId == uid) return 'You: $body';
    return '${chatService.userName(lastMsg.senderId)}: $body';
  }

  /// True once every chat member except the sender has read [lastMsg].
  bool _isReadByAll(Map<String, dynamic> chat, Message lastMsg, String uid) {
    final members = (chat['memberIds'] as List? ?? const []).cast<String>();
    final recipients = members.where((member) => member != uid);
    if (recipients.isEmpty) return false;
    return recipients.every((member) => lastMsg.readBy.contains(member));
  }
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

class _FilterTabs extends StatelessWidget {
  const _FilterTabs({
    required this.filter,
    required this.unreadCount,
    required this.onFilterChanged,
  });

  final _ChatFilter filter;
  final int unreadCount;
  final ValueChanged<_ChatFilter> onFilterChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.xs, AppSpacing.lg, AppSpacing.md),
      child: Row(
        children: [
          _FilterChip(
            label: 'All',
            active: filter == _ChatFilter.all,
            onTap: () => onFilterChanged(_ChatFilter.all),
          ),
          const SizedBox(width: AppSpacing.sm),
          _FilterChip(
            label: unreadCount > 0 ? 'Unread ($unreadCount)' : 'Unread',
            active: filter == _ChatFilter.unread,
            onTap: () => onFilterChanged(_ChatFilter.unread),
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: 7),
        decoration: BoxDecoration(
          color: active ? AppColors.primary : AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          border: active ? null : Border.all(color: AppColors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: active ? Colors.white : AppColors.textPrimary,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Search field
// ---------------------------------------------------------------------------

/// White pill search field with a soft cobalt shadow, clear button, and
/// `search_normal` / `close_circle` iconsax glyphs.
class _SearchField extends StatelessWidget {
  const _SearchField({required this.controller, required this.onChanged});

  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, 0, AppSpacing.lg, AppSpacing.md),
      child: Container(
        height: 44,
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.07),
              blurRadius: 14,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: TextField(
          controller: controller,
          onChanged: onChanged,
          textInputAction: TextInputAction.search,
          style:
              const TextStyle(fontSize: 14, color: AppColors.textPrimary),
          decoration: InputDecoration(
            hintText: 'Search chats',
            isDense: true,
            filled: false,
            contentPadding: const EdgeInsets.symmetric(vertical: 12),
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            errorBorder: InputBorder.none,
            focusedErrorBorder: InputBorder.none,
            prefixIcon: const Icon(IconsaxPlusLinear.search_normal,
                size: 18, color: AppColors.textMuted),
            prefixIconConstraints:
                const BoxConstraints(minWidth: 44, minHeight: 44),
            suffixIcon: ValueListenableBuilder<TextEditingValue>(
              valueListenable: controller,
              builder: (_, value, __) => value.text.isEmpty
                  ? const SizedBox.shrink()
                  : IconButton(
                      iconSize: 18,
                      icon: const Icon(IconsaxPlusLinear.close_circle,
                          size: 18, color: AppColors.textMuted),
                      onPressed: () {
                        controller.clear();
                        onChanged('');
                      },
                    ),
            ),
            suffixIconConstraints:
                const BoxConstraints(minWidth: 44, minHeight: 44),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

class _EmptyChatsState extends StatelessWidget {
  const _EmptyChatsState({
    required this.icon,
    required this.title,
    this.subtitle,
    this.showExploreButton = false,
  });

  final IconData icon;
  final String title;
  final String? subtitle;
  final bool showExploreButton;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.08),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 32, color: AppColors.primary),
          ),
          const SizedBox(height: 20),
          Text(
            title,
            style: const TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.w800,
              color: AppColors.textPrimary,
            ),
          ),
          if (subtitle != null) ...[
            const SizedBox(height: 8),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: Text(
                subtitle!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 14, height: 1.4, color: AppColors.textMuted),
              ),
            ),
          ],
          if (showExploreButton) ...[
            const SizedBox(height: AppSpacing.xl),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 40),
              child: PrimaryButton(
                label: 'Explore events',
                icon: IconsaxPlusLinear.routing,
                fullWidth: false,
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(
                      builder: (_) => const ExploreScreen(),
                    ),
                  );
                },
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Compact list timestamp: "now" / "35m" / "2h" / "Mon" / "12 Mar".
String _listTimeLabel(DateTime t) {
  final now = DateTime.now();
  final diff = now.difference(t);
  if (diff.inMinutes < 1) return 'now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m';
  if (t.year == now.year && t.month == now.month && t.day == now.day) {
    return '${diff.inHours}h';
  }
  if (diff.inDays < 7) return DateFormat('EEE').format(t);
  if (t.year == now.year) return DateFormat('d MMM').format(t);
  return DateFormat('d MMM y').format(t);
}

/// 48px circular event-cover avatar; calendar icon only when no cover.
class _ChatAvatar extends StatelessWidget {
  const _ChatAvatar({required this.coverUrl});

  final String coverUrl;

  @override
  Widget build(BuildContext context) {
    const fallback = Icon(IconsaxPlusLinear.calendar,
        size: 22, color: AppColors.textMuted);

    Widget content;
    if (coverUrl.isEmpty) {
      content = const Center(child: fallback);
    } else if (coverUrl.startsWith('http')) {
      content = Image.network(
        coverUrl,
        fit: BoxFit.cover,
        width: 48,
        height: 48,
        errorBuilder: (_, __, ___) => const Center(child: fallback),
      );
    } else {
      content = Image.file(
        File(coverUrl),
        fit: BoxFit.cover,
        width: 48,
        height: 48,
        errorBuilder: (_, __, ___) => const Center(child: fallback),
      );
    }

    return ClipOval(
      child: Container(
        width: 48,
        height: 48,
        color: AppColors.skeleton,
        child: content,
      ),
    );
  }
}
