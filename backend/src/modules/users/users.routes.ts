import { Router, Request, Response, NextFunction } from 'express';
import { AuthService } from '../auth/auth.service';

const router = Router();
const authService = new AuthService();

// Satıcı Genel Profili (Gizlilik Korumalı)
router.get('/:id/public-profile', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await authService.getPublicProfile(String(targetUserId));
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// Satıcı Değerlendirmeleri
router.get('/:id/reviews', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reviews = await authService.getUserReviews(String(targetUserId));
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

export default router;
