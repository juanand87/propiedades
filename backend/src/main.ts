import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  const configService = app.get(ConfigService);
  
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS', 'http://localhost:3000').split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Pos-Token', 'X-Pos-Shift-Id'],
  });

  // Log all HTTP requests
  app.use((req, res, next) => {
    console.log(`🌐 [HTTP] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    
    // Log request body for POST/PATCH/PUT requests
    if (['POST', 'PATCH', 'PUT'].includes(req.method) && req.url.includes('/orders')) {
      console.log(`📝 [HTTP BODY] ${req.url}:`, JSON.stringify(req.body, null, 2));
    }
    
    if (!req.url.startsWith('/uploads/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    next();
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );
  
  // Servir archivos estáticos desde la carpeta uploads
  app.useStaticAssets(join(process.cwd(), configService.get('UPLOAD_DIR', './uploads-propiedades')), {
    prefix: '/uploads/',
  });
  
  const port = configService.get('PORT') || 3001;
  await app.listen(port, '0.0.0.0');
  
  console.log(`🚀 Backend running on http://localhost:${port}/api`);
  console.log(`🌐 Backend accessible on network at http://0.0.0.0:${port}/api`);
  console.log(`📁 Static files served from /uploads`);
}
bootstrap();
