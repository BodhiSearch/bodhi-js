# Bodhi JS SDK Makefile
# Orchestrates builds for bodhi-js-sdk and setup-modal

.PHONY: all setup install build clean lint lint-fix test help

all: build ## Default target, builds everything

setup: ## Install dependencies with exact versions (npm ci)
	@echo "Installing dependencies..."
	$(MAKE) -C bodhi-browser-ext setup
	$(MAKE) -C setup-modal setup
	$(MAKE) -C bodhi-js-sdk setup
	@echo "Dependencies installed successfully"

install: ## Install dependencies (npm install)
	@echo "Installing dependencies..."
	$(MAKE) -C bodhi-browser-ext install
	$(MAKE) -C setup-modal install
	$(MAKE) -C bodhi-js-sdk install
	@echo "Dependencies installed successfully"

clean: ## Clean all build artifacts
	@echo "Cleaning build artifacts..."
	$(MAKE) -C bodhi-browser-ext clean
	$(MAKE) -C setup-modal clean
	$(MAKE) -C bodhi-js-sdk clean
	@echo "Clean completed"

build: ## Build all components
	@echo "Building all components..."
	$(MAKE) -C bodhi-browser-ext build
	$(MAKE) -C setup-modal build
	$(MAKE) -C bodhi-js-sdk build
	@echo "Build completed successfully"

lint: ## Run ESLint checks
	@echo "Running lint checks..."
	$(MAKE) -C bodhi-browser-ext lint
	$(MAKE) -C setup-modal lint
	$(MAKE) -C bodhi-js-sdk lint
	@echo "Lint checks completed"

lint-fix: ## Fix ESLint and formatting issues
	@echo "Fixing lint and formatting issues..."
	$(MAKE) -C bodhi-browser-ext lint-fix
	$(MAKE) -C setup-modal lint-fix
	$(MAKE) -C bodhi-js-sdk lint-fix
	@echo "Lint fixes completed"

test: ## Run tests
	@echo "Running tests..."
	$(MAKE) -C setup-modal test
	@echo "Tests completed"

typecheck: ## Run TypeScript type checking
	@echo "Running TypeScript type checking..."
	$(MAKE) -C bodhi-browser-ext typecheck
	$(MAKE) -C setup-modal typecheck
	$(MAKE) -C bodhi-js-sdk typecheck
	@echo "Type checking completed"

.DEFAULT_GOAL := help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
