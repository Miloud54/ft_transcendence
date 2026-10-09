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


# Rétention : supprime les index de logs après 30 jours
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_ilm/policy/docker-logs-retention \
  -H 'Content-Type: application/json' \
  -d '{"policy":{"phases":{"delete":{"min_age":"30d","actions":{"delete":{}}}}}}'

# Applique automatiquement cette politique à chaque nouvel index docker-logs-*
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_index_template/docker-logs \
  -H 'Content-Type: application/json' \
  -d '{"index_patterns":["docker-logs-*"],"template":{"settings":{"index.lifecycle.name":"docker-logs-retention"}}}'

# Archivage : déclare le dossier où Elasticsearch range les snapshots 
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_snapshot/logs-archive \
  -H 'Content-Type: application/json' \
  -d '{"type":"fs","settings":{"location":"/usr/share/elasticsearch/snapshots"}}'

# Archivage : snapshot des logs chaque nuit à 1h30, conservé 1 an
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_slm/policy/daily-logs-archive \
  -H 'Content-Type: application/json' \
  -d '{"schedule":"0 30 1 * * ?","name":"<logs-{now/d}>","repository":"logs-archive","config":{"indices":["docker-logs-*"],"include_global_state":false},"retention":{"expire_after":"365d","min_count":1}}'

echo "Comptes kibana_system et logstash_writer configurés."