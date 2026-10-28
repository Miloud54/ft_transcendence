#!/bin/sh
# Conteneur jetable lance a chaque "docker compose up" :
# importe le dashboard + la data view, et applique les reglages Kibana.
# Kibana est servi sous /kibana (SERVER_BASEPATH), d'ou le prefixe dans l'URL interne.
set -e

KIBANA=http://kibana:5601/kibana
AUTH="elastic:${ELASTIC_PASSWORD}"

# 1. Attendre que Kibana soit pret (/api/status repond 503 tant qu'il demarre)
until curl -sf -o /dev/null -u "$AUTH" "$KIBANA/api/status"; do
  echo "Waiting for Kibana to be ready..."
  sleep 5
done

# 2. Importer le dashboard et la data view (overwrite : remplace la version existante)
#    L'API Kibana exige l'en-tete kbn-xsrf (protection CSRF), sinon 400.
curl -sf -u "$AUTH" -X POST "$KIBANA/api/saved_objects/_import?overwrite=true" \
  -H 'kbn-xsrf: true' \
  --form file=@/kibana-init/export.ndjson

# 3. Desactiver bfetch : son mode "flux" passe mal a travers ModSecurity (dashboard bloque)
curl -sf -u "$AUTH" -X POST "$KIBANA/api/kibana/settings" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"changes":{"bfetch:disable":true}}'

# 4. docker-logs-* comme data view par defaut (id fixe, issu de export.ndjson)
curl -sf -u "$AUTH" -X POST "$KIBANA/api/data_views/default" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view_id":"59debe14-6ba0-46dd-81a4-2b76f004ee96","force":true}'

echo "Kibana configured: dashboard imported, default data view set, bfetch disabled."