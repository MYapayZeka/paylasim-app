import { Router, Response, NextFunction } from 'express';
import { reportsService } from './reports.service';
import { authGuard, AuthenticatedRequest } from '../../shared/middlewares/authGuard';

const router = Router();

// Şikayet Gönder (Giriş Yapmış Kullanıcı)
router.post('/', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const report = await reportsService.submitReport(req.user!.id, req.body);
    res.status(201).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
});

// Kullanıcı Engelle
router.post('/block', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = req.body.targetUserId;
    if (!targetUserId) {
      res.status(400).json({ success: false, message: 'Engellenecek kullanıcı kimliği zorunludur.' });
      return;
    }

    const block = await reportsService.blockUser(req.user!.id, targetUserId);
    res.status(200).json({ success: true, message: 'Kullanıcı engellendi.', data: block });
  } catch (error) {
    next(error);
  }
});

export default router;