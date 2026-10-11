import { prisma } from '../../config/prisma';
import { AppError } from '../../core/errors/AppError';

export class ChatService {
  async getMessages(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Kiralama kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Bu sohbete erişim yetkiniz yok.', 403);
    }

    // Karşı taraf sohbeti açtığında, kendisine gelen okunmamış mesajları 'READ' olarak işaretle
    await prisma.message.updateMany({
      where: {
        transactionId,
        senderId: { not: userId },
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return prisma.message.findMany({
      where: { transactionId },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async sendMessage(userId: string, transactionId: string, content: string) {
    if (!content || !content.trim()) {
      throw new AppError('Mesaj içeriği boş olamaz.', 400);
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Kiralama kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Bu sohbete mesaj gönderme yetkiniz yok.', 403);
    }

    return prisma.message.create({
      data: {
        transactionId,
        senderId: userId,
        content: content.trim(),
        status: 'SENT',
      },
      include: {
        sender: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });
  }

  async markAsRead(userId: string, transactionId: string) {
    const result = await prisma.message.updateMany({
      where: {
        transactionId,
        senderId: { not: userId },
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });

    return { updatedCount: result.count };
  }

  async getConversations(userId: string) {
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [
          { borrowerId: userId },
          { item: { ownerId: userId } },
        ],
      },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Kullanıcı tarafından gizlenmiş / arşivlenmiş konuşmaları filtrele
    const activeTransactions = transactions.filter(
      (tx) => !(tx.archivedByUserIds || []).includes(userId)
    );

    // Her konuşma için okunmamış mesaj sayısını ve karşı taraf bilgilerini derle
    const conversations = await Promise.all(
      activeTransactions.map(async (tx) => {
        const isOwner = tx.item.ownerId === userId;
        const counterpart = isOwner ? tx.borrower : tx.item.owner;
        const lastMessage = tx.messages[0] || null;

        const unreadCount = await prisma.message.count({
          where: {
            transactionId: tx.id,
            senderId: { not: userId },
            status: { not: 'READ' },
          },
        });

        return {
          transactionId: tx.id,
          itemId: tx.itemId,
          itemTitle: tx.item.title,
          itemImage: tx.item.images[0] || null,
          pricePerDay: tx.item.pricePerDay,
          totalPrice: tx.totalPrice,
          status: tx.status,
          counterpartName: counterpart?.fullName || 'Kullanıcı',
          counterpartId: counterpart?.id || '',
          counterpartAvatar: counterpart?.avatarUrl || null,
          isOwner,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                createdAt: lastMessage.createdAt,
                senderId: lastMessage.senderId,
                status: lastMessage.status,
              }
            : null,
          unreadCount,
          updatedAt: lastMessage ? lastMessage.createdAt : tx.updatedAt,
        };
      })
    );

    // Son mesaj tarihine göre yeniden sırala
    return conversations.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async getUnreadCount(userId: string) {
    try {
      if (!userId) {
        return { unreadCount: 0, count: 0 };
      }

      const transactions = await prisma.transaction.findMany({
        where: {
          OR: [
            { borrowerId: userId },
            { item: { ownerId: userId } },
          ],
        },
        select: {
          id: true,
          archivedByUserIds: true,
        },
      });

      const activeTxIds = (transactions || [])
        .filter((tx) => !((tx as any)?.archivedByUserIds || []).includes(userId))
        .map((tx) => tx.id);

      if (activeTxIds.length === 0) {
        return { unreadCount: 0, count: 0 };
      }

      const count = await prisma.message.count({
        where: {
          transactionId: { in: activeTxIds },
          senderId: { not: userId },
          status: { not: 'READ' },
        },
      });

      return { unreadCount: count || 0, count: count || 0 };
    } catch (err: any) {
      console.warn('[ChatService] getUnreadCount hatası güvenle ele alındı:', err?.message);
      return { unreadCount: 0, count: 0 };
    }
  }

  async archiveConversation(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Konuşma bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Bu konuşmayı arşivleme yetkiniz yok.', 403);
    }

    const currentList = transaction.archivedByUserIds || [];
    if (!currentList.includes(userId)) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: {
          archivedByUserIds: [...currentList, userId],
        },
      });
    }

    return { success: true, transactionId };
  }
}

export const chatService = new ChatService();
