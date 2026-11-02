import { loadSecretsFromVault } from '../src/vault';

async function main() {
    const secrets = await loadSecretsFromVault();
  
    console.log(`export DATABASE_URL="postgresql://${process.env.DB_USER}:${secrets.db_password}@db:5432/${process.env.DB_NAME}"`);
    console.log(`export JWT_SECRET="${secrets.jwt_secret}"`);
  }
  
  main();