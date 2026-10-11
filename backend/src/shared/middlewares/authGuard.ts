import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../../core/errors/AppError';

export type AuthenticatedRequest<
  P = any,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> = Request<P, ResBody, ReqBody, ReqQuery> & {
  user?: { id: string };
};

export const authGuard = (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Oturum açmanız gerekiyor (Token eksik).', 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const secret = process.env.JWT_SECRET || 'gizli_anahtar';
    const payload = jwt.verify(token, secret) as { sub?: string; id?: string };
    const userId = payload.sub || payload.id;
    if (!userId) {
      throw new AppError('Geçersiz oturum anahtarı içeriği.', 401);
    }
    req.user = { id: userId };
    next();
  } catch (_error) {
    throw new AppError('Geçersiz veya süresi dolmuş oturum anahtarı.', 401);
  }
};