import { UserEntity } from './auth.types';

export class AuthRepository {
  private static users: UserEntity[] = [];

  async findByEmail(email: string): Promise<UserEntity | null> {
    return AuthRepository.users.find((u) => u.email.toLowerCase() === email.toLowerCase() && !u.deletedAt) || null;
  }

  async findByPhone(phone: string): Promise<UserEntity | null> {
    return AuthRepository.users.find((u) => u.phone === phone && !u.deletedAt) || null;
  }

  async findById(id: string): Promise<UserEntity | null> {
    return AuthRepository.users.find((u) => u.id === id && !u.deletedAt) || null;
  }

  async create(data: Omit<UserEntity, 'id' | 'isVerified' | 'listingCredits' | 'deletedAt' | 'createdAt'>): Promise<UserEntity> {
    const newUser: UserEntity = {
      id: crypto.randomUUID(),
      ...data,
      email: data.email.toLowerCase(),
      isVerified: false,
      listingCredits: 3, // Ücretsiz 3 ilan hakkı
      deletedAt: null,
      createdAt: new Date(),
    };

    AuthRepository.users.push(newUser);
    return newUser;
  }

  async softDelete(id: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user) return false;

    user.deletedAt = new Date();
    return true;
  }
}