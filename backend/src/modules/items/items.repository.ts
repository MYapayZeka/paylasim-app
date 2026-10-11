import { ItemEntity, CreateItemInput } from './items.types';

export class ItemsRepository {
  private static items: ItemEntity[] = [];

  // Haversine formülü ile iki koordinat arası metre hesabı
  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Dünya yarıçapı (metre)
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

  async create(ownerId: string, input: CreateItemInput): Promise<ItemEntity> {
    const newItem: ItemEntity = {
      id: crypto.randomUUID(),
      ownerId,
      title: input.title,
      description: input.description,
      category: input.category,
      pricePerDay: input.pricePerDay,
      latitude: input.latitude,
      longitude: input.longitude,
      addressText: input.addressText,
      images: input.images,
      isActive: true,
      isFeatured: false,
      featuredUntil: null,
      createdAt: new Date(),
    };

    ItemsRepository.items.push(newItem);
    return newItem;
  }

  async findNearby(
    lat: number,
    lng: number,
    radiusMeters: number,
    category?: string
  ): Promise<{ item: ItemEntity; distanceMeters: number }[]> {
    const results: { item: ItemEntity; distanceMeters: number }[] = [];

    for (const item of ItemsRepository.items) {
      if (!item.isActive) continue;
      if (category && item.category !== category) continue;

      const distance = this.calculateDistanceMeters(lat, lng, item.latitude, item.longitude);
      if (distance <= radiusMeters) {
        results.push({ item, distanceMeters: Math.round(distance) });
      }
    }

    // Önce öne çıkanlar (Featured), sonra en yakından uzağa sıralama
    return results.sort((a, b) => {
      if (a.item.isFeatured && !b.item.isFeatured) return -1;
      if (!a.item.isFeatured && b.item.isFeatured) return 1;
      return a.distanceMeters - b.distanceMeters;
    });
  }

  async findById(id: string): Promise<ItemEntity | null> {
    return ItemsRepository.items.find((item) => item.id === id) || null;
  }
}