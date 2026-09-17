#!/bin/sh
set -e

vault kv put secret/db password="$DB_PASSWORD"
# ajouter d autres mdp
