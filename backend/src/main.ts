import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

function normalizeOrigin(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function collectAllowedOrigins(): Set<string> {
  const set = new Set<string>();
  const push = (v: string | undefined) => {
    const n = normalizeOrigin(v);
    if (n) set.add(n);
  };

  push('http://localhost:3000');
  push('https://sptc.vercel.app');
  push('https://www.sptc.vercel.app');
  push(process.env.FRONTEND_URL);

  const extra = process.env.CORS_ALLOWED_ORIGINS;
  if (extra?.trim()) {
    for (const part of extra.split(',')) {
      push(part);
    }
  }

  return set;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3001;
  const allowedOrigins = collectAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'x-actor-name',
      'x-actor-role',
    ],
  });

  await app.listen(Number(port));
}
bootstrap();
