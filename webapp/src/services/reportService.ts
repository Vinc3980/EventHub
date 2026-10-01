import { liveQuery, type Observable } from 'dexie';
import { id } from '../lib/ids';
import { db } from '../db/db';
import { Report } from '../models';

const rowId = (row: Record<string, unknown>): string => String(row.id ?? '');

export class ReportService {
  async createReport(report: Report): Promise<string> {
    const reportId = id('rpt');
    await db.reports.put({ ...report.toMap(), id: reportId });
    return reportId;
  }

  openReports(): Observable<Report[]> {
    return liveQuery(async () => {
      const rows = await db.reports.toArray();
      const reports = rows
        .filter((row) => row.status === 'open')
        .map((row) => Report.fromMap(rowId(row), row));
      reports.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return reports;
    });
  }

  async dismissReport(reportId: string): Promise<void> {
    const report = await db.reports.get(reportId);
    if (!report) return;
    await db.reports.put({ ...report, status: 'dismissed' });
  }

  async removeContent(reportId: string): Promise<void> {
    const report = await db.reports.get(reportId);
    if (!report) return;
    await db.reports.put({ ...report, status: 'removed' });
    const targetType = typeof report.targetType === 'string' ? report.targetType : null;
    const targetId = typeof report.targetId === 'string' ? report.targetId : null;
    if (targetId === null) return;
    if (targetType === 'post') {
      await db.posts.delete(targetId);
    } else if (targetType === 'event') {
      await db.events.delete(targetId);
    }
  }
}

export const reportService = new ReportService();
