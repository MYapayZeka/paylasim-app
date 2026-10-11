import { z } from 'zod';

export const RegisterUserSchema = z.object({
  fullName: z.string().min(2, 'Ad Soyad en az 2 karakter olmalıdır'),
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  phone: z.string().optional(),
  phoneNumber: z.string().optional(),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır').optional(),
  passwordHash: z.string().optional(),
}).refine((data) => data.password || data.passwordHash, {
  message: 'Şifre en az 6 karakter olmalıdır',
  path: ['password'],
});

export type RegisterUserInput = z.infer<typeof RegisterUserSchema>;

export const LoginUserSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(1, 'Şifre zorunludur').optional(),
  passwordHash: z.string().optional(),
}).refine((data) => data.password || data.passwordHash, {
  message: 'Şifre zorunludur',
  path: ['password'],
});

export type LoginUserInput = z.infer<typeof LoginUserSchema>;

export interface UserEntity {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  isVerified: boolean;
  listingCredits: number;
  deletedAt: Date | null;
  createdAt: Date;
}