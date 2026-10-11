import { z } from 'zod';

export enum ItemCategory {
  TOOLS = 'TOOLS',
  CAMPING = 'CAMPING',
  ELECTRONICS = 'ELECTRONICS',
  HOME_GARDEN = 'HOME_GARDEN',
  SPORTS = 'SPORTS',
  VEHICLE_ACCESSORIES = 'VEHICLE_ACCESSORIES',
  OTHER = 'OTHER',
}

// İlan oluşturma istek şeması
export const CreateItemSchema = z.object({
  title: z.string().min(3, 'Başlık en az 3 karakter olmalıdır').max(100),
  description: z.string().min(10, 'Açıklama en az 10 karakter olmalıdır'),
  category: z.nativeEnum(ItemCategory),
  pricePerDay: z.number().nonnegative('Fiyat negatif olamaz'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  addressText: z.string().min(3),
  images: z.array(z.string().url()).default([]),
});

export type CreateItemInput = z.infer<typeof CreateItemSchema>;

// Harita arama sorgu şeması
export const SearchItemsQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  radiusMeters: z.coerce.number().positive().default(10000), // Varsayılan 10 km
  category: z.nativeEnum(ItemCategory).optional(),
});

export type SearchItemsQuery = z.infer<typeof SearchItemsQuerySchema>;

export interface ItemEntity {
  id: string;
  ownerId: string;
  title: string;
  description: string;
  category: ItemCategory;
  pricePerDay: number;
  latitude: number;
  longitude: number;
  addressText: string;
  images: string[];
  isActive: boolean;
  isFeatured: boolean;
  featuredUntil: Date | null;
  createdAt: Date;
}