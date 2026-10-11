import { prisma } from '../../config/prisma';
import { AppError } from '../../core/errors/AppError';

export class ItemService {
  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async createItem(
    userId: string,
    data: {
      title: string;
      description: string;
      category?: string;
      pricePerDay: number | string;
      deposit?: number | string;
      realLatitude?: number;
      realLongitude?: number;
      latitude?: number;
      longitude?: number;
      fuzzyLatitude?: number;
      fuzzyLongitude?: number;
      addressText: string;
      images?: string[];
    }
  ) {
    const realLat = Number(data.realLatitude ?? data.latitude ?? 40.9905);
    const realLng = Number(data.realLongitude ?? data.longitude ?? 29.0295);

    const fuzzyLat =
      data.fuzzyLatitude ??
      Number((realLat + (Math.random() - 0.5) * 0.003).toFixed(6));
    const fuzzyLng =
      data.fuzzyLongitude ??
      Number((realLng + (Math.random() - 0.5) * 0.003).toFixed(6));

    const item = await prisma.item.create({
      data: {
        ownerId: userId,
        title: data.title,
        description: data.description,
        category: (data.category as any) || 'OTHER',
        pricePerDay: Number(data.pricePerDay),
        deposit: Number(data.deposit || 0),
        realLatitude: realLat,
        realLongitude: realLng,
        fuzzyLatitude: fuzzyLat,
        fuzzyLongitude: fuzzyLng,
        addressText: data.addressText || 'Konum Belirtilmedi',
        images: data.images || [],
      },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
          },
        },
      },
    });

    return item;
  }

  async getAllItems(filters?: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    availableOnly?: boolean;
  }) {
    const whereClause: any = { isActive: true };

    if (filters?.category && filters.category !== 'ALL') {
      whereClause.category = filters.category;
    }

    if (filters?.search && filters.search.trim()) {
      whereClause.OR = [
        { title: { contains: filters.search.trim(), mode: 'insensitive' } },
        { description: { contains: filters.search.trim(), mode: 'insensitive' } },
        { addressText: { contains: filters.search.trim(), mode: 'insensitive' } },
      ];
    }

    if (filters?.minPrice !== undefined && !isNaN(filters.minPrice)) {
      whereClause.pricePerDay = {
        ...(whereClause.pricePerDay || {}),
        gte: filters.minPrice,
      };
    }

    if (filters?.maxPrice !== undefined && !isNaN(filters.maxPrice)) {
      whereClause.pricePerDay = {
        ...(whereClause.pricePerDay || {}),
        lte: filters.maxPrice,
      };
    }

    const items = await prisma.item.findMany({
      where: whereClause,
      select: {
        id: true,
        ownerId: true,
        title: true,
        description: true,
        category: true,
        pricePerDay: true,
        deposit: true,
        fuzzyLatitude: true,
        fuzzyLongitude: true,
        addressText: true,
        images: true,
        isActive: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
        owner: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            rating: true,
            ratingCount: true,
          },
        },
        transactions: {
          where: {
            status: 'DELIVERED',
          },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
          },
          take: 1,
          orderBy: { endDate: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const mappedItems = items.map((item) => {
      const activeRental =
        item.transactions && item.transactions.length > 0 ? item.transactions[0] : null;
      const isRented = !!activeRental;
      const rentalEndDate = activeRental?.endDate ? activeRental.endDate.toISOString() : null;
      const activeTransactionId = activeRental?.id || null;

      const { transactions, ...rest } = item;
      return {
        ...rest,
        isRented,
        rentalEndDate,
        activeTransactionId,
      };
    });

    if (filters?.availableOnly) {
      return mappedItems.filter((item) => !item.isRented);
    }

    return mappedItems;
  }

  async searchNearby(params: {
    lat?: number;
    lng?: number;
    radiusMeters?: number;
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    availableOnly?: boolean;
  }) {
    const {
      lat,
      lng,
      radiusMeters = 50000,
      category,
      search,
      minPrice,
      maxPrice,
      availableOnly,
    } = params;
    const items = await this.getAllItems({
      category,
      search,
      minPrice,
      maxPrice,
      availableOnly,
    });

    if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
      return items;
    }

    const itemsWithDistance = items.map((item) => {
      const distance = this.calculateDistanceMeters(
        lat,
        lng,
        item.fuzzyLatitude,
        item.fuzzyLongitude
      );
      return {
        ...item,
        distanceMeters: Math.round(distance),
      };
    });

    return itemsWithDistance
      .filter((item) => item.distanceMeters <= radiusMeters)
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }

  async getItemById(id: string) {
    const item = await prisma.item.findUnique({
      where: { id },
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
            rating: true,
            ratingCount: true,
          },
        },
        transactions: {
          where: {
            status: 'DELIVERED',
          },
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
          },
          take: 1,
          orderBy: { endDate: 'desc' },
        },
      },
    });

    if (!item) {
      throw new AppError('İlan bulunamadı.', 404);
    }

    const activeRental =
      item.transactions && item.transactions.length > 0 ? item.transactions[0] : null;
    const isRented = !!activeRental;
    const rentalEndDate = activeRental?.endDate ? activeRental.endDate.toISOString() : null;
    const activeTransactionId = activeRental?.id || null;

    const { transactions, ...rest } = item;
    return {
      ...rest,
      isRented,
      rentalEndDate,
      activeTransactionId,
    };
  }

  async getMyItems(userId: string) {
    return prisma.item.findMany({
      where: { ownerId: userId },
      include: {
        transactions: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            borrower: {
              select: {
                id: true,
                fullName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            transactions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getItemReviews(itemId: string) {
    return prisma.review.findMany({
      where: { itemId },
      include: {
        reviewer: {
          select: {
            id: true,
            fullName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateItem(
    userId: string,
    itemId: string,
    data: {
      title?: string;
      description?: string;
      category?: string;
      pricePerDay?: number | string;
      deposit?: number | string;
      images?: string[];
      addressText?: string;
      realLatitude?: number;
      realLongitude?: number;
    }
  ) {
    const item = await prisma.item.findUnique({
      where: { id: itemId },
      include: {
        transactions: {
          where: {
            status: 'DELIVERED',
          },
        },
      },
    });

    if (!item) {
      throw new AppError('İlan bulunamadı.', 404);
    }
    if (item.ownerId !== userId) {
      throw new AppError('Bu ilanı yalnızca sahibi düzenleyebilir.', 403);
    }

    const isRented = item.transactions.length > 0;
    if (isRented) {
      if (
        (data.pricePerDay !== undefined && Number(data.pricePerDay) !== item.pricePerDay) ||
        (data.deposit !== undefined && Number(data.deposit) !== item.deposit)
      ) {
        throw new AppError(
          'İlan şu anda kirada olduğu için kiracıyı korumak adına fiyat ve depozito güncellenemez.',
          400
        );
      }
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category as any;
    if (data.addressText !== undefined) updateData.addressText = data.addressText;
    if (data.images !== undefined) {
      updateData.images = Array.isArray(data.images) ? data.images.slice(0, 10) : [];
    }

    if (data.realLatitude !== undefined && data.realLongitude !== undefined) {
      updateData.realLatitude = Number(data.realLatitude);
      updateData.realLongitude = Number(data.realLongitude);
      updateData.fuzzyLatitude = Number((Number(data.realLatitude) + (Math.random() - 0.5) * 0.003).toFixed(6));
      updateData.fuzzyLongitude = Number((Number(data.realLongitude) + (Math.random() - 0.5) * 0.003).toFixed(6));
    }

    if (!isRented) {
      if (data.pricePerDay !== undefined) updateData.pricePerDay = Number(data.pricePerDay);
      if (data.deposit !== undefined) updateData.deposit = Number(data.deposit || 0);
    }

    const updated = await prisma.item.update({
      where: { id: itemId },
      data: updateData,
      include: {
        owner: {
          select: {
            id: true,
            fullName: true,
            phoneNumber: true,
            avatarUrl: true,
          },
        },
      },
    });

    return updated;
  }

  async deleteItem(userId: string, itemId: string) {
    const item = await prisma.item.findUnique({ where: { id: itemId } });
    if (!item) {
      throw new AppError('İlan bulunamadı.', 404);
    }
    if (item.ownerId !== userId) {
      throw new AppError('Bu ilanı yalnızca sahibi silebilir.', 403);
    }
    await prisma.item.delete({ where: { id: itemId } });
    return true;
  }
}

export const itemService = new ItemService();