import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';

import '../../models/report_model.dart';
import '../../services/local_db.dart';
import '../../services/report_service.dart';
import '../../theme/app_colors.dart';
import '../../widgets/shimmer_skeleton.dart';
import '../../widgets/state_widgets.dart';

class AdminReportsScreen extends StatelessWidget {
  const AdminReportsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Reports')),
      body: StreamBuilder<List<Report>>(
        stream: context.read<ReportService>().openReports(),
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return ErrorStateWidget(
              message: 'Could not load reports.',
              onRetry: () {},
            );
          }
          if (!snapshot.hasData) {
            return Center(
              child: ShimmerSkeleton.box(width: 240, height: 200, radius: 16),
            );
          }
          final reports = snapshot.data!;
          if (reports.isEmpty) {
            return const EmptyStateWidget(
              icon: Icons.flag_outlined,
              title: 'No open reports',
              message: 'Nothing has been reported yet.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: reports.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) =>
                _ReportRow(report: reports[index])
                    .animate()
                    .fadeIn(
                      duration: 300.ms,
                      delay: Duration(milliseconds: 40 * index),
                    ),
          );
        },
      ),
    );
  }
}

class _ReportRow extends StatefulWidget {
  const _ReportRow({required this.report});
  final Report report;

  @override
  State<_ReportRow> createState() => _ReportRowState();
}

class _ReportRowState extends State<_ReportRow> {
  String _targetLabel = '';
  String _reporterName = 'Unknown';

  @override
  void initState() {
    super.initState();
    _loadMetadata();
  }

  Future<void> _loadMetadata() async {
    final db = LocalStore.instance;
    final report = widget.report;

    // Resolve target label
    if (report.targetType == 'post') {
      final post = LocalStore.readDoc(db.posts, report.targetId);
      _targetLabel = post?['text'] as String? ?? 'Deleted post';
    } else if (report.targetType == 'event') {
      final event = LocalStore.readDoc(db.events, report.targetId);
      _targetLabel = event?['title'] as String? ?? 'Deleted event';
    }

    // Resolve reporter name
    final reporter = LocalStore.readDoc(db.users, report.reporterId);
    _reporterName = reporter?['name'] as String? ?? 'Unknown';

    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final report = widget.report;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.warningBg,
                  borderRadius: BorderRadius.circular(100),
                ),
                child: Text(
                  report.targetType.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.warning,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _targetLabel,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPrimary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Reported by $_reporterName',
            style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
          ),
          const SizedBox(height: 3),
          Text(
            '"${report.reason}"',
            style: const TextStyle(
              fontSize: 13,
              fontStyle: FontStyle.italic,
              color: AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textMuted,
                    side: const BorderSide(color: AppColors.border),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  onPressed: () => _dismiss(report.id),
                  child: const Text(
                    'Dismiss',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.danger,
                    side: const BorderSide(color: AppColors.danger),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(100),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  onPressed: () => _removeContent(report.id),
                  child: const Text(
                    'Remove content',
                    style:
                        TextStyle(fontSize: 12, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _dismiss(String reportId) async {
    await context.read<ReportService>().dismissReport(reportId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Report dismissed.')),
      );
    }
  }

  Future<void> _removeContent(String reportId) async {
    await context.read<ReportService>().removeContent(reportId);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Content removed.')),
      );
    }
  }
}
