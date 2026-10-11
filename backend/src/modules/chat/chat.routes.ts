import { Router, Response, NextFunction } from 'express';
import { chatService } from './chat.service';
import { authGuard, AuthenticatedRequest } from '../../shared/middlewares/authGuard';

const router = Router();

// Kullanıcının Dahil Olduğu Tüm Sohbetleri Getir
router.get('/conversations', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const conversations = await chatService.getConversations(req.user!.id);
    res.status(200).json({ success: true, data: conversations });
  } catch (error) {
    next(error);
  }
});

// Kullanıcının Toplam Okunmamış Mesaj Sayısını Getir (Navbar Rozeti İçin)
router.get(['/unread-count', '/unread_count'], authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(200).json({ success: true, data: { unreadCount: 0, count: 0 } });
      return;
    }
    const data = await chatService.getUnreadCount(userId);
    res.status(200).json({
      success: true,
      data: {
        unreadCount: data?.unreadCount ?? 0,
        count: data?.unreadCount ?? 0,
      },
    });
  } catch (error) {
    console.warn('[ChatRoutes] unread_count hatası güvenle ele alındı:', (error as any)?.message);
    res.status(200).json({ success: true, data: { unreadCount: 0, count: 0 } });
  }
});

// Konuşmayı Gizle / Arşivle (Kullanıcı Bazlı Soft-Delete)
router.post('/conversations/:transactionId/archive', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = req.params.transactionId as string;
    const result = await chatService.archiveConversation(req.user!.id, transactionId);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Sohbete Ait Mesajları Getir (Açıldığında Karşı Tarafın Mesajlarını Okundu Yapar)
router.get('/:transactionId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = Array.isArray(req.params.transactionId)
      ? req.params.transactionId[0]
      : req.params.transactionId;

    const messages = await chatService.getMessages(req.user!.id, String(transactionId));
    res.status(200).json({ success: true, data: messages });
  } catch (error) {
    next(error);
  }
});

// Mesajları Okundu Olarak İşaretle
router.patch('/:transactionId/read', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = Array.isArray(req.params.transactionId)
      ? req.params.transactionId[0]
      : req.params.transactionId;

    const result = await chatService.markAsRead(req.user!.id, String(transactionId));
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Mesaj Gönder
router.post('/:transactionId', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactionId = Array.isArray(req.params.transactionId)
      ? req.params.transactionId[0]
      : req.params.transactionId;
    const { content } = req.body;

    const message = await chatService.sendMessage(req.user!.id, String(transactionId), content);
    res.status(201).json({ success: true, data: message });
  } catch (error) {
    next(error);
  }
});

export default router;
