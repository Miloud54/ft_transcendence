import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadSecretsFromVault } from './vault';


async function bootstrap() {
  const secrets = await loadSecretsFromVault();
  process.env.DATABASE_URL = `postgresql://${process.env.DB_USER}:${secrets.db_password}@db:5432/${process.env.DB_NAME}`;
  process.env.JWT_SECRET = secrets.jwt_secret;

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
