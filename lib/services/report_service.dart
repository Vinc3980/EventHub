import '../models/report_model.dart';
import 'local_db.dart';

class ReportService {
  ReportService() : _db = LocalStore.instance;

  final LocalStore _db;

  Future<String> createReport(Report report) async {
    final id = LocalStore.newId();
    await _db.reports.put(id, report.toMap());
    return id;
  }

  Stream<List<Report>> openReports() {
    return LocalStore.watchBox(
      _db.reports,
      where: (r) => r['status'] == 'open',
      sort: (a, b) {
        final da = DateTime.tryParse(a['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        final db = DateTime.tryParse(b['createdAt'] as String? ?? '') ??
            DateTime.fromMillisecondsSinceEpoch(0);
        return db.compareTo(da);
      },
    ).map((items) => items.map((e) => Report.fromMap(e.$1, e.$2)).toList());
  }

  Future<void> dismissReport(String reportId) async {
    final report = LocalStore.readDoc(_db.reports, reportId);
    if (report == null) return;
    await _db.reports.put(reportId, {...report, 'status': 'dismissed'});
  }

  Future<void> removeContent(String reportId) async {
    final report = LocalStore.readDoc(_db.reports, reportId);
    if (report == null) return;
    await _db.reports.put(reportId, {...report, 'status': 'removed'});
    // Remove the actual content
    final targetType = report['targetType'] as String?;
    final targetId = report['targetId'] as String?;
    if (targetId == null) return;
    if (targetType == 'post') {
      await _db.posts.delete(targetId);
    } else if (targetType == 'event') {
      await _db.events.delete(targetId);
    }
  }
}
