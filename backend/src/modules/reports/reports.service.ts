import { prisma } from '../../config/prisma';
import { AppError } from '../../core/errors/AppError';

export class ReportsService {
  async submitReport(reporterId: string, input: any) {
    const targetUserId = input.reportedUserId || input.targetUserId;
    if (!targetUserId) {
      throw new AppError('Şikayet edilecek kullanıcı belirtilmelidir.', 400);
    }
    if (targetUserId === reporterId) {
      throw new AppError('Kendi kendinizi şikayet edemezsiniz.', 400);
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new AppError('Şikayet edilen kullanıcı bulunamadı.', 404);
    }

    return prisma.report.create({
      data: {
        reporterId,
        targetUserId,
        reason: String(input.reason || 'OTHER'),
        details: input.description || input.details || null,
      },
    });
  }

  async blockUser(blockerId: string, targetUserId: string) {
    if (blockerId === targetUserId) {
      throw new AppError('Kendinizi engelleyemezsiniz.', 400);
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      throw new AppError('Engellenecek kullanıcı bulunamadı.', 404);
    }

    return prisma.user.update({
      where: { id: targetUserId },
      data: { isBlocked: true },
      select: { id: true, fullName: true, isBlocked: true },
    });
  }
}

export const reportsService = new ReportsService();