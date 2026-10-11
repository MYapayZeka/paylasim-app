import { prisma } from '../../config/prisma';
import { CreateTransactionInput } from './transactions.types';
import { AppError } from '../../core/errors/AppError';

function generateDeliveryPin(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export class TransactionsService {
  async requestBooking(borrowerId: string, input: CreateTransactionInput) {
    const item = await prisma.item.findUnique({
      where: { id: input.itemId },
    });

    if (!item) {
      throw new AppError('Kiralanmak istenen ilan bulunamadı.', 404);
    }

    if (!item.isActive) {
      throw new AppError('Bu ilan şu anda aktif değil.', 400);
    }

    if (item.ownerId === borrowerId) {
      throw new AppError('Kendi ilanınıza kiralama talebi oluşturamazsınız.', 400);
    }

    // Onaylanmış bir çakışma var mı kontrol et
    const conflict = await prisma.transaction.findFirst({
      where: {
        itemId: input.itemId,
        status: 'APPROVED',
        startDate: { lte: input.endDate },
        endDate: { gte: input.startDate },
      },
    });

    if (conflict) {
      throw new AppError('Seçilen tarih aralığında bu eşya zaten kiralanmış.', 409);
    }

    // Toplam süre ve ücret hesabı (Gün veya Saat - tam sayılarla)
    const diffTime = Math.abs(input.endDate.getTime() - input.startDate.getTime());
    const diffHours = diffTime / (1000 * 60 * 60);

    let totalPrice: number;
    if (diffHours <= 12) {
      // Saat bazlı kiralama (Maksimum 12 saat)
      const hoursCount = Math.max(1, Math.round(diffHours));
      const hourlyRate = Math.max(1, Math.round(item.pricePerDay / 8));
      totalPrice = Math.round(hoursCount * hourlyRate);
    } else {
      // Gün bazlı kiralama
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      totalPrice = Math.round(diffDays * item.pricePerDay);
    }
    const deliveryPin = generateDeliveryPin();

    const transaction = await prisma.transaction.create({
      data: {
        itemId: input.itemId,
        borrowerId,
        startDate: input.startDate,
        endDate: input.endDate,
        totalPrice,
        deposit: item.deposit || 0,
        status: 'PENDING',
        deliveryPin,
      },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    return {
      ...transaction,
      renter: transaction.borrower,
      owner: transaction.item?.owner,
    };
  }

  async getIncomingRequests(userId: string) {
    const list = await prisma.transaction.findMany({
      where: {
        item: { ownerId: userId },
      },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((tx) => ({
      ...tx,
      returnPin: undefined,
      renter: tx.borrower,
      owner: tx.item?.owner,
    }));
  }

  async getOutgoingRequests(userId: string) {
    const list = await prisma.transaction.findMany({
      where: {
        borrowerId: userId,
      },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phoneNumber: true,
          },
        },
        review: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return list.map((tx) => ({
      ...tx,
      renter: tx.borrower,
      owner: tx.item?.owner,
    }));
  }

  async approveBooking(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.item.ownerId !== userId) {
      throw new AppError('Yalnızca ilan sahibi bu talebi onaylayabilir.', 403);
    }

    if (transaction.status !== 'PENDING') {
      throw new AppError('Yalnızca beklemedeki (PENDING) talepler onaylanabilir.', 400);
    }

    // Çakışma / Çift Rezervasyon Engelleme: Ürün şu an kirada mı?
    const currentlyRented = await prisma.transaction.findFirst({
      where: {
        itemId: transaction.itemId,
        status: 'DELIVERED',
      },
    });

    if (currentlyRented) {
      throw new AppError(
        'Bu ürün şu anda başka bir kullanıcıda kiradadır (RENTED). Mevcut kiralama tamamlanmadan yeni bir talep onaylanamaz.',
        409
      );
    }

    // Onay anında çakışma kontrolü
    const conflict = await prisma.transaction.findFirst({
      where: {
        itemId: transaction.itemId,
        id: { not: transactionId },
        status: 'APPROVED',
        startDate: { lte: transaction.endDate },
        endDate: { gte: transaction.startDate },
      },
    });

    if (conflict) {
      throw new AppError('Bu tarihler arasında başka bir talep önceden onaylanmış.', 409);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'APPROVED' },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return {
      ...updated,
      renter: updated.borrower,
      owner: updated.item?.owner,
    };
  }

  async rejectBooking(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.item.ownerId !== userId) {
      throw new AppError('Yalnızca ilan sahibi bu talebi reddedebilir.', 403);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'REJECTED' },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return {
      ...updated,
      renter: updated.borrower,
      owner: updated.item?.owner,
    };
  }

  async cancelBooking(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId) {
      throw new AppError('Yalnızca talebi oluşturan kiracı iptal edebilir.', 403);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: 'CANCELLED' },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                phoneNumber: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return {
      ...updated,
      renter: updated.borrower,
      owner: updated.item?.owner,
    };
  }

  async getHandoverData(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        item: {
          include: {
            owner: {
              select: {
                id: true,
                fullName: true,
                iban: true,
              },
            },
          },
        },
        borrower: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Bu kiralama işlemine erişim yetkiniz yok.', 403);
    }

    let currentDeliveryPin = transaction.deliveryPin;
    if (!currentDeliveryPin) {
      currentDeliveryPin = generateDeliveryPin();
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { deliveryPin: currentDeliveryPin },
      });
    }

    const isOwner = transaction.item.ownerId === userId;

    return {
      transactionId: transaction.id,
      itemTitle: transaction.item.title,
      itemImage: transaction.item.images[0] || null,
      startDate: transaction.startDate,
      endDate: transaction.endDate,
      totalPrice: transaction.totalPrice,
      deposit: transaction.deposit || 0,
      deliveryPin: currentDeliveryPin,
      status: transaction.status,
      ownerName: transaction.item.owner.fullName,
      ownerIban: transaction.item.owner.iban || 'Belirtilmedi',
      borrowerName: transaction.borrower.fullName,
      ownerConfirmed: transaction.ownerConfirmed,
      borrowerConfirmed: transaction.borrowerConfirmed,
      protocolAccepted: transaction.protocolAccepted,
      protocolAcceptedAt: transaction.protocolAcceptedAt,
      earlyReturnRequested: transaction.earlyReturnRequested,
      earlyReturnRequestedAt: transaction.earlyReturnRequestedAt,
      returnPin: !isOwner ? (transaction.returnPin || undefined) : undefined,
      paymentMethod: transaction.paymentMethod,
      isOwner,
    };
  }

  async confirmHandshake(
    userId: string,
    transactionId: string,
    inputPin: string,
    paymentMethod?: string,
    protocolAccepted?: boolean
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        item: {
          include: {
            owner: true,
          },
        },
        borrower: true,
      },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Bu kiralama işlemine erişim yetkiniz yok.', 403);
    }

    if (transaction.status !== 'APPROVED' && transaction.status !== 'DELIVERED') {
      throw new AppError('Yalnızca onaylanmış talepler için teslimat tokalaşması yapılabilir.', 400);
    }

    const cleanInput = (inputPin || '').replace(/[#\s-]/g, '').trim();
    const cleanPin = (transaction.deliveryPin || '').replace(/[#\s-]/g, '').trim();

    if (!cleanPin || cleanInput !== cleanPin) {
      throw new AppError('Geçersiz 6 haneli teslimat PIN kodu.', 400);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'DELIVERED',
        ownerConfirmed: true,
        borrowerConfirmed: true,
        protocolAccepted: true,
        protocolAcceptedAt: new Date(),
        paymentMethod: paymentMethod || transaction.paymentMethod || 'HANDOVER_PIN',
      },
      include: {
        item: {
          include: {
            owner: true,
          },
        },
        borrower: true,
      },
    });

    return {
      success: true,
      transactionId: updated.id,
      status: updated.status,
      ownerConfirmed: true,
      borrowerConfirmed: true,
      bothConfirmed: true,
      protocolAccepted: updated.protocolAccepted,
      protocolAcceptedAt: updated.protocolAcceptedAt,
      paymentMethod: updated.paymentMethod,
      itemTitle: updated.item.title,
      deposit: updated.deposit,
    };
  }

  async requestEarlyReturn(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Yalnızca kiracı erken iade başlatabilir.', 403);
    }

    if (transaction.status !== 'DELIVERED') {
      throw new AppError('Yalnızca teslim edilmiş aktif kiralamalar için erken iade başlatılabilir.', 400);
    }

    const returnPin = Math.floor(100000 + Math.random() * 900000).toString();

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        earlyReturnRequested: true,
        earlyReturnRequestedAt: new Date(),
        returnPin,
      },
      include: { item: true },
    });

    return {
      success: true,
      transactionId: updated.id,
      earlyReturnRequested: true,
      earlyReturnRequestedAt: updated.earlyReturnRequestedAt,
      returnPin: updated.returnPin,
      message: `Erken iade süreci başlatıldı. İade Doğrulama Kodunuz: ${returnPin}. Eşyayı teslim ederken bu kodu satıcıya iletin.`,
    };
  }

  async confirmHandover(userId: string, transactionId: string, paymentMethod?: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    const isOwner = transaction.item.ownerId === userId;
    const isBorrower = transaction.borrowerId === userId;

    if (!isOwner && !isBorrower) {
      throw new AppError('Bu işlem için yetkiniz bulunmuyor.', 403);
    }

    if (transaction.status !== 'APPROVED' && transaction.status !== 'DELIVERED') {
      throw new AppError('Yalnızca onaylanmış talepler için teslimat işlemi yapılabilir.', 400);
    }

    const newOwnerConfirmed = isOwner ? true : transaction.ownerConfirmed;
    const newBorrowerConfirmed = isBorrower ? true : transaction.borrowerConfirmed;
    const newPaymentMethod = paymentMethod || transaction.paymentMethod || 'IBAN';

    const bothConfirmed = newOwnerConfirmed && newBorrowerConfirmed;

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        ownerConfirmed: newOwnerConfirmed,
        borrowerConfirmed: newBorrowerConfirmed,
        paymentMethod: newPaymentMethod,
        protocolAccepted: true,
        protocolAcceptedAt: new Date(),
        status: bothConfirmed ? 'DELIVERED' : transaction.status,
      },
    });

    return {
      success: true,
      transactionId: updated.id,
      status: updated.status,
      ownerConfirmed: updated.ownerConfirmed,
      borrowerConfirmed: updated.borrowerConfirmed,
      paymentMethod: updated.paymentMethod,
      bothConfirmed,
    };
  }

  async confirmReturn(userId: string, transactionId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.item.ownerId !== userId && transaction.borrowerId !== userId) {
      throw new AppError('Bu işlem için yetkiniz bulunmuyor.', 403);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        earlyReturnRequested: false,
      },
      include: { item: true },
    });

    return {
      success: true,
      transactionId: updated.id,
      status: updated.status,
      itemTitle: updated.item.title,
      deposit: updated.deposit,
      message:
        updated.deposit > 0
          ? `İade tamamlandı. Varsa alınan ${updated.deposit} TL güvence bedelini (depozito) kiracıya teslim etmeyi unutmayın.`
          : 'İade başarıyla tamamlandı.',
    };
  }

  async confirmEarlyReturn(userId: string, transactionId: string, inputPin?: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true, borrower: true },
    });

    if (!transaction) {
      throw new AppError('Rezervasyon kaydı bulunamadı.', 404);
    }

    if (transaction.item.ownerId !== userId) {
      throw new AppError('Yalnızca ürün sahibi (satıcı) erken iadeyi onaylayabilir.', 403);
    }

    if (transaction.status !== 'DELIVERED') {
      throw new AppError('Yalnızca teslim edilmiş aktif kiralamalar için erken iade onaylanabilir.', 400);
    }

    if (!transaction.earlyReturnRequested) {
      throw new AppError('Kiracı henüz erken iade talebinde bulunmamış.', 400);
    }

    const cleanInput = (inputPin || '').replace(/[#\s-]/g, '').trim();
    const cleanPin = (transaction.returnPin || '').replace(/[#\s-]/g, '').trim();

    if (!cleanPin || cleanInput !== cleanPin) {
      throw new AppError('Geçersiz 6 haneli iade PIN kodu. Lütfen kiracıdan aldığınız kodu kontrol edin.', 400);
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: 'COMPLETED',
        earlyReturnRequested: false,
      },
      include: { item: true, borrower: true },
    });

    return {
      success: true,
      transactionId: updated.id,
      status: updated.status,
      itemTitle: updated.item.title,
      deposit: updated.deposit,
      message:
        updated.deposit > 0
          ? `Erken iade başarıyla tamamlandı. Varsa alınan ${updated.deposit} TL depozitoyu kiracıya iade etmeyi unutmayın.`
          : 'Erken iade başarıyla onaylandı ve ürün teslim alındı.',
    };
  }

  async addReview(
    userId: string,
    transactionId: string,
    data: { itemRating: number; ownerRating: number; comment?: string }
  ) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { item: true, review: true },
    });

    if (!transaction) {
      throw new AppError('Kiralama kaydı bulunamadı.', 404);
    }

    if (transaction.borrowerId !== userId && transaction.item.ownerId !== userId) {
      throw new AppError('Yalnızca bu kiralamanın tarafları değerlendirme yapabilir.', 403);
    }

    if (transaction.status !== 'COMPLETED' && transaction.status !== 'DELIVERED') {
      throw new AppError('Yalnızca tamamlanmış veya teslim edilmiş kiralamalar değerlendirilebilir.', 400);
    }

    if (transaction.review) {
      throw new AppError('Bu kiralama için zaten değerlendirme yapılmış.', 400);
    }

    const itemRating = Math.max(1, Math.min(5, Math.round(Number(data.itemRating) || 5)));
    const ownerRating = Math.max(1, Math.min(5, Math.round(Number(data.ownerRating) || 5)));

    const targetUserId =
      transaction.borrowerId === userId ? transaction.item.ownerId : transaction.borrowerId;

    const review = await prisma.review.create({
      data: {
        transactionId,
        reviewerId: userId,
        targetUserId,
        itemId: transaction.itemId,
        itemRating,
        ownerRating,
        comment: data.comment?.trim() || null,
      },
      include: {
        reviewer: {
          select: { id: true, fullName: true, avatarUrl: true },
        },
      },
    });

    // Eşyanın yeni puan ortalamasını hesapla
    const allItemReviews = await prisma.review.findMany({
      where: { itemId: transaction.itemId },
      select: { itemRating: true },
    });
    if (allItemReviews.length > 0) {
      const avgItemRating =
        allItemReviews.reduce((sum, r) => sum + r.itemRating, 0) / allItemReviews.length;
      await prisma.item.update({
        where: { id: transaction.itemId },
        data: {
          rating: Number(avgItemRating.toFixed(1)),
          ratingCount: allItemReviews.length,
        },
      });
    }

    // Hedef kullanıcının yeni puan ortalamasını hesapla
    const allOwnerReviews = await prisma.review.findMany({
      where: { targetUserId },
      select: { ownerRating: true },
    });
    if (allOwnerReviews.length > 0) {
      const avgOwnerRating =
        allOwnerReviews.reduce((sum, r) => sum + r.ownerRating, 0) / allOwnerReviews.length;
      await prisma.user.update({
        where: { id: targetUserId },
        data: {
          rating: Number(avgOwnerRating.toFixed(1)),
          ratingCount: allOwnerReviews.length,
        },
      });
    }

    return review;
  }
}

export const transactionsService = new TransactionsService();