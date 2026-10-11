import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AppError } from '../../core/errors/AppError';
import { authGuard } from '../../shared/middlewares/authGuard';

const router = Router();

// uploads dizinini garantiye al
const uploadDir = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    cb(null, `item-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new AppError('Yalnızca fotoğraf dosyaları (JPG, PNG, WEBP vb.) yüklenebilir.', 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB sınır
});

// Tekil Fotoğraf Yükle
router.post(
  '/',
  authGuard,
  upload.single('image'),
  (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.file) {
        throw new AppError('Lütfen yüklenecek bir fotoğraf seçin.', 400);
      }

      const relativeUrl = `/uploads/${req.file.filename}`;
      res.status(201).json({
        success: true,
        url: relativeUrl,
        filename: req.file.filename,
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
