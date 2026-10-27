*This project has been created as part of the 42 curriculum by bde-la-p, edidier, mamakaro, ofayad, zoeschne.*

# Transcendix

## Description

**Transcendix** is a real-time multiplayer word game played in the browser, built for the ft_transcendence project.

It is inspired by [Pedantix](https://cemantix.certitudes.org/pedantix): every game hides a random English Wikipedia article. All the words of the article are masked, and players type guesses to reveal them. When a guessed word appears in the article, it is revealed for that player; when it does not, the game shows how semantically close the guess is to the hidden words. The first players to find the article title win the most points.

Players create or join rooms, play together live against each other, chat, add friends, and follow their progress through statistics, achievements and a global leaderboard.

### Key features

- **Multiplayer rooms**: create a lobby, share its unique code, invite friends, or join an open game. A room hosts several games in a row ("play again").
- **Real-time gameplay** over WebSockets: live guesses, countdown, timer, live in-game leaderboard and end-of-game results.
- **Semantic proximity**: wrong guesses are scored against the hidden words using GloVe word vectors.
- **Accounts**: email/password registration, Google and Discord OAuth 2.0, avatar upload, online / in-game status.
- **Social**: friends list, friend requests and room invitations with real-time notifications, room chat shared between lobby and game.
- **Stats**: personal dashboard (games played, win rate, average score, best rank), match history, achievements, XP / levels, global leaderboard.
- **Security**: HTTPS-only access through a Web Application Firewall (Nginx + ModSecurity + OWASP CRS), secrets stored in HashiCorp Vault.
- **Observability**: centralized logs (ELK), metrics and alerting (Prometheus, Grafana, Alertmanager to Discord), health checks, status page, automated database backups.

## Instructions

### Prerequisites

- **Git** (any recent version)
- **Docker 24+ with Docker Compose 2.20+**, or **Podman 5+** with `podman compose`
- A modern browser (Chrome, Firefox)

Nothing else needs to be installed on the host: Node.js, npm, Prisma, NestJS CLI and every other tool run inside containers, with pinned versions.

**Podman users:** `podman compose` talks to the Podman API socket, which must be running:

```bash
systemctl --user enable --now podman.socket
```

### 1. Clone the repository

```bash
git clone git@github.com:Miloud54/ft_transcendence.git
cd ft_transcendence
```

### 2. Configure the environment

Copy the example file and replace every placeholder value:

```bash
cp .env.example .env
```

```
DB_USER, DB_PASSWORD, DB_NAME          PostgreSQL credentials
UID, GID                               your user and group ids (id -u, id -g), for file permissions in dev containers
VAULT_DEV_ROOT_TOKEN_ID                Vault root token
JWT_SECRET                             secret used to sign authentication tokens
ELASTIC_PASSWORD, KIBANA_PASSWORD,
LOGSTASH_PASSWORD                      ELK stack credentials
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET Google OAuth application
DISCORD_CLIENT_ID,
DISCORD_CLIENT_SECRET                  Discord OAuth application
DISCORD_WEBHOOK_URL                    Discord channel receiving Alertmanager alerts
GRAFANA_ADMIN_PASSWORD                 Grafana "admin" password
PEDANTIX_CHEAT                         true = writes the hidden article to backend/cheat/ (development only)
DEMO_PASSWORD                          password of the production demo accounts (empty = no demo accounts)
```

The `.env` file is ignored by Git. At startup, `vault-init` copies the secrets into Vault, and the backend reads them from there.

### 3. Run the project

**Development** (hot reload, source code mounted into the containers):

```bash
docker compose up -d --build
```

On the first start, the database is filled with test data (users `alice`, `bob`, `charlie`... with the password `password123`). The seed only runs when the database is empty.

**Production** (compiled images, only the WAF ports are exposed):

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Demo accounts `demo_alice@demo.local`, `demo_bob@demo.local`, `demo_charlie@demo.local` and `demo_diana@demo.local` are created with `DEMO_PASSWORD`, together with a history of finished games so the dashboard and leaderboard have data to show.

The development and production stacks use the same ports: stop one (`docker compose down` or `docker compose -f docker-compose.prod.yml down`) before starting the other.

### 4. Open the application

```
https://localhost:8443            Transcendix (http://localhost:8080 redirects here)
https://localhost:8443/grafana/   Grafana  (login: admin   / GRAFANA_ADMIN_PASSWORD)
https://localhost:8443/kibana/    Kibana   (login: elastic / ELASTIC_PASSWORD)
```

The TLS certificate is self-signed: accept the browser warning on the first visit.

### Useful commands

```bash
docker compose ps                                   # container status
docker compose logs -f backend                      # follow backend logs
docker compose exec backend npx prisma db seed      # re-run the development seed
docker compose exec -e SEED_FORCE=true backend npx prisma db seed   # reset the dev database to seed data
docker compose down                                 # stop (data kept)
docker compose down -v                              # stop and delete all volumes (data lost)
```

Database backup and restore procedures are described in [docs/disaster-recovery.md](docs/disaster-recovery.md).

## Team Information

- **bde-la-p** (Brunhilde): *Product Owner, Developer*.
  Defines the product vision and the expected behaviour of features, validates them. Built the social features (friends, invitations), the game page frontend and the frontend production image.
- **edidier** (Emilie): *Project Manager, Developer*.
  Planning and task follow-up, team coordination. Built the frontend foundations, authentication and user management, monitoring and reliability (Prometheus, Grafana, alerting, health checks, backups) and the CI/CD pipeline.
- **mamakaro** (Maria): *Tech Lead, Developer*.
  Technical decisions and architecture of the infrastructure. Built the security layer (WAF, Vault), the ELK stack, Docker networks and the production deployment.
- **ofayad** (Odile): *Developer*.
  Designed the Room / Game architecture and built the Pedantix game engine (article selection, game lifecycle). Set up Prisma.
- **zoeschne** (Zoé): *Developer*.
  Built the rooms and real-time layer (WebSocket gateways, live join, chat), guess validation and semantic proximity, and the database seed.

## Project Management

- **Work organization**: features were split by domain (frontend and user management, game engine, rooms and real-time, social features, security and DevOps), each owned by one or two members. The team held a weekly meeting to review what had been done, what was left to do and what was blocked, then reassigned tasks for the following week.
- **Git workflow**: one branch per feature or fix, merged into `main` through GitHub pull requests. Every pull request is reviewed and approved by another team member than its author before being merged, so that each change gets a real code review. A GitHub Actions CI pipeline (lint, build, tests) runs on every pull request.
- **Tools**: GitHub (branches, pull requests, CI) and Notion (task tracking and shared notes). Technical notes are kept in [docs/](docs/).
- **Communication**: Discord and WhatsApp for day-to-day discussions, plus in-person meetings at 42.

## Technical Stack

### Frontend
- **Next.js 16** (App Router) with **React 19** and **TypeScript**
- **Tailwind CSS 4** for styling, **Framer Motion** for animations
- **Socket.IO client** for real-time features

### Backend
- **NestJS 11** (TypeScript), REST API under `/api`
- **Socket.IO** gateways (`@nestjs/websockets`) for rooms, games and chat
- **Passport** (local, JWT, Google, Discord strategies), **bcrypt** for password hashing
- **class-validator** for input validation, **@nestjs/terminus** for health checks, **prom-client** for metrics
- **GloVe** word vectors (pre-processed by `backend/scripts/prepare-vectors.py`) for semantic proximity

### Database
- **PostgreSQL 18**, accessed through the **Prisma** ORM.
- Why: the data is strongly relational (users, friendships, rooms, games, players per game) and statistics rely on joins and aggregations, which a relational database handles well. Prisma provides a typed client generated from a single schema and versioned migrations shared by the whole team.

### Infrastructure
- **Docker / Podman Compose**: separate development and production stacks, isolated networks (public, private, egress)
- **Nginx + ModSecurity + OWASP Core Rule Set**: reverse proxy, HTTPS and Web Application Firewall
- **HashiCorp Vault**: secrets management
- **Elasticsearch, Logstash, Kibana**: log collection and dashboards
- **Prometheus, Grafana, Alertmanager**: metrics, dashboards and Discord alerts
- **GitHub Actions**: continuous integration

### Justification of major choices
- **Next.js + NestJS**: both are TypeScript frameworks, so the whole team works in a single language. NestJS's module structure (controllers, services, gateways) gave clear boundaries to split the backend between members.
- **Socket.IO**: rooms map directly to game lobbies, and it handles automatic reconnection.
- **Everything in containers**: no one installs Node.js or databases locally, and every member runs exactly the same versions. Compatibility with Podman was required because 42 machines run Podman.
- **WAF in front of everything**: the WAF is the only entry point. In production no other port is exposed, so every request is filtered and encrypted.

## Database Schema

Seven tables in PostgreSQL. Arrows go from a foreign key to the table it references.

```
                            ┌───────────────┐
                            │  Friendships  │
                            └───┬───────┬───┘
                        user_id │       │ friend_id
                                ▼       ▼
  ┌──────────────┐ user_id  ┌───────────────┐  user_id ┌──────────────┐
  │ Game_players │─────────►│     Users     │◄─────────│ Room_players │
  └──────┬───────┘          └───────────────┘          └──────┬───────┘
         │                     ▲         ▲                    │
         │ game_id  invitee_id │         │ creator_id         │ room_id
         ▼                     │         │                    ▼
  ┌──────────────┐  ┌──────────┴──────┐  │             ┌──────────────┐
  │    Games     │  │ RoomInvitations │  └─────────────│    Rooms     │
  └──────┬───────┘  └────────┬────────┘                └──────────────┘
         │                   │ room_id                     ▲     ▲
         │                   └─────────────────────────────┘     │
         │ room_id                                               │
         └───────────────────────────────────────────────────────┘
```

Key fields of each table (PK = primary key, FK = foreign key):

```
Users              user_id          BigInt     PK
                   username         String     unique
                   email            String     unique
                   password         String     bcrypt hash, null for OAuth-only users
                   googleId         String     unique, null if not linked
                   discordId        String     unique, null if not linked
                   avatar           String     URL of the avatar
                   xp, lvl          BigInt     experience and level
                   status           enum       ONLINE | OFFLINE | IN_GAME
                   last_seen_at     DateTime

Rooms              room_id          BigInt     PK
                   code             String     unique code used to join the room
                   status           enum       OPEN | STARTING | IN_GAME | CLOSED
                   min_players      Int
                   max_players      Int
                   created_at       DateTime
                   closed_at        DateTime
                   creator_id       BigInt     FK -> Users

Games              game_id          BigInt     PK
                   status           enum       COUNTDOWN | RUNNING | FINISHED
                   started_at       DateTime
                   ended_at         DateTime
                   article_title    String     the Wikipedia article to find
                   room_id          BigInt     FK -> Rooms

Room_players       room_player_id   BigInt     PK
                   room_id          BigInt     FK -> Rooms
                   user_id          BigInt     FK -> Users
                   (room_id, user_id) is unique

Game_players       game_player_id   BigInt     PK
                   game_id          BigInt     FK -> Games
                   user_id          BigInt     FK -> Users
                   result           enum       WIN | LOSS
                   score            Int
                   rank             Int        final rank in the game
                   discovery_rank   Int        order in which the player found the title
                   (game_id, user_id) is unique

Friendships        friendship_id    BigInt     PK
                   user_id          BigInt     FK -> Users (who sent the request)
                   friend_id        BigInt     FK -> Users (who received it)
                   status           enum       PENDING | ACCEPTED
                   (user_id, friend_id) is unique

RoomInvitations    invitation_id    BigInt     PK
                   room_id          BigInt     FK -> Rooms
                   invitee_id       BigInt     FK -> Users
                   status           enum       PENDING | ACCEPTED | DECLINED
                   created_at       DateTime
                   (room_id, invitee_id) is unique
```

- A **Room** is a persistent lobby; it can host several **Games** over its lifetime.
- `Room_players` and `Game_players` link users to rooms and games (many-to-many). `Game_players` also stores each player's result, score and rank, which feed the dashboard and the leaderboard.
- The schema is defined in [backend/prisma/schema.prisma](backend/prisma/schema.prisma) and versioned with Prisma migrations.

## Features List

### Accounts and users
- **Landing, home and legal pages** (edidier): public landing page, home after login, terms of service and privacy policy.
- **Registration and login** (edidier): email / password accounts, JWT access and refresh tokens.
- **OAuth 2.0 login** (edidier, mamakaro): sign in with Google or Discord.
- **User profile and avatar** (edidier): default generated avatar, custom avatar upload, online / in-game status.
- **Responsive design** (edidier): layout adapted to mobile, tablet and desktop.

### Social
- **Friends** (bde-la-p): send, accept and remove friends, view friends' profiles, real-time updates.
- **Notifications** (bde-la-p, edidier): real-time notification center for friend requests and room invitations.
- **Room chat** (zoeschne, edidier): real-time chat shared between the lobby and the game, with message validation.

### Game
- **Rooms / lobbies** (zoeschne, edidier, bde-la-p): create a room, join it with its unique code or from the open games list, invite friends, kick a guest, close the lobby.
- **Game engine** (ofayad, zoeschne): random Wikipedia article selection, masked words, guess normalization, title detection, end conditions.
- **Semantic proximity** (zoeschne): closeness score for wrong guesses, computed with GloVe vectors.
- **Game interface** (bde-la-p, edidier, zoeschne): article board, attempts list, countdown and timer, live leaderboard, animations.
- **Results and play again** (edidier): end-of-game ranking page, play again in the same room, back to lobby / back to game.

### Statistics
- **Dashboard and statistics** (edidier): games played, wins, win rate, average score, best rank, charts, XP and level.
- **Match history** (edidier): "My games" page listing past games and results.
- **Achievements and leaderboard** (edidier): unlockable achievements, global leaderboard sorted by wins or points.

### Security and infrastructure
- **WAF and HTTPS** (mamakaro): single HTTPS entry point that filters every request with ModSecurity and the OWASP CRS.
- **Secrets management** (mamakaro, ofayad): all secrets stored in Vault and loaded by the backend at startup.
- **Logging** (mamakaro): frontend, backend, database and WAF logs centralized in ELK, with Kibana dashboards and secret redaction.
- **Monitoring and alerting** (edidier): Prometheus metrics, Grafana dashboards, Alertmanager alerts sent to Discord.
- **Health checks, status page and backups** (edidier): health endpoints, public status page, daily database backups with rotation, disaster recovery procedure.
- **Production deployment** (mamakaro, bde-la-p): multi-stage production images, production compose with isolated networks.
- **CI/CD** (edidier): GitHub Actions pipeline running lint, build and tests for the frontend and the backend.
- **Seeds** (zoeschne, edidier): development seed and production demo seed (password read from Vault).

## Modules

```
 #   Category         Module                                                   Type   Points   Member(s)
 1   Web              Use a framework for both the frontend and backend        Major    2      all
 2   Web              Real-time features using WebSockets                      Major    2      zoeschne, edidier
 3   Web              Allow users to interact with other users                 Major    2      bde-la-p, zoeschne, edidier
 4   Web              Use an ORM for the database                              Minor    1      ofayad, zoeschne
 5   Web              Custom-made design system                                Minor    1      edidier
 6   Accessibility    Support for additional browsers                          Minor    1      zoeschne
 7   User Mgmt        Standard user management and authentication              Major    2      edidier, bde-la-p
 8   User Mgmt        Game statistics and match history                        Minor    1      edidier
 9   User Mgmt        Remote authentication with OAuth 2.0                     Minor    1      edidier, mamakaro
10   User Mgmt        User activity analytics and insights dashboard           Minor    1      edidier
11   Cybersecurity    WAF / ModSecurity (hardened) + HashiCorp Vault           Major    2      mamakaro
12   Gaming           Complete web-based game, users play against each other   Major    2      ofayad, zoeschne, bde-la-p, edidier
13   Gaming           Multiplayer game (more than two players)                 Major    2      zoeschne, ofayad
14   DevOps           Log management with ELK                                  Major    2      mamakaro
15   DevOps           Monitoring with Prometheus and Grafana                   Major    2      edidier
16   DevOps           Health checks, status page, backups, disaster recovery   Minor    1      edidier

     Total: 9 Major x 2 + 7 Minor x 1 = 25 points
```

In addition to the modules, the project ships a **production version**: multi-stage `Dockerfile.prod` images for the frontend and the backend and a `docker-compose.prod.yml` where only the WAF is exposed (mamakaro, bde-la-p).

### Justification and implementation

**1. Framework for both the frontend and backend (Major)**
A structured, typed codebase that five people can work on in parallel. The frontend uses Next.js (App Router) with route groups for public, authenticated and legal pages; the backend is split into NestJS modules (`auth`, `user`, `room`, `game`, `pedantix-engine`, `prisma`...).

**2. Real-time features using WebSockets (Major)**
A multiplayer game needs live updates. Socket.IO gateways broadcast room state, game events, guesses, live rankings, notifications and chat messages to the Socket.IO room of each lobby. Sockets are authenticated with the user's JWT; disconnections are detected and abandoned games are cleaned up.

**3. Allow users to interact with other users (Major)**
Playing with friends is central to the game. Chat: a real-time room chat that follows the player from the lobby to the game. Profiles: every user has a profile page that others can view. Friends: send, accept and remove friends, see the friends list; requests and room invitations are stored in the database and pushed in real time.

**4. ORM for the database (Minor)**
Prisma gives one schema shared by the whole team, a generated typed client and versioned migrations, applied automatically when the backend starts.

**5. Custom-made design system (Minor)**
A consistent identity across the whole site. The color palette (violet `#4d37fb` and lime `#c8ff16`, each with a full 50-950 scale) is defined once as Tailwind theme tokens in `frontend/app/globals.css`, with the Geist font family for typography. More than 10 reusable components live in `frontend/components/` (modal, stat tile, line and donut charts, logo, password input, navigation and mobile navigation, account menu, user badge, notification center, headers, footer...).

**6. Support for additional browsers (Minor)**
<!-- TODO: list the tested browsers, how they were tested, and any browser-specific limitations. -->
*To be completed: tested browsers and browser-specific limitations.*

**7. Standard user management and authentication (Major)**
Registration and login with hashed passwords (bcrypt) and JWT access / refresh tokens. Users can update their profile, upload an avatar (a generated avatar is used by default), add friends and see their online / offline / in-game status, and each user has a profile page.

**8. Game statistics and match history (Minor)**
Every finished game stores each player's result, score and rank in `Game_players`. The backend aggregates them into statistics (wins, losses, win rate, best rank, level), a match history ("My games"), achievements (first victory, veteran, champion, on a roll) and a global leaderboard sorted by wins or points.

**9. Remote authentication with OAuth 2.0 (Minor)**
Lets players sign in without creating a password. Implemented with Passport strategies for Google and Discord; the callbacks go through the WAF and redirect to the frontend with the issued tokens.

**10. User activity analytics and insights dashboard (Minor)**
The dashboard turns the stored game data into insights: stat tiles (games played, win rate, average score, best rank), a line chart of score progression and a donut chart of wins and losses, built as reusable chart components.

**11. WAF / ModSecurity (hardened) + HashiCorp Vault (Major)**
The WAF (Nginx + ModSecurity + OWASP Core Rule Set) is the only exposed service and forces HTTPS; every port that bypassed it was closed, and targeted exclusion rules fix false positives (Google OAuth scopes, Kibana). Vault stores all secrets (database password, JWT secret, OAuth credentials...); a one-shot `vault-init` container writes them at startup and the backend reads them through `node-vault`.

**12. Complete web-based game (Major)**
An original multiplayer word game inspired by Pedantix, chosen because it is a game we enjoy playing ourselves. The engine selects an article (curated library with a Wikipedia API fallback), masks its words, normalizes guesses (including Roman and Latin numerals), scores wrong guesses with semantic proximity, and ends the game after a short grace period once the first player finds the title. Players play live against each other, with a clear ranking and win / loss result.

**13. Multiplayer game (more than two players) (Major)**
A room accepts between `min_players` and `max_players` players, who all race on the same article at the same time. All game state lives on the server and is broadcast to every client, so all players see the same game and the same live leaderboard.

**14. Log management with ELK (Major)**
Logstash collects the log files of the frontend, backend, database and WAF, parses them (grok), redacts secrets, and sends them to Elasticsearch. Kibana dashboards are imported automatically (response codes, p95 latency, login failures), Elasticsearch snapshots handle retention, and Kibana is only reachable through the WAF with authentication.

**15. Monitoring with Prometheus and Grafana (Major)**
The backend exposes metrics with `prom-client`; Prometheus scrapes them, Grafana displays provisioned dashboards behind a password and the WAF, and Alertmanager sends alerts to a Discord channel.

**16. Health checks, status page, backups and disaster recovery (Minor)**
Health endpoints (`@nestjs/terminus`) and Docker health checks, a status page in the frontend, a `backup` container taking a compressed `pg_dump` every 24 hours (the last 7 are kept), and a documented restore procedure in [docs/disaster-recovery.md](docs/disaster-recovery.md).

## Individual Contributions

### bde-la-p (Brunhilde) — Product Owner
- Friends system: requests, accept / remove in real time, add friends from the lobby, friends' profiles.
- Invitations to rooms and the related notifications.
- Game page frontend: article display, attempts list, timer.
- Frontend production Dockerfile and first production compose file.
- **Challenges**: keeping friends lists and notifications consistent in real time across pages (accepting from the notification center while browsing the friends page).

### edidier (Emilie) — Project Manager
- Frontend foundations: layout, header, sidebar, home, landing, legal pages, design and logo, responsive design, animations.
- Custom design system: color palette, typography and reusable components.
- Authentication: email / password, JWT, Google and Discord OAuth, link between backend and frontend.
- User management: profiles, avatars (default and uploaded), status.
- Rooms: unique join code, open games list, leave / kick / close lobby, play again, back to game.
- Results page, dashboard with statistics and charts (analytics dashboard), "My games", leaderboard pages, chat bubble.
- Prometheus, Grafana, Alertmanager; health checks, status page, backups and disaster recovery; CI/CD pipeline (GitHub Actions).
- **Challenges**: keeping the frontend usable while the backend was not ready (mock data first, replaced progressively); cleaning up abandoned games that left rooms and players in an inconsistent state.

### mamakaro (Maria) — Tech Lead
- Docker architecture: public / private / egress networks, development and production stacks, multi-stage production images.
- WAF (Nginx + ModSecurity + OWASP CRS), HTTPS, closing every port that bypassed the WAF.
- HashiCorp Vault integration.
- ELK stack: Logstash pipelines, Elasticsearch, Kibana dashboards, secret redaction, snapshots.
- **Challenges**: WAF false positives breaking legitimate requests (Google login, Kibana saves, CSS), solved with targeted exclusion rules; Podman-specific issues (SELinux volume labels, `depends_on` on one-shot containers); log masking that broke log parsing.

### ofayad (Odile)
- Architecture and documentation of the Room and Game modules.
- Pedantix engine: article selection from Wikipedia (with a curated library and fallback to reduce API calls), game lifecycle.
- Prisma setup, Vault dependency in the backend, code style fixes (ESLint, Prettier).
- **Challenges**: designing an engine independent from the WebSocket layer; limiting calls to the Wikipedia API while still getting good articles.

### zoeschne (Zoé)
- Room creation, live join, start button, Socket.IO gateways for rooms and games.
- Persistent chat between lobby and game.
- Guess validation and semantic proximity (GloVe vectors), Roman and Latin numerals.
- Integration of the game frontend with the backend, development seed, cheat mode for testing.
- Browser compatibility testing (Support for additional browsers module).
- **Challenges**: getting meaningful proximity scores from word vectors (vector normalization and removal of dominant components); keeping game state synchronized between all players.

## Resources

### Documentation
- [Next.js](https://nextjs.org/docs), [React](https://react.dev/), [Tailwind CSS](https://tailwindcss.com/docs), [Framer Motion](https://motion.dev/)
- [NestJS](https://docs.nestjs.com/) (including [WebSockets](https://docs.nestjs.com/websockets/gateways) and [authentication](https://docs.nestjs.com/recipes/passport))
- [Socket.IO](https://socket.io/docs/v4/)
- [Prisma](https://www.prisma.io/docs), [PostgreSQL](https://www.postgresql.org/docs/)
- [Passport.js](https://www.passportjs.org/), [JSON Web Tokens](https://jwt.io/introduction)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2), [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
- [ModSecurity](https://github.com/owasp-modsecurity/ModSecurity), [OWASP Core Rule Set](https://coreruleset.org/docs/), [HashiCorp Vault](https://developer.hashicorp.com/vault/docs)
- [Elastic Stack (ELK)](https://www.elastic.co/guide/index.html), [Prometheus](https://prometheus.io/docs/), [Grafana](https://grafana.com/docs/)
- [Docker Compose](https://docs.docker.com/compose/), [Podman](https://docs.podman.io/)
- [GloVe: Global Vectors for Word Representation](https://nlp.stanford.edu/projects/glove/), [MediaWiki API](https://www.mediawiki.org/wiki/API:Main_page)
- [Pedantix](https://cemantix.certitudes.org/pedantix), the original game that inspired Transcendix

### Use of AI
AI assistants were used as a learning and troubleshooting aid:
- **Learning concepts**: explanations of NestJS modules and gateways, Prisma, WebSockets, JWT and OAuth flows, Vault, ModSecurity, the ELK stack and Prometheus.
- **Debugging and configuration**: diagnosing build and runtime errors, Docker / Podman issues (sockets, permissions, networks), WAF rules and Nginx configuration.

AI was not used to generate features unsupervised: every suggestion was read, understood, tested and adapted by the team member responsible for that part of the project.

## Known Limitations

- The TLS certificate is self-signed, so browsers show a warning.
- Vault runs in development mode: secrets are kept in memory and rewritten from `.env` by `vault-init` at every start.
- Chat messages are kept in memory by the backend and are lost when it restarts.
- The game is in English only.

## Further Documentation

Technical notes are available in [docs/](docs/): backend modules and game rules, security (WAF, Vault), Docker architecture, production deployment, CI/CD and disaster recovery.
