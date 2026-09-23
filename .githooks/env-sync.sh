#!/bin/sh
ENV_EXAMPLE=".env.example"
ENV_FILE=".env"

[ -f "$ENV_EXAMPLE" ] || exit 0
[ -f "$ENV_FILE" ] || touch "$ENV_FILE"

missing=""

while IFS='=' read -r key _ || [ -n "$key" ]; do
  case "$key" in
    ''|\#*) continue ;;
  esac
  if ! grep -q "^${key}=" "$ENV_FILE"; then
    value=$(grep "^${key}=" "$ENV_EXAMPLE" | cut -d '=' -f2-)
    echo "${key}=${value}" >> "$ENV_FILE"
    missing="$missing $key"
  fi
done < "$ENV_EXAMPLE"

if [ -n "$missing" ]; then
  echo ""
  echo "warning: .env updated automatically, new variables :$missing"
  echo "         check whether they need a real value instead of the example one."
  echo ""
fi