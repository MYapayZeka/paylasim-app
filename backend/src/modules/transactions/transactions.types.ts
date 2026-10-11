import { z } from 'zod';

export enum TransactionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
}

// Rezervasyon Talep İsteği Doğrulama Şeması
export const CreateTransactionSchema = z
  .object({
    itemId: z.string().uuid('Geçerli bir ilan kimliği giriniz'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'Bitiş tarihi başlangıç tarihinden sonra olmalıdır',
    path: ['endDate'],
  });

export type CreateTransactionInput = z.infer<typeof CreateTransactionSchema>;

export interface TransactionEntity {
  id: string;
  itemId: string;
  borrowerId: string;
  startDate: Date;
  endDate: Date;
  totalPrice: number;
  status: TransactionStatus;
  createdAt: Date;
}