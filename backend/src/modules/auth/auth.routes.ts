import { Router, Request, Response, NextFunction } from 'express';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { RegisterUserSchema, LoginUserSchema } from './auth.types';
import { authGuard, AuthenticatedRequest } from '../../shared/middlewares/authGuard';

const router = Router();
const authService = new AuthService();

// Kayıt Ol
router.post('/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = RegisterUserSchema.parse(req.body);
    const result = await authService.register(validatedData);
    res.status(201).json({
      success: true,
      token: result.token,
      user: result.user,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Giriş Yap
router.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validatedData = LoginUserSchema.parse(req.body);
    const result = await authService.login(validatedData);
    res.status(200).json({
      success: true,
      token: result.token,
      user: result.user,
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

// Profil Bilgisi (Giriş Gerektirir)
router.get('/me', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const profile = await authService.getProfile(req.user!.id);
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// Profil Güncelle (IBAN, Telefon vb.)
router.patch('/profile', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const updated = await authService.updateProfile(req.user!.id, req.body);
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// Satıcı Genel Profili (Gizlilik Korumalı)
router.get('/users/:id/public-profile', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const profile = await authService.getPublicProfile(String(targetUserId));
    res.status(200).json({ success: true, data: profile });
  } catch (error) {
    next(error);
  }
});

// Satıcı Değerlendirmeleri
router.get('/users/:id/reviews', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const targetUserId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reviews = await authService.getUserReviews(String(targetUserId));
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

// Hesabımı Sil (Market İncelemeleri İçin Zorunlu)
const handleDeleteAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await authService.deleteAccount(req.user!.id);
    res.status(200).json({ success: true, message: 'Hesabınız başarıyla silindi.' });
  } catch (error) {
    next(error);
  }
};

router.delete('/me', authGuard, handleDeleteAccount);
router.delete('/delete-account', authGuard, handleDeleteAccount);

export default router;