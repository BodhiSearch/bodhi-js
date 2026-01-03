.PHONY: all setup install build clean lint lint-fix typecheck help

# This is a minimal package containing only type definitions
# Most targets are no-ops but provided for consistency with other packages

all: setup ## Default target

setup: ## Install dependencies with exact versions (npm ci)
	@echo "Installing dependencies for bodhi-browser-ext types..."
	npm ci
	@echo "bodhi-browser-ext dependencies installed successfully"

install: ## Install dependencies (npm install)
	@echo "Installing dependencies for bodhi-browser-ext types..."
	npm install
	@echo "bodhi-browser-ext dependencies installed successfully"

build: ## Build (no-op for types-only package)
	@echo "bodhi-browser-ext: No build required (types only)"

clean: ## Clean (no-op for types-only package)
	@echo "bodhi-browser-ext: Cleaning node_modules..."
	rm -rf node_modules

lint: ## Lint (no-op for types-only package)
	@echo "bodhi-browser-ext: No linting configured (types only)"

lint-fix: ## Lint fix (no-op for types-only package)
	@echo "bodhi-browser-ext: No linting configured (types only)"

typecheck: ## Type check (no-op for types-only package)
	@echo "bodhi-browser-ext: No typecheck (referenced by SDK packages)"

.DEFAULT_GOAL := help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
