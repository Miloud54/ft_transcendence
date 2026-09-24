#!/bin/sh
set -e

until curl -sf -u "elastic:${ELASTIC_PASSWORD}" http://elasticsearch:9200/_security/_authenticate > /dev/null; do
  echo "En attente qu'Elasticsearch soit prêt..."
  sleep 2
done

curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/user/kibana_system/_password \
  -H 'Content-Type: application/json' \
  -d "{\"password\": \"${KIBANA_PASSWORD}\"}"

curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/role/logstash_writer \
  -H 'Content-Type: application/json' \
  -d '{
    "cluster": ["monitor", "manage_index_templates"],
    "indices": [
      { "names": ["docker-logs-*"], "privileges": ["create_index", "write", "manage"] }
    ]
  }'

curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/user/logstash_writer \
  -H 'Content-Type: application/json' \
  -d "{\"password\": \"${LOGSTASH_PASSWORD}\", \"roles\": [\"logstash_writer\"]}"

echo "Comptes kibana_system et logstash_writer configurés."
