import { z } from 'zod';

export enum ReportReason {
  FRAUD = 'FRAUD',
  DAMAGED_ITEM = 'DAMAGED_ITEM',
  INAPPROPRIATE_CONTENT = 'INAPPROPRIATE_CONTENT',
  NO_SHOW = 'NO_SHOW',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  PENDING = 'PENDING',
  IN_REVIEW = 'IN_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

// Şikayet Bildirimi Doğrulama Şeması
export const CreateReportSchema = z.object({
  reportedUserId: z.string().optional(),
  reportedItemId: z.string().optional(),
  reason: z.nativeEnum(ReportReason),
  description: z.string().min(10, 'Lütfen şikayetinizi en az 10 karakterle açıklayın'),
}).refine((data) => data.reportedUserId || data.reportedItemId, {
  message: 'Şikayet için en az bir kullanıcı veya ilan belirtilmelidir',
  path: ['reportedUserId'],
});

export type CreateReportInput = z.infer<typeof CreateReportSchema>;

// Kullanıcı Engelleme Doğrulama Şeması
export const BlockUserSchema = z.object({
  targetUserId: z.string().min(1, 'Engellenecek kullanıcı kimliği zorunludur'),
});

export type BlockUserInput = z.infer<typeof BlockUserSchema>;

export interface ReportEntity {
  id: string;
  reporterId: string;
  reportedUserId?: string;
  reportedItemId?: string;
  reason: ReportReason;
  description: string;
  status: ReportStatus;
  createdAt: Date;
}

export interface BlockEntity {
  id: string;
  blockerId: string;
  blockedId: string;
  createdAt: Date;
}