import { TransactionEntity, TransactionStatus } from './transactions.types';

export class TransactionsRepository {
  private static transactions: TransactionEntity[] = [];

  // Tarih çakışması kontrolü (Aynı ilan için APPROVED olan çakışan rezervasyon var mı?)
  async hasOverlappingReservation(
    itemId: string,
    startDate: Date,
    endDate: Date
  ): Promise<boolean> {
    return TransactionsRepository.transactions.some((t) => {
      if (t.itemId !== itemId) return false;
      if (t.status !== TransactionStatus.APPROVED) return false;

      // İki tarih aralığının çakışma mantığı:
      // (StartA <= EndB) and (EndA >= StartB)
      return t.startDate <= endDate && t.endDate >= startDate;
    });
  }

  async create(
    borrowerId: string,
    itemId: string,
    startDate: Date,
    endDate: Date,
    totalPrice: number
  ): Promise<TransactionEntity> {
    const transaction: TransactionEntity = {
      id: crypto.randomUUID(),
      itemId,
      borrowerId,
      startDate,
      endDate,
      totalPrice,
      status: TransactionStatus.PENDING,
      createdAt: new Date(),
    };

    TransactionsRepository.transactions.push(transaction);
    return transaction;
  }

  async findById(id: string): Promise<TransactionEntity | null> {
    return TransactionsRepository.transactions.find((t) => t.id === id) || null;
  }

  async updateStatus(id: string, status: TransactionStatus): Promise<TransactionEntity | null> {
    const transaction = await this.findById(id);
    if (!transaction) return null;

    transaction.status = status;
    return transaction;
  }

  async listByItem(itemId: string): Promise<TransactionEntity[]> {
    return TransactionsRepository.transactions.filter((t) => t.itemId === itemId);
  }
}