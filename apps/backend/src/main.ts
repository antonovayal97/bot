import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Загружаем .env: из текущей директории или из корня монорепо (npm run dev -w → cwd = root)
const cwdEnv = resolve(process.cwd(), '.env');
const rootEnv = resolve(process.cwd(), '..', '..', '.env');
if (existsSync(cwdEnv)) config({ path: cwdEnv });
else if (existsSync(rootEnv)) config({ path: rootEnv });

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  const corsOrigins = [
    'http://localhost:3001',
    ...(process.env.ADMIN_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
  ].filter((o, i, a) => a.indexOf(o) === i);
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : ['http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Backend API running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
