
.PHONY: all clean build dev.build test ci.test ci.build setup install lint lint-fix typecheck help

# Default target - builds and tests everything
all: setup lint build ci.test ## Default target, builds and tests everything

# Setup - install dependencies
setup: ## Install dependencies with exact versions (using npm ci)
	@echo "Installing dependencies for setup-modal..."
	npm ci
	@echo "setup-modal dependencies installed successfully"

# Install - install dependencies
install: ## Install dependencies (using npm install)
	@echo "Installing dependencies for setup-modal..."
	npm install
	@echo "setup-modal dependencies installed successfully"

# Clean build artifacts
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@npm run clean
	@echo "Build artifacts cleaned"

# Build the package
build: ## Build setup-modal
	@npm run build
	@echo "setup-modal built successfully"

# CI build - build only (no lint-fix)
ci.build: ## CI: Build only
	@npm run ci:build
	@echo "setup-modal CI build completed"

# Dev build - only if sources changed
dev.build: ## Dev build setup-modal (only if sources changed)
	@npm run dev:build
	@echo "setup-modal dev build completed"

# Run tests
test: ## Test setup-modal
	npm test
	@echo "setup-modal tests completed successfully"

# Run tests in CI mode
ci.test: ## Run tests in CI mode
	@npm run test:ci
	@echo "setup-modal CI tests completed successfully"

# Run ESLint checks
lint: ## Run ESLint checks
	@echo "Running ESLint checks..."
	@npm run lint
	@echo "ESLint checks completed"

# Fix ESLint issues automatically where possible
lint-fix: ## Fix ESLint and formatting issues automatically
	@echo "Fixing ESLint and formatting issues..."
	npm run lint:fix
	npm run typecheck
	@echo "ESLint and formatting fixes completed"

# Run TypeScript type checking
typecheck: ## Run TypeScript type checking
	@npm run typecheck
	@echo "setup-modal typecheck completed"

.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)
