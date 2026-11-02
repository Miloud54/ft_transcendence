#!/bin/sh
set -e

# Wait until Elasticsearch answers an authenticated request before continuing
# (ES takes a while to start; retry every 2 s)
until curl -sf -u "elastic:${ELASTIC_PASSWORD}" http://elasticsearch:9200/_security/_authenticate > /dev/null; do
  echo "Waiting for Elasticsearch to be ready..."
  sleep 2
done

# Set the password of the built-in kibana_system account (Kibana uses it to connect to ES)
curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/user/kibana_system/_password \
  -H 'Content-Type: application/json' \
  -d "{\"password\": \"${KIBANA_PASSWORD}\"}"

# Create the logstash_writer role: minimal rights, write-only on docker-logs-* indices
# (no read, no administration elsewhere: least-privilege principle)
curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/role/logstash_writer \
  -H 'Content-Type: application/json' \
  -d '{
    "cluster": ["monitor", "manage_index_templates"],
    "indices": [
      { "names": ["docker-logs-*"], "privileges": ["create_index", "write"] }
    ]
  }'

# Create the logstash_writer user with that role (Logstash uses it to write the logs)
curl -sf -u "elastic:${ELASTIC_PASSWORD}" \
  -X POST http://elasticsearch:9200/_security/user/logstash_writer \
  -H 'Content-Type: application/json' \
  -d "{\"password\": \"${LOGSTASH_PASSWORD}\", \"roles\": [\"logstash_writer\"]}"


# Retention: delete log indices after 30 days
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_ilm/policy/docker-logs-retention \
  -H 'Content-Type: application/json' \
  -d '{"policy":{"phases":{"delete":{"min_age":"30d","actions":{"delete":{}}}}}}'

# Automatically apply this policy to every new docker-logs-* index
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_index_template/docker-logs \
  -H 'Content-Type: application/json' \
  -d '{"index_patterns":["docker-logs-*"],"template":{"settings":{"index.number_of_replicas":0,"index.lifecycle.name":"docker-logs-retention"}}}'

# Archiving: declare the folder where Elasticsearch stores the snapshots
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_snapshot/logs-archive \
  -H 'Content-Type: application/json' \
  -d '{"type":"fs","settings":{"location":"/usr/share/elasticsearch/snapshots"}}'

# Archiving: snapshot the logs every night at 1:30 am, kept for 1 year
curl -sf -u "elastic:${ELASTIC_PASSWORD}" -X PUT http://elasticsearch:9200/_slm/policy/daily-logs-archive \
  -H 'Content-Type: application/json' \
  -d '{"schedule":"0 30 1 * * ?","name":"<logs-{now/d}>","repository":"logs-archive","config":{"indices":["docker-logs-*"],"include_global_state":false},"retention":{"expire_after":"365d","min_count":1}}'

echo "kibana_system and logstash_writer accounts configured."