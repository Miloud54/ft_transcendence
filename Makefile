NAME			=	ft_transcendence
COMPOSE			?=	docker compose
DEV				=	$(COMPOSE)
PROD			=	$(COMPOSE) -f docker-compose.prod.yml
ENGINE			?=	$(firstword $(COMPOSE))
PROD_PROJECT	=	transcendence-prod
DEV_PROJECT		=	transcendence-dev
running			=	$(shell $(ENGINE) ps -aq --filter label=com.docker.compose.project=$(1) 2>/dev/null)
PODMAN_SOCKET	=	command -v podman >/dev/null 2>&1 && command -v systemctl >/dev/null 2>&1 \
					&& systemctl --user enable --now podman.socket >/dev/null 2>&1 || true

BUILD_DIR		=	.build
PROD_STAMP		=	$(BUILD_DIR)/prod
DEV_STAMP		=	$(BUILD_DIR)/dev
PROD_INPUTS		=	backend frontend docker-compose.prod.yml .env
DEV_INPUTS		=	backend/Dockerfile backend/package.json backend/package-lock.json \
					frontend/Dockerfile frontend/package.json frontend/package-lock.json \
					docker-compose.yml .env
GENERATED		=	-name node_modules -o -name .next -o -name dist -o -name generated \
					-o -name uploads -o -name cheat
changed			=	[ ! -f $(2) ] || [ -n "$$(find $(1) \( $(GENERATED) \) -prune -o -type f -newer $(2) -print 2>/dev/null | head -n 1)" ]

all: up

env:
	@sh .githooks/env-sync.sh
	@git config core.hooksPath .githooks

up: env
	@$(PODMAN_SOCKET)
	@$(if $(call running,$(DEV_PROJECT)),$(DEV) down,true)
	@if $(call changed,$(PROD_INPUTS),$(PROD_STAMP)); then \
		$(PROD) up -d --build && mkdir -p $(BUILD_DIR) && touch $(PROD_STAMP); \
	elif [ -z "$(call running,$(PROD_PROJECT))" ]; then \
		$(PROD) up -d; \
	else \
		echo "$(NAME): production stack is up to date."; \
	fi

down:
	@$(PODMAN_SOCKET)
	@$(if $(call running,$(PROD_PROJECT)),$(PROD) down,true)
	@$(if $(call running,$(DEV_PROJECT)),$(DEV) down,true)

restart: down up

logs:
	$(PROD) logs -f $(s)

ps:
	$(PROD) ps

dev: env
	@$(PODMAN_SOCKET)
	@$(if $(call running,$(PROD_PROJECT)),$(PROD) down,true)
	@if $(call changed,$(DEV_INPUTS),$(DEV_STAMP)); then \
		$(DEV) up -d --build && mkdir -p $(BUILD_DIR) && touch $(DEV_STAMP); \
	elif [ -z "$(call running,$(DEV_PROJECT))" ]; then \
		$(DEV) up -d; \
	else \
		echo "$(NAME): development stack is up to date."; \
	fi

dev-restart: down dev

dev-logs:
	$(DEV) logs -f $(s)

dev-ps:
	$(DEV) ps

dev-seed:
	$(DEV) exec backend sh -c 'eval "$$(npx tsx src/load-vault-env.ts)" && npx prisma db seed'

dev-seed-reset:
	$(DEV) exec -e SEED_FORCE=true backend sh -c 'eval "$$(npx tsx src/load-vault-env.ts)" && npx prisma db seed'

dev-clean-cache:
	rm -rf frontend/.next

clean: down

fclean: clean
	@echo "This deletes every volume (database, backups, logs). Press Ctrl+C to cancel, Enter to continue."
	@read _
	-$(PROD) down -v
	-$(DEV) down -v
	rm -rf $(BUILD_DIR)

re: fclean all

.PHONY: all env up down restart logs ps dev dev-restart dev-logs dev-ps dev-seed dev-seed-reset dev-clean-cache clean fclean re
