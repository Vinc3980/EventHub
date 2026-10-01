import 'dart:io';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../../models/post_model.dart';
import '../../services/auth_service.dart';
import '../../services/post_service.dart';
import '../../theme/app_colors.dart';

class EventPhotosScreen extends StatefulWidget {
  const EventPhotosScreen({super.key, required this.eventId});

  final String eventId;

  @override
  State<EventPhotosScreen> createState() => _EventPhotosScreenState();
}

class _EventPhotosScreenState extends State<EventPhotosScreen> {
  bool _uploading = false;

  Future<void> _pickAndUpload() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.gallery);
    if (picked == null) return;

    setState(() => _uploading = true);

    try {
      // In local-only mode, we store the local file path as the "URL".
      // When Firebase Storage is introduced, this becomes a real upload.
      final localPath = picked.path;

      final uid = context.read<AuthService>().currentUid ?? '';
      final postService = context.read<PostService>();

      await postService.createPost(Post(
        id: '',
        authorId: uid,
        eventId: widget.eventId,
        text: '',
        mediaUrls: [localPath],
        postedAt: DateTime.now(),
      ));

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Photo uploaded.')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Upload failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _uploading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final postService = context.read<PostService>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Photos'),
        actions: [
          if (_uploading)
            const Padding(
              padding: EdgeInsets.all(16),
              child: SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            )
          else
            IconButton(
              icon: const Icon(Icons.add_photo_alternate_outlined),
              onPressed: _pickAndUpload,
            ),
        ],
      ),
      body: StreamBuilder<List<Post>>(
        stream: postService.postsForEvent(widget.eventId),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return const Center(
              child: Padding(
                padding: EdgeInsets.all(32),
                child: Text(
                  'Could not load photos.',
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
          final posts = snapshot.data!;
          final photoPosts =
              posts.where((p) => p.mediaUrls.isNotEmpty).toList();

          if (photoPosts.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.skeleton,
                      borderRadius: BorderRadius.circular(24),
                    ),
                    child: const Icon(Icons.photo_library_outlined,
                        size: 32, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'No photos yet',
                    style: TextStyle(
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Be the first to share a photo.',
                    style: TextStyle(fontSize: 14, color: AppColors.textMuted),
                  ),
                  const SizedBox(height: 24),
                  ElevatedButton.icon(
                    onPressed: _pickAndUpload,
                    icon: const Icon(Icons.add, size: 18),
                    label: const Text('Add photo'),
                  ),
                ],
              ),
            );
          }
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 3,
              crossAxisSpacing: 4,
              mainAxisSpacing: 4,
            ),
            itemCount: photoPosts.length,
            itemBuilder: (context, index) {
              final post = photoPosts[index];
              final url = post.mediaUrls.first;
              return GestureDetector(
                onTap: () => _showFullImage(context, url),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: url.startsWith('/')
                      ? Image.file(File(url), fit: BoxFit.cover)
                      : Image.network(url,
                          fit: BoxFit.cover,
                          errorBuilder: (_, __, ___) => Container(
                            color: AppColors.skeleton,
                            child: const Icon(Icons.broken_image,
                                color: AppColors.textMuted),
                          )),
                ),
              );
            },
          );
        },
      ),
    );
  }

  void _showFullImage(BuildContext context, String url) {
    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          backgroundColor: Colors.black,
          appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
          body: Center(
            child: url.startsWith('/')
                ? Image.file(File(url), fit: BoxFit.contain)
                : Image.network(url,
                    fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(Icons.broken_image,
                        color: Colors.white54, size: 48)),
          ),
        ),
      ),
    );
  }
}
