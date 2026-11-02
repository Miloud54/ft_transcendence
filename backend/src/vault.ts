import vault from 'node-vault';

interface VaultSecretData {
  db_password: string;
  jwt_secret: string;
  google_client_id: string;
  google_client_secret: string;
  discord_client_id: string;
  discord_client_secret: string;
  demo_password?: string;
}

interface VaultKvV2Response {
  data: {
    data: VaultSecretData;
  };
}

export async function loadSecretsFromVault(
  maxAttempts = 5,
  delayMs = 2000,
): Promise<VaultSecretData> {
  const client = vault({
    endpoint: process.env.VAULT_ADDR,
    token: process.env.VAULT_TOKEN,
  });
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let response: VaultKvV2Response;
    try {
      response = (await client.read(
        'secret/data/backend',
      )) as VaultKvV2Response;
    } catch (error) {
      // The raw axios error contains the request headers, including the Vault token:
      // only keep its message so the token never reaches the logs.
      throw new Error(
        `Vault request failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
    }
    const secrets = response.data.data;

    if (secrets?.db_password && secrets?.jwt_secret) {
      return secrets;
    }

    console.warn(
      `Vault secrets not ready yet, retry ${attempt}/${maxAttempts}...`,
    );
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(
    'Could not retrieve secrets from Vault after several attempts',
  );
}
