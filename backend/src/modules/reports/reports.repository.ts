import { ReportEntity, BlockEntity, CreateReportInput, ReportStatus } from './reports.types';

export class ReportsRepository {
  private static reports: ReportEntity[] = [];
  private static blocks: BlockEntity[] = [];

  async createReport(reporterId: string, input: CreateReportInput): Promise<ReportEntity> {
    const report: ReportEntity = {
      id: crypto.randomUUID(),
      reporterId,
      reportedUserId: input.reportedUserId,
      reportedItemId: input.reportedItemId,
      reason: input.reason,
      description: input.description,
      status: ReportStatus.PENDING,
      createdAt: new Date(),
    };

    ReportsRepository.reports.push(report);
    return report;
  }

  async blockUser(blockerId: string, blockedId: string): Promise<BlockEntity> {
    const exists = ReportsRepository.blocks.some(
      (b) => b.blockerId === blockerId && b.blockedId === blockedId
    );

    if (exists) {
      return ReportsRepository.blocks.find(
        (b) => b.blockerId === blockerId && b.blockedId === blockedId
      )!;
    }

    const block: BlockEntity = {
      id: crypto.randomUUID(),
      blockerId,
      blockedId,
      createdAt: new Date(),
    };

    ReportsRepository.blocks.push(block);
    return block;
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    return ReportsRepository.blocks.some(
      (b) => (b.blockerId === userA && b.blockedId === userB) ||
             (b.blockerId === userB && b.blockedId === userA)
    );
  }

  async listBlockedUserIds(userId: string): Promise<string[]> {
    return ReportsRepository.blocks
      .filter((b) => b.blockerId === userId)
      .map((b) => b.blockedId);
  }
}