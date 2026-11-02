NAME			=	ft_transcendence
COMPOSE			?=	docker compose
DEV				=	$(COMPOSE)
PROD			=	$(COMPOSE) -f docker-compose.prod.yml
ENGINE			?=	$(firstword $(COMPOSE))
running			=	$(shell $(ENGINE) ps -aq --filter label=com.docker.compose.project=$(1) 2>/dev/null)
PODMAN_SOCKET	=	command -v podman >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1 \
					&& systemctl --user enable --now podman.socket >/dev/null 2>&1 || true

all: up

env:
	@sh .githooks/env-sync.sh
	@git config core.hooksPath .githooks

up: env
	@$(PODMAN_SOCKET)
	@$(DEV) down >/dev/null 2>&1 || true
	$(PROD) up -d --build

down:
	@$(PODMAN_SOCKET)
	@$(if $(call running,$(NAME)-prod),$(PROD) down,true)
	@$(if $(call running,$(NAME)-dev),$(DEV) down,true)

restart: down up

logs:
	$(PROD) logs -f $(s)

ps:
	$(PROD) ps

dev: env
	@$(PODMAN_SOCKET)
	@$(PROD) down >/dev/null 2>&1 || true
	$(DEV) up -d --build

dev-restart: down dev

dev-logs:
	$(DEV) logs -f $(s)

dev-ps:
	$(DEV) ps

dev-seed:
	$(DEV) exec backend npx prisma db seed

dev-seed-reset:
	$(DEV) exec -e SEED_FORCE=true backend npx prisma db seed

dev-clean-cache:
	rm -rf frontend/.next

clean: down

fclean: clean
	@echo "This deletes every volume (database, backups, logs). Press Ctrl+C to cancel, Enter to continue."
	@read _
	-$(PROD) down -v
	-$(DEV) down -v

re: fclean all

.PHONY: all env up down restart logs ps dev dev-restart dev-logs dev-ps dev-seed dev-seed-reset dev-clean-cache clean fclean re
