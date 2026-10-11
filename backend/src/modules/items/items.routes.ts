import { Router, Request, Response, NextFunction } from 'express';
import { itemService } from './items.service';
import { authGuard, AuthenticatedRequest } from '../../shared/middlewares/authGuard';

const router = Router();

// Yakındaki ilanları ara (Önce /search rotası tanımlanmalı ki /:id ile çakışmasın)
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lat = req.query.lat ? parseFloat(String(req.query.lat)) : undefined;
    const lng = req.query.lng ? parseFloat(String(req.query.lng)) : undefined;
    const radiusMeters = req.query.radiusMeters ? parseInt(String(req.query.radiusMeters), 10) : 50000;
    const category = req.query.category ? String(req.query.category) : undefined;
    const search = req.query.search ? String(req.query.search) : undefined;
    const minPrice = req.query.minPrice ? parseFloat(String(req.query.minPrice)) : undefined;
    const maxPrice = req.query.maxPrice ? parseFloat(String(req.query.maxPrice)) : undefined;
    const availableOnly = req.query.availableOnly === 'true' || req.query.availableOnly === '1';

    const items = await itemService.searchNearby({
      lat,
      lng,
      radiusMeters,
      category,
      search,
      minPrice,
      maxPrice,
      availableOnly,
    });

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// Kullanıcının kendi ilanları
router.get('/my-items', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const items = await itemService.getMyItems(req.user!.id);
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// Tüm ilanları listele
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, search, minPrice, maxPrice, availableOnly } = req.query;
    const items = await itemService.getAllItems({
      category: category ? String(category) : undefined,
      search: search ? String(search) : undefined,
      minPrice: minPrice ? parseFloat(String(minPrice)) : undefined,
      maxPrice: maxPrice ? parseFloat(String(maxPrice)) : undefined,
      availableOnly: availableOnly === 'true' || availableOnly === '1',
    });
    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// Tekil ilan detayı
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const item = await itemService.getItemById(String(itemId));
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// İlan değerlendirmelerini getir
router.get('/:id/reviews', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const itemId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const reviews = await itemService.getItemReviews(String(itemId));
    res.json({ success: true, data: reviews });
  } catch (error) {
    next(error);
  }
});

// Yeni ilan oluştur
router.post('/', authGuard, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const item = await itemService.createItem(userId, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// İlanı güncelle (Yalnızca Sahibi)
router.patch('/:id', authGuard, async (req: AuthenticatedRequest<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params?.id;
    const itemId = Array.isArray(rawId) ? rawId[0] : rawId;
    const updated = await itemService.updateItem(req.user!.id, String(itemId), req.body);
    res.json({ success: true, data: updated, message: 'İlan başarıyla güncellendi.' });
  } catch (error) {
    next(error);
  }
});

// İlanı sil (Yalnızca Sahibi)
router.delete('/:id', authGuard, async (req: AuthenticatedRequest<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const rawId = req.params?.id;
    const itemId = Array.isArray(rawId) ? rawId[0] : rawId;
    await itemService.deleteItem(req.user!.id, String(itemId));
    res.json({ success: true, message: 'İlan başarıyla silindi.' });
  } catch (error) {
    next(error);
  }
});

export default router;