import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import vault from 'node-vault';

interface VaultSecretData {
  db_password: string;
  jwt_secret: string;
}

interface VaultKvV2Response {
  data: {
    data: VaultSecretData;
  };
}

async function loadSecretsFromVault() {
  const client = vault({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });

  const response = (await client.read(
    'secret/data/backend',
  )) as VaultKvV2Response;
  const secrets = response.data.data;

  process.env.DATABASE_URL = `postgresql://${process.env.DB_USER}:${secrets.db_password}@db:5432/${process.env.DB_NAME}`;
  process.env.JWT_SECRET = secrets.jwt_secret;
}

async function bootstrap() {
  await loadSecretsFromVault();

  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
