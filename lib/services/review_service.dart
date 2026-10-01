import '../models/review_model.dart';
import 'local_db.dart';

class ReviewService {
  ReviewService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<String> addReview(Review review) async {
    final id = LocalStore.newId();
    await _db.reviews.put(id, review.toMap());
    return id;
  }

  Stream<List<Review>> reviewsForOrganizer(String organizerId) {
    return LocalStore.watchBox(
      _db.reviews,
      where: (r) => r['organizerId'] == organizerId,
      sort: (a, b) {
        final da = DateTime.tryParse(a['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final db = DateTime.tryParse(b['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => Review.fromMap(e.$1, e.$2)).toList());
  }

  Stream<List<Review>> reviewsForEvent(String eventId) {
    return LocalStore.watchBox(
      _db.reviews,
      where: (r) => r['eventId'] == eventId,
    ).map((items) => items.map((e) => Review.fromMap(e.$1, e.$2)).toList());
  }

  double averageRating(String organizerId) {
    double total = 0;
    int count = 0;
    for (final entry in _db.reviews.toMap().entries) {
      if (entry.value['organizerId'] == organizerId) {
        total += (entry.value['rating'] as num?)?.toDouble() ?? 0;
        count++;
      }
    }
    return count == 0 ? 0 : total / count;
  }

  int reviewCount(String organizerId) {
    int count = 0;
    for (final entry in _db.reviews.toMap().entries) {
      if (entry.value['organizerId'] == organizerId) count++;
    }
    return count;
  }

  bool hasReviewed({
    required String eventId,
    required String attendeeId,
  }) {
    for (final entry in _db.reviews.toMap().entries) {
      if (entry.value['eventId'] == eventId &&
          entry.value['attendeeId'] == attendeeId) {
        return true;
      }
    }
    return false;
  }
}
