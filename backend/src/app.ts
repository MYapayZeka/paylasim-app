import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './shared/middlewares/errorHandler';
import itemsRouter from './modules/items/items.routes';
import transactionsRouter from './modules/transactions/transactions.routes';
import reportsRouter from './modules/reports/reports.routes';
import authRouter from './modules/auth/auth.routes';

import path from 'path';
import uploadRouter from './modules/upload/upload.routes';

const app: Application = express();

app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : ['*'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Mobil istekler, sunucu taraflı istekler veya araçlar için origin tanımsız olabilir
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes('*') ||
        allowedOrigins.includes(origin) ||
        origin.endsWith('.netlify.app') ||
        origin.includes('localhost')
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

app.use(express.json());

// Statik Dosyalar (Fotoğraflar)
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 3000,
  message: { success: false, message: 'Çok fazla istek gönderildi, lütfen biraz bekleyin.' },
});
app.use('/api', limiter);

import chatRouter from './modules/chat/chat.routes';
import usersRouter from './modules/users/users.routes';

// Modül Rotaları
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', usersRouter);
app.use('/api/v1/items', itemsRouter);
app.use('/api/v1/transactions', transactionsRouter);
app.use('/api/v1/reports', reportsRouter);
app.use('/api/v1/upload', uploadRouter);
app.use('/api/v1/chat', chatRouter);

// Kök ve Sağlık Kontrolü
app.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'PaylaşIM API Render üzerinde aktif!',
    version: '1.0.0',
    health: '/health',
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'PaylaşIM API sorunsuz çalışıyor.',
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

export default app;