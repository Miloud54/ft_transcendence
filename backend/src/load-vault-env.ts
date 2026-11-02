import { loadSecretsFromVault } from './vault';

async function main() {
  const secrets = await loadSecretsFromVault();
  console.log(
    `export DATABASE_URL="postgresql://${process.env.DB_USER}:${secrets.db_password}@db:5432/${process.env.DB_NAME}"`,
  );
}

// stdout is eval'd by the container command: errors go to stderr and stop the startup.
main().catch((error) => {
  console.error('Could not load DATABASE_URL from Vault:', error);
  process.exit(1);
});
