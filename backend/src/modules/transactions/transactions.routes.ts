import { Router, Response, NextFunction } from 'express';
import { transactionsService } from './transactions.service';
import { CreateTransactionSchema } from './transactions.types';
import { authGuard, AuthenticatedRequest } from '../../shared/middlewares/authGuard';

const router = Router();

// Kiralama Talebi Oluştur (Giriş Yapmış Kullanıcı)
router.post('/', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = CreateTransactionSchema.parse(req.body);
    const transaction = await transactionsService.requestBooking(req.user!.id, validatedData);
    res.status(201).json({ success: true, data: transaction });
  } catch (error) {
    next(error);
  }
});

// İlan Sahibine Gelen Kiralama Talepleri
router.get('/incoming', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactions = await transactionsService.getIncomingRequests(req.user!.id);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

// Kullanıcının Gönderdiği Kiralama Talepleri (Giden)
router.get('/outgoing', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const transactions = await transactionsService.getOutgoingRequests(req.user!.id);
    res.status(200).json({ success: true, data: transactions });
  } catch (error) {
    next(error);
  }
});

// Talebi Onayla (Yalnızca İlan Sahibi)
router.patch('/:id/approve', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await transactionsService.approveBooking(req.user!.id, id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Talebi Reddet (Yalnızca İlan Sahibi)
router.patch('/:id/reject', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await transactionsService.rejectBooking(req.user!.id, id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Talebi İptal Et (Kiracı)
router.patch('/:id/cancel', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const updated = await transactionsService.cancelBooking(req.user!.id, id);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// QR Teslimat & IBAN Bilgilerini Getir
router.get('/:id/handover-data', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const data = await transactionsService.getHandoverData(req.user!.id, id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

// Teslimat & Ödemeyi Onayla (Çift Taraflı El Sıkışma)
router.post('/:id/confirm-handover', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { paymentMethod } = req.body;
    const result = await transactionsService.confirmHandover(req.user!.id, id, paymentMethod);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Güvenli Teslimat Tokalaşması (PIN Doğrulama)
router.post('/:id/confirm-handshake', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { pin, paymentMethod, protocolAccepted } = req.body;
    const result = await transactionsService.confirmHandshake(req.user!.id, id, pin, paymentMethod, protocolAccepted);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Kiracı Erken İade Başlatma
router.post('/:id/early-return', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await transactionsService.requestEarlyReturn(req.user!.id, id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Satıcı Erken İadeyi PIN ile Onayla
router.post('/:id/confirm-early-return', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { returnPin } = req.body;
    const result = await transactionsService.confirmEarlyReturn(req.user!.id, id, returnPin);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Kiralama Süreci Tamamlama / İadeyi Onayla
router.post('/:id/confirm-return', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await transactionsService.confirmReturn(req.user!.id, id);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// İki Yönlü Değerlendirme ve Puan Verme (Eşya ve Kullanıcı)
router.post('/:id/review', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const id = req.params.id as string;
    const result = await transactionsService.addReview(req.user!.id, id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;