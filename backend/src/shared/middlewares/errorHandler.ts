import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../../core/errors/AppError';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  if (err instanceof ZodError) {
    const errorMessages = err.issues.map((i) => i.message).join('. ');
    res.status(400).json({
      success: false,
      message: errorMessages || 'Geçersiz veri gönderildi.',
      errors: err.issues,
    });
    return;
  }

  console.error('Beklenmeyen Hata:', err);
  res.status(500).json({
    success: false,
    message: 'Sunucu tarafında beklenmeyen bir hata oluştu.',
  });
};