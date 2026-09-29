import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { loadSecretsFromVault } from './vault';


async function bootstrap() {
  const secrets = await loadSecretsFromVault();
  process.env.DATABASE_URL = `postgresql://${process.env.DB_USER}:${secrets.db_password}@db:5432/${process.env.DB_NAME}`;
  process.env.JWT_SECRET = secrets.jwt_secret;
  process.env.GOOGLE_CLIENT_ID = secrets.google_client_id;
  process.env.GOOGLE_CLIENT_SECRET = secrets.google_client_secret;
  process.env.DISCORD_CLIENT_ID = secrets.discord_client_id;
  process.env.DISCORD_CLIENT_SECRET = secrets.discord_client_secret;

  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
