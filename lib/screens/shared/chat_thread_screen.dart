import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../../models/message_model.dart';
import '../../services/auth_service.dart';
import '../../services/chat_service.dart';
import '../../theme/app_colors.dart';
import '../../theme/app_spacing.dart';
import '../../theme/app_theme.dart';
import '../attendee/event_page.dart';

/// Conversation canvas — [AppColors.background] blended with ~5% primary so
/// the message area reads as a distinct "room"; AppBar and input bar stay on
/// the standard surface.
final Color _threadCanvas = Color.alphaBlend(
  AppColors.primary.withValues(alpha: 0.05),
  AppColors.background,
);

/// Same-sender messages closer than this form one visual group (tight gap,
/// single trailing timestamp, one sender header).
const Duration _groupWindow = Duration(minutes: 2);

/// Horizontal drag distance that arms swipe-to-reply.
const double _replySwipeThreshold = 40;

/// Cap for the swipe-to-reply drag offset.
const double _replySwipeMax = 56;

/// Per-message delivery/read state for the current user's sent messages.
enum _ReadStatus { sent, delivered, read }

class ChatThreadScreen extends StatefulWidget {
  const ChatThreadScreen({
    super.key,
    required this.chatId,
    required this.chatTitle,
  });

  final String chatId;
  final String chatTitle;

  @override
  State<ChatThreadScreen> createState() => _ChatThreadScreenState();
}

class _ChatThreadScreenState extends State<ChatThreadScreen> {
  final _controller = TextEditingController();
  final _scrollController = ScrollController();
  final _inputFocus = FocusNode();
  bool _sending = false;
  Message? _replyTo;

  @override
  void initState() {
    super.initState();
    _inputFocus.addListener(_onFocusChange);

    // Viewing the thread: bump chat-level lastReadAt and stamp this uid on
    // every incoming message's readBy (drives the sender's ticks).
    final uid = context.read<AuthService>().currentUid ?? '';
    if (uid.isNotEmpty) {
      final chatService = context.read<ChatService>();
      chatService.markRead(widget.chatId, uid);
      chatService.markThreadRead(widget.chatId, uid);
    }
  }

  void _onFocusChange() => setState(() {});

  @override
  void dispose() {
    _inputFocus.removeListener(_onFocusChange);
    _inputFocus.dispose();
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _scrollToBottom() {
    if (_scrollController.hasClients) {
      Future.delayed(const Duration(milliseconds: 100), () {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  Future<void> _send() async {
    final text = _controller.text.trim();
    if (text.isEmpty || _sending) return;

    final reply = _replyTo;
    setState(() {
      _sending = true;
      _replyTo = null;
    });
    _controller.clear();

    final uid = context.read<AuthService>().currentUid ?? '';
    final chatService = context.read<ChatService>();

    await chatService.sendMessage(
      widget.chatId,
      Message(
        id: '',
        chatId: widget.chatId,
        senderId: uid,
        text: text,
        sentAt: DateTime.now(),
        replyToMessageId: reply?.id,
        replyToPreview: reply?.text,
      ),
    );

    await chatService.markRead(widget.chatId, uid);

    if (mounted) {
      setState(() => _sending = false);
      _scrollToBottom();
    }
  }

  @override
  Widget build(BuildContext context) {
    final uid = context.read<AuthService>().currentUid ?? '';
    final chatService = context.read<ChatService>();
    final chatData = chatService.getChat(widget.chatId);
    final isReadOnly = chatData?['readOnly'] as bool? ?? false;
    final createdBy = chatData?['createdBy'] as String? ?? '';
    final isOrganizer = uid == createdBy;
    final eventId = chatData?['eventId'] as String?;
    final coverUrl = chatService.eventCoverForChat(widget.chatId);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: _ThreadAppBarTitle(
          title: widget.chatTitle,
          coverUrl: coverUrl,
          eventId: eventId,
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: Container(
              color: _threadCanvas,
              child: StreamBuilder<List<Message>>(
                stream: chatService.messagesForChat(widget.chatId),
                builder: (context, snapshot) {
                  if (snapshot.hasError) {
                    return const Center(
                      child: Padding(
                        padding: EdgeInsets.all(AppSpacing.xl),
                        child: Text(
                          'Could not load messages.',
                          style: TextStyle(color: AppColors.textMuted),
                        ),
                      ),
                    );
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
                  final messages = snapshot.data!;
                  if (messages.isEmpty) {
                    return const Center(
                      child: Text(
                        'No messages yet.\nSend the first message!',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.textMuted),
                      ),
                    );
                  }

                  return ListView(
                    controller: _scrollController,
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    children: _buildMessages(
                      messages: messages,
                      uid: uid,
                      isOrganizer: isOrganizer,
                      chatService: chatService,
                    ),
                  );
                },
              ),
            ),
          ),
          if (isReadOnly)
            Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              color: AppColors.neutralBg,
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_outline,
                      size: 16, color: AppColors.textMuted),
                  SizedBox(width: AppSpacing.sm),
                  Flexible(
                    child: Text(
                      'This event has ended — chat is now read-only',
                      maxLines: 2,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                          fontSize: 13, color: AppColors.textMuted),
                    ),
                  ),
                ],
              ),
            )
          else
            Container(
              decoration: const BoxDecoration(
                color: AppColors.surface,
                border: Border(top: BorderSide(color: AppColors.border)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                      AppSpacing.lg, 10, AppSpacing.lg, 10),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (_replyTo != null) ...[
                        _ReplyBar(
                          message: _replyTo!,
                          onClose: () => setState(() => _replyTo = null),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      Semantics(
                        container: true,
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.xs),
                          decoration: BoxDecoration(
                            color: AppColors.surface,
                            borderRadius:
                                BorderRadius.circular(AppTheme.radiusPill),
                            border: Border.all(
                              color: _inputFocus.hasFocus
                                  ? AppColors.primary
                                  : AppColors.border,
                              width: _inputFocus.hasFocus ? 1.5 : 1,
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _controller,
                                  focusNode: _inputFocus,
                                  textCapitalization:
                                      TextCapitalization.sentences,
                                  decoration: const InputDecoration(
                                    hintText: 'Type a message...',
                                    hintStyle: TextStyle(
                                        color: AppColors.textMuted,
                                        fontSize: 14),
                                    border: InputBorder.none,
                                    enabledBorder: InputBorder.none,
                                    focusedBorder: InputBorder.none,
                                    errorBorder: InputBorder.none,
                                    focusedErrorBorder: InputBorder.none,
                                    isDense: true,
                                    contentPadding: EdgeInsets.fromLTRB(
                                        14, 10, 8, 10),
                                  ),
                                  onSubmitted: (_) => _send(),
                                ),
                              ),
                              ValueListenableBuilder<TextEditingValue>(
                                valueListenable: _controller,
                                builder: (context, value, _) {
                                  final hasText =
                                      value.text.trim().isNotEmpty;
                                  final active = hasText || _sending;
                                  final canSend = hasText && !_sending;
                                  return Semantics(
                                    label: 'Send message',
                                    button: true,
                                    enabled: canSend,
                                    child: GestureDetector(
                                      onTap: canSend ? _send : null,
                                      child: Container(
                                        width: 38,
                                        height: 38,
                                        decoration: BoxDecoration(
                                          color: active
                                              ? AppColors.primary
                                              : AppColors.border,
                                          shape: BoxShape.circle,
                                        ),
                                        child: _sending
                                            ? const SizedBox(
                                                width: 16,
                                                height: 16,
                                                child: Padding(
                                                  padding:
                                                      EdgeInsets.all(3),
                                                  child:
                                                      CircularProgressIndicator(
                                                    strokeWidth: 2,
                                                    color: Colors.white,
                                                  ),
                                                ),
                                              )
                                            : Icon(
                                                Icons.send,
                                                size: 17,
                                                color: hasText
                                                    ? Colors.white
                                                    : AppColors.textMuted,
                                              ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------
  // Message list: pinned banner + date separators + grouped bubbles
  // ---------------------------------------------------------------------------

  List<Widget> _buildMessages({
    required List<Message> messages,
    required String uid,
    required bool isOrganizer,
    required ChatService chatService,
  }) {
    final pinned = messages.where((m) => m.pinned).toList();
    final regular = messages.where((m) => !m.pinned).toList();

    final chat = chatService.getChat(widget.chatId);
    final members =
        ((chat?['memberIds'] as List?) ?? const []).cast<String>();

    final children = <Widget>[
      if (pinned.isNotEmpty) ...[
        Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.06),
            borderRadius: BorderRadius.circular(AppTheme.radiusMd),
            border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.2)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.push_pin,
                      size: 14, color: AppColors.primary),
                  SizedBox(width: 6),
                  Text(
                    'Pinned message',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ...pinned.map((m) => Text(
                    m.text,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textPrimary,
                    ),
                  )),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
      ],
    ];

    for (var i = 0; i < regular.length; i++) {
      final msg = regular[i];
      final prev = i > 0 ? regular[i - 1] : null;
      final next = i + 1 < regular.length ? regular[i + 1] : null;

      final dayChanged = prev != null && !_sameDay(prev.sentAt, msg.sentAt);
      if (prev == null || dayChanged) {
        children.add(_DateSeparator(label: _dateSeparatorLabel(msg.sentAt)));
      }

      final groupedPrev = prev != null &&
          !dayChanged &&
          prev.senderId == msg.senderId &&
          msg.sentAt.difference(prev.sentAt) < _groupWindow;
      final groupedNext = next != null &&
          _sameDay(msg.sentAt, next.sentAt) &&
          next.senderId == msg.senderId &&
          next.sentAt.difference(msg.sentAt) < _groupWindow;

      // Sender header/avatar on the first bubble of a timed group run only.
      final showSender = msg.senderId != uid && !groupedPrev;

      final isMe = msg.senderId == uid;
      final status =
          isMe ? _statusFor(msg, members) : _ReadStatus.sent;

      children.add(
        _MessageBubble(
          message: msg,
          isMe: isMe,
          senderName: chatService.userName(msg.senderId),
          senderAvatarUrl: chatService.userAvatarUrl(msg.senderId),
          status: status,
          isOrganizer: isOrganizer,
          showSender: showSender,
          showTime: !groupedNext,
          showAvatar: !groupedPrev,
          groupedPrev: groupedPrev,
          onTogglePin: () async {
            await chatService.togglePin(msg.id);
          },
          onReply: () => setState(() => _replyTo = msg),
        ),
      );
    }

    children.add(const SizedBox(height: AppSpacing.sm));
    return children;
  }

  /// Delivery/read ticks for an outgoing message, from `readBy` coverage of
  /// the other chat members: none → sent, some → delivered, all → read.
  _ReadStatus _statusFor(Message msg, List<String> members) {
    final others = members.where((id) => id != msg.senderId).toList();
    if (others.isEmpty) return _ReadStatus.sent;
    final reads = others.where((o) => msg.readBy.contains(o)).length;
    if (reads == 0) return _ReadStatus.sent;
    if (reads == others.length) return _ReadStatus.read;
    return _ReadStatus.delivered;
  }
}

bool _sameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// "Today" / "Yesterday" / "12 Mar" / "12 Mar 2025".
String _dateSeparatorLabel(DateTime t) {
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final day = DateTime(t.year, t.month, t.day);
  final diff = today.difference(day).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (t.year == now.year) return DateFormat('d MMM').format(t);
  return DateFormat('d MMM y').format(t);
}

// ---------------------------------------------------------------------------
// Date separator
// ---------------------------------------------------------------------------

class _DateSeparator extends StatelessWidget {
  const _DateSeparator({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md, vertical: 5),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppTheme.radiusPill),
          border: Border.all(color: AppColors.border),
        ),
        child: Text(
          label,
          style: const TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: AppColors.textMuted,
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Reply bar (above the input while a reply is pending)
// ---------------------------------------------------------------------------

class _ReplyBar extends StatelessWidget {
  const _ReplyBar({required this.message, required this.onClose});

  final Message message;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final preview =
        message.text.isEmpty ? 'Message' : message.text;
    return Container(
      width: double.infinity,
      padding:
          const EdgeInsets.fromLTRB(AppSpacing.sm, AppSpacing.sm, 4, AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(AppTheme.radiusSm),
        border: const Border(
          left: BorderSide(color: AppColors.primary, width: 3),
        ),
      ),
      child: Row(
        children: [
          const SizedBox(width: 6),
          const Icon(Icons.reply, size: 16, color: AppColors.primary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Replying to',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
                ),
                Text(
                  preview,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 12,
                    color: AppColors.textMuted,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onClose,
            behavior: HitTestBehavior.opaque,
            child: const Padding(
              padding: EdgeInsets.all(AppSpacing.sm),
              child:
                  Icon(Icons.close, size: 16, color: AppColors.textMuted),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// AppBar title
// ---------------------------------------------------------------------------

/// AppBar title: 32px circular event cover + name, tappable to open the
/// event page.
class _ThreadAppBarTitle extends StatelessWidget {
  const _ThreadAppBarTitle({
    required this.title,
    required this.coverUrl,
    required this.eventId,
  });

  final String title;
  final String coverUrl;
  final String? eventId;

  @override
  Widget build(BuildContext context) {
    const fallback =
        Icon(Icons.event_outlined, size: 14, color: AppColors.textMuted);

    Widget thumbContent;
    if (coverUrl.isEmpty) {
      thumbContent = const Center(child: fallback);
    } else if (coverUrl.startsWith('http')) {
      thumbContent = Image.network(
        coverUrl,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Center(child: fallback),
      );
    } else {
      thumbContent = Image.file(
        File(coverUrl),
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => const Center(child: fallback),
      );
    }

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: eventId == null
          ? null
          : () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (_) => EventPageScreen(eventId: eventId!),
                ),
              );
            },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipOval(
            child: Container(
              width: 32,
              height: 32,
              color: AppColors.skeleton,
              child: thumbContent,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Flexible(
            child: Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
                color: AppColors.textPrimary,
              ),
            ),
          ),
          if (eventId != null)
            const Padding(
              padding: EdgeInsets.only(left: 2),
              child: Icon(Icons.chevron_right,
                  size: 18, color: AppColors.textMuted),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Message bubble
// ---------------------------------------------------------------------------

/// Chat bubble with WhatsApp-style grouping: sender header + 28px avatar on
/// the first received message of a run, asymmetric tail corners, swipe-to-
/// reply, long-press menu (Pin/Reply/Copy), quoted previews, and delivery
/// ticks under outgoing messages.
class _MessageBubble extends StatefulWidget {
  const _MessageBubble({
    required this.message,
    required this.isMe,
    required this.senderName,
    required this.senderAvatarUrl,
    required this.status,
    required this.isOrganizer,
    required this.showSender,
    required this.showTime,
    required this.showAvatar,
    required this.groupedPrev,
    required this.onTogglePin,
    required this.onReply,
  });

  final Message message;
  final bool isMe;
  final String senderName;
  final String senderAvatarUrl;
  final _ReadStatus status;
  final bool isOrganizer;

  /// First message of a timed sender run — render the name above the bubble
  /// and the avatar in the reserved left gutter.
  final bool showSender;

  /// Show the timestamp — only beneath the last bubble of a group.
  final bool showTime;

  /// Received bubbles: render the avatar on the first of a group (space is
  /// always reserved so grouped bubbles stay aligned).
  final bool showAvatar;

  /// Same sender within [_groupWindow] — tighter vertical gap.
  final bool groupedPrev;

  final VoidCallback onTogglePin;
  final VoidCallback onReply;

  @override
  State<_MessageBubble> createState() => _MessageBubbleState();
}

class _MessageBubbleState extends State<_MessageBubble> {
  double _dragOffset = 0;

  void _onDragUpdate(DragUpdateDetails details) {
    final delta = details.delta.dx;
    final next = widget.isMe
        ? (_dragOffset + delta).clamp(-_replySwipeMax, 0.0)
        : (_dragOffset + delta).clamp(0.0, _replySwipeMax);
    if (next != _dragOffset) {
      setState(() => _dragOffset = next);
    }
  }

  void _onDragEnd(DragEndDetails details) {
    final armed = _dragOffset.abs() >= _replySwipeThreshold;
    setState(() => _dragOffset = 0);
    if (armed) widget.onReply();
  }

  /// Asymmetric tail: 16px on three corners, 4px on the sender-indicating
  /// bottom corner (bottom-right when sent, bottom-left when received).
  BorderRadius get _bubbleRadius => BorderRadius.only(
        topLeft: const Radius.circular(16),
        topRight: const Radius.circular(16),
        bottomLeft: Radius.circular(widget.isMe ? 16 : 4),
        bottomRight: Radius.circular(widget.isMe ? 4 : 16),
      );

  Future<void> _openMenu() async {
    final action = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(
            top: Radius.circular(AppTheme.radiusLg)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const SizedBox(height: AppSpacing.md),
              Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: AppColors.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (widget.isOrganizer)
                ListTile(
                  leading: Icon(
                    widget.message.pinned
                        ? Icons.push_pin_outlined
                        : Icons.push_pin,
                    size: 20,
                    color: AppColors.primary,
                  ),
                  title: Text(
                    widget.message.pinned ? 'Unpin' : 'Pin',
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  onTap: () => Navigator.pop(ctx, 'pin'),
                ),
              ListTile(
                leading: const Icon(Icons.reply,
                    size: 20, color: AppColors.primary),
                title: const Text(
                  'Reply',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                onTap: () => Navigator.pop(ctx, 'reply'),
              ),
              ListTile(
                leading: const Icon(Icons.content_copy,
                    size: 20, color: AppColors.primary),
                title: const Text(
                  'Copy',
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                onTap: () => Navigator.pop(ctx, 'copy'),
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
          ),
        );
      },
    );

    if (!mounted || action == null) return;
    switch (action) {
      case 'pin':
        widget.onTogglePin();
        break;
      case 'reply':
        widget.onReply();
        break;
      case 'copy':
        await Clipboard.setData(ClipboardData(text: widget.message.text));
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Message copied.')),
          );
        }
        break;
    }
  }

  Widget _statusIcon() {
    switch (widget.status) {
      case _ReadStatus.delivered:
        return const Icon(Icons.done_all,
            size: 13, color: AppColors.textMuted);
      case _ReadStatus.read:
        return const Icon(Icons.done_all,
            size: 13, color: AppColors.primary);
      case _ReadStatus.sent:
        return const Icon(Icons.check,
            size: 13, color: AppColors.textMuted);
    }
  }

  @override
  Widget build(BuildContext context) {
    final timeLabel = DateFormat('HH:mm').format(widget.message.sentAt);
    final maxWidth = MediaQuery.sizeOf(context).width * 0.75;
    final dragProgress =
        (_dragOffset.abs() / _replySwipeThreshold).clamp(0.0, 1.0);

    return Padding(
      padding: EdgeInsets.only(
        bottom: widget.showTime ? 12 : (widget.groupedPrev ? 4 : 10),
      ),
      child: Column(
        crossAxisAlignment:
            widget.isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
        children: [
          // Sender name above the first bubble of a received run.
          if (widget.showSender)
            Padding(
              padding: EdgeInsets.only(
                left: widget.isMe ? 0 : 36,
                right: widget.isMe ? 36 : 0,
                bottom: 3,
              ),
              child: Text(
                widget.senderName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),

          // Swipe-to-reply wrapper + long-press menu.
          GestureDetector(
            onHorizontalDragUpdate: _onDragUpdate,
            onHorizontalDragEnd: _onDragEnd,
            onHorizontalDragCancel: () => setState(() => _dragOffset = 0),
            onLongPress: _openMenu,
            child: Stack(
              children: [
                // Reply hint revealed by the swipe (un-tappable).
                Positioned.fill(
                  child: IgnorePointer(
                    child: Align(
                      alignment: widget.isMe
                          ? Alignment.centerRight
                          : Alignment.centerLeft,
                      child: Opacity(
                        opacity: dragProgress,
                        child: const Icon(Icons.reply,
                            size: 20, color: AppColors.primary),
                      ),
                    ),
                  ),
                ),
                Transform.translate(
                  offset: Offset(_dragOffset, 0),
                  child: Row(
                    mainAxisAlignment: widget.isMe
                        ? MainAxisAlignment.end
                        : MainAxisAlignment.start,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (!widget.isMe) ...[
                        SizedBox(
                          width: 28,
                          height: 28,
                          child: widget.showAvatar
                              ? _SenderAvatar(
                                  avatarUrl: widget.senderAvatarUrl,
                                  name: widget.senderName,
                                )
                              : null,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                      ],
                      Flexible(
                        child: ConstrainedBox(
                          constraints: BoxConstraints(maxWidth: maxWidth),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: widget.isMe
                                  ? AppColors.primary
                                  : AppColors.surface,
                              borderRadius: _bubbleRadius,
                              border: widget.isMe
                                  ? null
                                  : Border.all(
                                      color: AppColors.border, width: 1),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Quoted reply preview.
                                if (widget.message.replyToMessageId !=
                                    null) ...[
                                  Container(
                                    width: double.infinity,
                                    margin:
                                        const EdgeInsets.only(bottom: 6),
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: widget.isMe
                                          ? Colors.white
                                              .withValues(alpha: 0.16)
                                          : AppColors.neutralBg,
                                      borderRadius:
                                          BorderRadius.circular(
                                              AppTheme.radiusSm),
                                      border: Border(
                                        left: BorderSide(
                                          color: widget.isMe
                                              ? Colors.white70
                                              : AppColors.primary,
                                          width: 3,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      widget.message.replyToPreview ?? '',
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 12,
                                        height: 1.3,
                                        color: widget.isMe
                                            ? Colors.white70
                                            : AppColors.textMuted,
                                      ),
                                    ),
                                  ),
                                ],
                                Text(
                                  widget.message.text,
                                  style: TextStyle(
                                    fontSize: 14,
                                    height: 1.35,
                                    color: widget.isMe
                                        ? Colors.white
                                        : AppColors.textPrimary,
                                  ),
                                ),
                                if (widget.message.pinned) ...[
                                  const SizedBox(height: 4),
                                  const Icon(Icons.push_pin,
                                      size: 10,
                                      color: AppColors.primary),
                                ],
                              ],
                            ),
                          ),
                        ),
                      ),
                      if (widget.isMe) const SizedBox(width: 10),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Status ticks (outgoing) + trailing timestamp.
          if (widget.isMe || widget.showTime)
            Padding(
              padding: EdgeInsets.only(
                top: 3,
                left: widget.isMe ? 0 : 36,
                right: widget.isMe ? AppSpacing.xs : 0,
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: widget.isMe
                    ? MainAxisAlignment.end
                    : MainAxisAlignment.start,
                children: [
                  if (widget.isMe) ...[
                    _statusIcon(),
                    const SizedBox(width: 3),
                  ],
                  if (widget.showTime)
                    Text(
                      timeLabel,
                      style: const TextStyle(
                        fontSize: 10,
                        color: AppColors.textMuted,
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Sender avatar (28px)
// ---------------------------------------------------------------------------

class _SenderAvatar extends StatelessWidget {
  const _SenderAvatar({required this.avatarUrl, required this.name});

  final String avatarUrl;
  final String name;

  @override
  Widget build(BuildContext context) {
    final initial = name.isEmpty ? '?' : name[0].toUpperCase();

    Widget initialChild() => Center(
          child: Text(
            initial,
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w700,
              color: AppColors.textPrimary,
            ),
          ),
        );

    Widget content;
    if (avatarUrl.isEmpty) {
      content = initialChild();
    } else if (avatarUrl.startsWith('http')) {
      content = Image.network(
        avatarUrl,
        fit: BoxFit.cover,
        width: 28,
        height: 28,
        errorBuilder: (_, __, ___) => initialChild(),
      );
    } else {
      content = Image.file(
        File(avatarUrl),
        fit: BoxFit.cover,
        width: 28,
        height: 28,
        errorBuilder: (_, __, ___) => initialChild(),
      );
    }

    return ClipOval(
      child: Container(
        width: 28,
        height: 28,
        color: AppColors.skeleton,
        child: content,
      ),
    );
  }
}
