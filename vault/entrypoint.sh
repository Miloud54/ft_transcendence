#!/bin/sh
set -e

vault kv put secret/backend \
  db_password="$DB_PASSWORD" \
  jwt_secret="$JWT_SECRET"