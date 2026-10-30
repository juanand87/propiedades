import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { SafeExceptionFilter } from './estate/estate.controller';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: true,
  });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new SafeExceptionFilter());
  app.enableCors({
    origin: config
      .get<string>('CORS_ORIGINS', 'http://localhost:3000')
      .split(',')
      .map((v) => v.trim()),
    credentials: true,
  });
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
  app.enableShutdownHooks();
  await app.listen(Number(config.get('PORT', 3001)), '0.0.0.0');
}
bootstrap().catch(() => {
  console.error(
    'No se pudo iniciar Propiedades. Revisa configuración, TLS y conectividad MySQL.',
  );
  process.exitCode = 1;
});
