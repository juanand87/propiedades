import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EstateModule } from './estate/estate.module';
import { Property } from './estate/property.entity';
import {
  validateProjectEnvironment,
  installNetworkIsolation,
} from './config/project-isolation';
import { getDatabaseSsl } from './config/database-ssl';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate(env) {
        validateProjectEnvironment(env);
        installNetworkIsolation(env);
        return env;
      },
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'mysql',
        host: c.get('DB_HOST'),
        port: Number(c.get('DB_PORT', 3306)),
        username: c.get('DB_USERNAME'),
        password: c.get('DB_PASSWORD'),
        database: 'propiedades',
        ssl: getDatabaseSsl({
          DB_SSL: c.get('DB_SSL'),
          DB_SSL_CA: c.get('DB_SSL_CA'),
        }),
        entities: [Property],
        synchronize: false,
        migrationsRun: false,
        charset: 'utf8mb4',
        extra: { connectionLimit: 8 },
        retryAttempts: 3,
      }),
    }),
    EstateModule,
  ],
})
export class AppModule {}
