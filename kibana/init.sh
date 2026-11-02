#!/bin/sh
# Throwaway container run on every "docker compose up":
# imports the dashboard + data view, and applies the Kibana settings.
# Kibana is served under /kibana (SERVER_BASEPATH), hence the prefix in the internal URL.
set -e

KIBANA=http://kibana:5601/kibana
AUTH="elastic:${ELASTIC_PASSWORD}"

# 1. Wait for Kibana to be ready (/api/status returns 503 while it starts up)
until curl -sf -o /dev/null -u "$AUTH" "$KIBANA/api/status"; do
  echo "Waiting for Kibana to be ready..."
  sleep 5
done

# 2. Import the dashboard and data view (overwrite: replace the existing version)
#    The Kibana API requires the kbn-xsrf header (CSRF protection), otherwise 400.
curl -sf -u "$AUTH" -X POST "$KIBANA/api/saved_objects/_import?overwrite=true" \
  -H 'kbn-xsrf: true' \
  --form file=@/kibana-init/export.ndjson

# 3. Disable bfetch: its "streaming" mode passes poorly through ModSecurity (dashboard blocked)
curl -sf -u "$AUTH" -X POST "$KIBANA/api/kibana/settings" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"changes":{"bfetch:disable":true}}'

# 4. docker-logs-* as the default data view (fixed id, from export.ndjson)
curl -sf -u "$AUTH" -X POST "$KIBANA/api/data_views/default" \
  -H 'kbn-xsrf: true' -H 'Content-Type: application/json' \
  -d '{"data_view_id":"59debe14-6ba0-46dd-81a4-2b76f004ee96","force":true}'

echo "Kibana configured: dashboard imported, default data view set, bfetch disabled."