import '../models/post_model.dart';
import 'local_db.dart';

class PostService {
  PostService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<String> createPost(Post post) async {
    final id = LocalStore.newId();
    await _db.posts.put(id, post.toMap());
    return id;
  }

  Stream<List<Post>> postsForEvent(String eventId) {
    return LocalStore.watchBox(
      _db.posts,
      where: (p) => p['eventId'] == eventId,
      sort: (a, b) {
        final da = DateTime.tryParse(a['postedAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final db = DateTime.tryParse(b['postedAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => Post.fromMap(e.$1, e.$2)).toList());
  }

  Future<void> deletePost(String postId) async {
    await _db.posts.delete(postId);
  }
}
