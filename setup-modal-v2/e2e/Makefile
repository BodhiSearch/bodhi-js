.PHONY: all clean build dev.build ci.build setup install lint lint-fix typecheck help

all: setup lint-fix build

setup: ## Install dependencies with exact versions (using npm ci)
	@echo "Installing dependencies for setup-modal-v2-e2e..."
	npm ci
	@echo "setup-modal-v2-e2e dependencies installed successfully"

install: ## Install dependencies (using npm install)
	@echo "Installing dependencies for setup-modal-v2-e2e..."
	npm install
	@echo "setup-modal-v2-e2e dependencies installed successfully"

build: ## Build setup-modal-v2-e2e
	@npm run build
	@echo "setup-modal-v2-e2e built successfully"

ci.build: ## CI: Build only
	@npm run build
	@echo "setup-modal-v2-e2e CI build completed"

dev.build: ## Dev build setup-modal-v2-e2e (only if sources changed)
	@npm run dev:build
	@echo "setup-modal-v2-e2e dev build completed"

dev.all: ## Full validation: install → lint:fix → typecheck → build
	npm install
	npm run lint:fix
	npm run typecheck
	npm run dev:build

lint: ## Run ESLint checks
	@echo "Running ESLint checks..."
	@npm run lint
	@echo "ESLint checks completed"

lint-fix: ## Fix ESLint and formatting issues automatically
	@echo "Fixing ESLint and formatting issues..."
	npm run lint:fix
	npm run typecheck
	@echo "ESLint and formatting fixes completed"

typecheck: ## Run TypeScript type checking
	@npm run typecheck
	@echo "setup-modal-v2-e2e typecheck completed"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@npm run clean
	@echo "Build artifacts cleaned"

.DEFAULT_GOAL := help
.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
