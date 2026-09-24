#!/bin/sh
set -e

vault kv put secret/backend \
  db_password="$DB_PASSWORD" \
  jwt_secret="$JWT_SECRET" \
  google_client_id="$GOOGLE_CLIENT_ID" \
  google_client_secret="$GOOGLE_CLIENT_SECRET" \
  discord_client_id="$DISCORD_CLIENT_ID" \
  discord_client_secret="$DISCORD_CLIENT_SECRET"