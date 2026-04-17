.PHONY: all clean build dev.build test ci.test ci.build setup install lint lint-fix typecheck help types

all: setup lint build ci.test ## Default target, builds and tests everything

setup: ## Install dependencies with exact versions (using npm ci)
	@echo "Installing dependencies for setup-modal-v2..."
	npm ci
	@echo "Installing type package dependencies..."
	cd src/types && npm ci
	@echo "setup-modal-v2 dependencies installed successfully"

install: ## Install dependencies (using npm install)
	@echo "Installing dependencies for setup-modal-v2..."
	npm install
	@echo "Installing type package dependencies..."
	cd src/types && npm install
	@echo "setup-modal-v2 dependencies installed successfully"

clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@npm run clean
	@echo "Cleaning type package build artifacts..."
	@cd src/types && npm run clean
	@echo "Build artifacts cleaned"

build: ## Build setup-modal-v2
	@npm run build
	@echo "setup-modal-v2 built successfully"

ci.build: ## CI: Build only
	@npm run ci:build
	@echo "setup-modal-v2 CI build completed"

dev.build: ## Dev build setup-modal-v2 (only if sources changed)
	@npm run dev:build
	@echo "setup-modal-v2 dev build completed"

dev.all: ## Full validation: install → lint:fix → typecheck → build → test
	npm install
	npm run lint:fix
	npm run typecheck
	npm run dev:build
	npm test

types: ## Build types package
	@cd src/types && npm run build
	@echo "setup-modal-v2 types built successfully"

test: ## Test setup-modal-v2
	npm test
	@echo "setup-modal-v2 tests completed successfully"

ci.test: ## Run tests in CI mode
	@npm run test:ci
	@echo "setup-modal-v2 CI tests completed successfully"

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
	@echo "setup-modal-v2 typecheck completed"

.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
