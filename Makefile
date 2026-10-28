# Usage: make <target>   (make help for the list)
# Podman users without the docker alias: make up COMPOSE="podman compose"

COMPOSE ?= docker compose
DEV     := $(COMPOSE)
PROD    := $(COMPOSE) -f docker-compose.prod.yml
ENGINE  ?= $(firstword $(COMPOSE))
running  = $(shell $(ENGINE) ps -aq --filter label=com.docker.compose.project=$(1) 2>/dev/null)

.DEFAULT_GOAL := help
.PHONY: help env up down restart logs ps dev dev-restart dev-logs dev-ps dev-seed dev-seed-reset clean fclean re

help: ## Show this help
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  make %-15s %s\n", $$1, $$2}'

env: ## Create or complete .env from .env.example and enable the git hooks
	@sh .githooks/env-sync.sh
	@git config core.hooksPath .githooks

# ---- Production (reference) ----

up: env ## Build and start the production stack
	@$(DEV) down >/dev/null 2>&1 || true
	$(PROD) up -d --build

down: ## Stop the running stack, prod or dev (data kept)
	@$(if $(call running,transcendence-prod),$(PROD) down,true)
	@$(if $(call running,transcendence-dev),$(DEV) down,true)

restart: down up ## Restart the production stack

logs: ## Follow prod logs (one service: make logs s=backend)
	$(PROD) logs -f $(s)

ps: ## Show prod container status
	$(PROD) ps

# ---- Development ----

dev: env ## Build and start the development stack (hot reload)
	@$(PROD) down >/dev/null 2>&1 || true
	$(DEV) up -d --build

dev-restart: down dev ## Restart the development stack

dev-logs: ## Follow dev logs (one service: make dev-logs s=backend)
	$(DEV) logs -f $(s)

dev-ps: ## Show dev container status
	$(DEV) ps

dev-seed: ## Run the development seed (only if the database is empty)
	$(DEV) exec backend npx prisma db seed

dev-seed-reset: ## Reset the development database to the seed data
	$(DEV) exec -e SEED_FORCE=true backend npx prisma db seed

dev-clean-cache: ## Delete the Next.js dev build cache (frontend/.next)
	rm -rf frontend/.next

# ---- Cleanup ----

clean: down ## Stop both stacks (data kept)

fclean: ## Stop both stacks and DELETE all volumes (database, backups, logs)
	@echo "This deletes every volume (database, backups, logs). Press Ctrl+C to cancel, Enter to continue."
	@read _
	-$(PROD) down -v
	-$(DEV) down -v

re: fclean up ## Delete everything and rebuild the production stack
