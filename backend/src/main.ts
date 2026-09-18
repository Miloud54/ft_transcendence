import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import vault from 'node-vault';

async function loadSecretsFromVault() {
  const client = vault({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });

  const { data } = await client.read('secret/data/backend');

  process.env.DATABASE_URL = `postgresql://${process.env.DB_USER}:${data.data.db_password}@db:5432/${process.env.DB_NAME}`;
  process.env.JWT_SECRET = data.data.jwt_secret;
}


async function bootstrap() {
  await loadSecretsFromVault();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
