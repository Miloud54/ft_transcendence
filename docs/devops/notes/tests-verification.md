# Tests de vérification : site et modules

Checklist à dérouler après un `up`, avant une démo ou l'évaluation. Chaque test indique le résultat attendu.

Les commandes utilisent `https://localhost:8443` (certificat auto-signé, d'où `curl -k`). En production, remplacer `docker compose` par `docker compose -f docker-compose.prod.yml`.

---

## 0. État général des conteneurs

```
docker compose ps
```
- **Attendu** : tous les services sont `running` ou `healthy`. Les services jetables (`vault-init`, `es-init`, `kibana-init`, `grafana-init`, `alertmanager-init`, `volumes-init`) sont `exited (0)`.
- **Problème** : un service `exited` avec un code différent de 0, ou `unhealthy`. Regarder ses logs : `docker compose logs --tail=50 <service>`.

---

## 1. Site général

| # | Test | Commande ou action | Attendu |
| --- | --- | --- | --- |
| 1.1 | Page d'accueil | `curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/` | `200` |
| 1.2 | Redirection HTTP → HTTPS | `curl -s -o /dev/null -w "%{http_code} %{redirect_url}" http://localhost:8080/` | `301` ou `302` vers `https://localhost:8443/` |
| 1.3 | Connexion | ouvrir `https://localhost:8443`, se connecter avec un compte de démo | accès au dashboard, aucun message d'erreur |
| 1.4 | Dashboard connecté | ouvrir le dashboard après connexion | statistiques et historique affichés |
| 1.5 | Dashboard non connecté | ouvrir le dashboard en navigation privée | voir la note sur les `401` en console (doc frontend) |
| 1.6 | Chat et présence | ouvrir deux navigateurs, se connecter avec deux comptes | la présence et les messages passent en temps réel (`/socket.io/`) |
| 1.7 | Jeu | lancer une partie avec deux comptes | les déplacements sont synchronisés |
| 1.8 | Avatar | changer d'avatar | l'image s'affiche après rechargement |
| 1.9 | Connexion Google / Discord | cliquer sur le bouton de connexion | redirection vers le fournisseur, puis retour sur le site |

**Console du navigateur (F12)** : les seules erreurs acceptables sont les `401` attendus avant connexion. Toute erreur `500`, `502` ou `CORS` doit être notée.

---

## 2. WAF (Nginx + ModSecurity)

| # | Test | Commande | Attendu |
| --- | --- | --- | --- |
| 2.1 | Seul port public | `nc -zv localhost 3001; nc -zv localhost 8200; nc -zv localhost 9093` | `Connection refused` (ports fermés) |
| 2.2 | Routage `/api/` | `curl -k -s -o /dev/null -w "%{http_code}" https://localhost:8443/api/users/me` | `401` (sans token) |
| 2.3 | Blocage d'une attaque | `curl -k -s -o /dev/null -w "%{http_code}" "https://localhost:8443/?q=<script>alert(1)</script>"` | `403` |
| 2.4 | Méthodes autorisées | `curl -k -s -o /dev/null -w "%{http_code}" -X DELETE https://localhost:8443/api/users/me` | `401` (la requête atteint le backend, pas de `403`) |
| 2.5 | Log du WAF | `docker compose logs --tail=20 waf` | une ligne par requête, `is_interrupted:true` pour le test 2.3 |
| 2.6 | Config valide | `docker compose run --rm --no-deps waf nginx -t` | `syntax is ok` et `test is successful` |

---

## 3. Vault

| # | Test | Commande | Attendu |
| --- | --- | --- | --- |
| 3.1 | Vault démarré | `docker compose exec vault vault status` | `Sealed false` (mode dev, toujours déverrouillé) |
| 3.2 | Secrets rangés | `docker compose exec vault vault kv list secret` | `backend` est listé |
| 3.3 | Pas de port publié | `nc -zv localhost 8200` | `Connection refused` |
| 3.4 | Redémarrage | `docker compose up -d` puis refaire 3.2 | les secrets sont toujours présents (rangés par `vault-init`) |

Ne pas afficher la valeur des secrets (`vault kv get`) dans un terminal partagé ou une capture d'écran.

---

## 4. ELK (Elasticsearch, Logstash, Kibana)

| # | Test | Commande ou action | Attendu |
| --- | --- | --- | --- |
| 4.1 | Elasticsearch sans mot de passe | `docker compose exec elasticsearch curl -s -o /dev/null -w "%{http_code}" http://localhost:9200` | `401` |
| 4.2 | Elasticsearch avec `elastic` | `docker compose exec elasticsearch sh -c 'curl -s -o /dev/null -w "%{http_code}" -u "elastic:$ELASTIC_PASSWORD" http://localhost:9200/_security/_authenticate'` | `200` |
| 4.3 | Santé du cluster | `docker compose exec elasticsearch sh -c 'curl -s -u "elastic:$ELASTIC_PASSWORD" http://localhost:9200/_cluster/health?pretty'` | `"status" : "green"` ou `"yellow"` (pas `red`) |
| 4.4 | Comptes créés | `es-init` affiche `Comptes kibana_system et logstash_writer configurés.` | présent dans `docker compose logs es-init` |
| 4.5 | Kibana accessible via le WAF | ouvrir `https://localhost:8443/kibana/` | page de connexion Kibana |
| 4.6 | Kibana n'est pas publié | `nc -zv localhost 5601` | `Connection refused` |
| 4.7 | Logs arrivent | dans Kibana, Discover, Data View `docker-logs-*` | des événements récents de `frontend`, `backend`, `db`, `waf` |
| 4.8 | Logstash actif | `docker compose logs --tail=20 logstash` | `Pipelines running` et pas d'erreur `401` ou `403` |

Si 4.2 ou 4.3 échoue (`401`, `red`, `unavailable`), voir la section « Dépannage » de [logstash-migration.md](/Users/mariagirardot/Desktop/42_PROJECTS/ft_transcendence/docs/devops/notes/logstash-migration.md) et l'incohérence sur les droits de `logstash_writer` signalée dans [prepa-eval.md](/Users/mariagirardot/Desktop/42_PROJECTS/ft_transcendence/docs/devops/notes/prepa-eval.md).

---

## 5. Monitoring (Prometheus, Grafana, Alertmanager)

| # | Test | Commande ou action | Attendu |
| --- | --- | --- | --- |
| 5.1 | Cibles Prometheus | ouvrir `http://127.0.0.1:9090/targets` | toutes les cibles en `UP` |
| 5.2 | Règles chargées | ouvrir `http://127.0.0.1:9090/alerts` | `TargetDown`, `HighErrorRate`, `HighLatency` en `inactive` |
| 5.3 | Grafana | ouvrir `https://localhost:8443/grafana/` | page de connexion Grafana, puis dashboard avec des données |
| 5.4 | Alerte `TargetDown` | `docker compose stop <service>`, attendre 1 min | alerte `firing` dans `/alerts`, message sur Discord ; `docker compose start <service>` pour revenir |

---

## 6. Données et persistance

| # | Test | Commande ou action | Attendu |
| --- | --- | --- | --- |
| 6.1 | Données après redémarrage | créer un compte, `docker compose restart backend`, se reconnecter | le compte existe toujours |
| 6.2 | Volumes présents | `docker volume ls` | `db_data`, `es_data`, `uploads`, `grafana_data` présents |
| 6.3 | Pas de volumes supprimés par erreur | ne pas utiliser `down -v` avant la démo | les volumes restent |

---

## 7. Avant de rendre le projet

- [ ] Tous les tests de la section 0 passent.
- [ ] Les tests 1.3, 2.3, 4.5 et 4.7 ont été faits à la main, pas seulement en commande.
- [ ] Aucun secret n'apparaît dans les captures d'écran ni dans la doc.
- [ ] Les erreurs connues (401 avant connexion) sont notées et expliquées.
