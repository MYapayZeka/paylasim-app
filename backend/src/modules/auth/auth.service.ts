import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/prisma';
import { AppError } from '../../core/errors/AppError';

export class AuthService {
  async register(data: {
    email: string;
    password?: string;
    passwordHash?: string;
    fullName: string;
    phoneNumber?: string;
    phone?: string;
  }) {
    const rawPassword = data.password || data.passwordHash;
    if (!rawPassword || rawPassword.length < 6) {
      throw new AppError('Şifre en az 6 karakter olmalıdır.', 400);
    }

    const phoneNum = data.phoneNumber || data.phone || null;

    const existing = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (existing) {
      throw new AppError('Bu e-posta adresiyle kayıtlı bir hesap zaten var.', 400);
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(rawPassword, salt);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: hashedPassword,
        fullName: data.fullName,
        phoneNumber: phoneNum,
      },
    });

    const token = this.generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        rating: user.rating,
        ratingCount: user.ratingCount,
        role: user.role,
      },
    };
  }

  async login(data: { email: string; password?: string; passwordHash?: string }) {
    const rawPassword = data.password || data.passwordHash;
    if (!rawPassword) {
      throw new AppError('Şifre zorunludur.', 400);
    }

    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      throw new AppError('Geçersiz e-posta veya şifre.', 401);
    }

    if (user.isBlocked) {
      throw new AppError('Hesabınız askıya alınmıştır.', 403);
    }

    const isMatch = await bcrypt.compare(rawPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Geçersiz e-posta veya şifre.', 401);
    }

    const token = this.generateToken(user.id);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        avatarUrl: user.avatarUrl,
        rating: user.rating,
        ratingCount: user.ratingCount,
        role: user.role,
      },
    };
  }

  async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        iban: true,
        avatarUrl: true,
        rating: true,
        ratingCount: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }

    return user;
  }

  async getProfile(userId: string) {
    return this.getMe(userId);
  }

  async updateProfile(
    userId: string,
    data: { fullName?: string; phoneNumber?: string; iban?: string; avatarUrl?: string }
  ) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }

    return prisma.user.update({
      where: { id: userId },
      data: {
        fullName: data.fullName ?? user.fullName,
        phoneNumber: data.phoneNumber !== undefined ? data.phoneNumber : user.phoneNumber,
        iban: data.iban !== undefined ? data.iban : user.iban,
        avatarUrl: data.avatarUrl !== undefined ? data.avatarUrl : user.avatarUrl,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        phoneNumber: true,
        iban: true,
        avatarUrl: true,
        rating: true,
        ratingCount: true,
        role: true,
      },
    });
  }

  // Satıcı Genel Profili (Gizlilik Korumalı: Asla email, telefon, iban içermez!)
  async getPublicProfile(targetUserId: string) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        rating: true,
        ratingCount: true,
        createdAt: true,
        items: {
          where: { isActive: true },
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            pricePerDay: true,
            images: true,
            rating: true,
            ratingCount: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }

    return user;
  }

  // Kullanıcının aldığı değerlendirmeler
  async getUserReviews(targetUserId: string) {
    return prisma.review.findMany({
      where: { targetUserId },
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

  async deleteAccount(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('Kullanıcı bulunamadı.', 404);
    }
    await prisma.user.delete({ where: { id: userId } });
    return true;
  }

  private generateToken(userId: string): string {
    const secret = process.env.JWT_SECRET || 'gizli_anahtar';
    return jwt.sign({ sub: userId, id: userId }, secret, { expiresIn: '30d' });
  }
}