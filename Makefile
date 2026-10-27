# Usage: make <target>   (make help for the list)
# Podman users without the docker alias: make up COMPOSE="podman compose"

COMPOSE ?= docker compose
DEV     := $(COMPOSE)
PROD    := $(COMPOSE) -f docker-compose.prod.yml

.DEFAULT_GOAL := help
.PHONY: help env up down restart logs ps seed seed-reset prod prod-down prod-logs clean fclean re

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-12s %s\n", $$1, $$2}'

env: ## create or complete .env from .env.example and enable the git hooks
	@sh .githooks/env-sync.sh
	@git config core.hooksPath .githooks

up: env 
	@$(PROD) down >/dev/null 2>&1 || true
	$(DEV) up -d --build

down:
	$(DEV) down

restart: down up 

logs:
	$(DEV) logs -f $(s)

ps:
	$(DEV) ps

seed: ## Run the development seed (only if the database is empty)
	$(DEV) exec backend npx prisma db seed

seed-reset: ## Reset the development database to the seed data
	$(DEV) exec -e SEED_FORCE=true backend npx prisma db seed

prod: env ## Build and start prod mode
	@$(DEV) down >/dev/null 2>&1 || true
	$(PROD) up -d --build

prod-down: ## Stop prod mode
	$(PROD) down

prod-logs: ## Prod mode logs
	$(PROD) logs -f $(s)

clean: ## Stop dev & prod
	-$(DEV) down
	-$(PROD) down

fclean: ## Stop prod & dev and delete all volumes
	@echo "This deletes every volume (database, backups, logs). Press Ctrl+C to cancel, Enter to continue."
	@read _
	-$(DEV) down -v
	-$(PROD) down -v

re: fclean up 
