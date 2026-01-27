.PHONY: all setup install build dev.build clean lint lint-fix dependencies dev.dependencies ci.build typecheck upgrade.ts-client help

all: setup lint-fix build ## Default: setup → lint-fix → build

setup: ## Install dependencies (npm ci)
	npm ci

install: ## Install dependencies (npm install)
	npm install

build: ## Build all packages
	npm run build

dev.build: ## Dev: Build with caching
	npm run dev:build

dev.all: dev.dependencies ## Full validation: install → lint:fix → typecheck → build (no test script)
	npm install
	npm run lint:fix
	npm run typecheck
	npm run dev:build

ci.build: ## CI: Build only (no dep rebuild)
	npm run ci:build

clean: ## Clean build artifacts
	npm run clean

lint: ## Run ESLint checks
	npm run lint

typecheck: ## Type check all
	npm run typecheck

lint-fix: ## Fix ESLint and formatting issues
	npm run lint:fix
	npm run typecheck

dependencies: ## Build dependencies (setup-modal) and install
	$(MAKE) -C ../setup-modal build
	npm install

dev.dependencies: ## Dev: Build dependencies with caching
	$(MAKE) -C ../setup-modal dev.build
	npm install

release: ## Create and push tag for bodhi-js-sdk release
	@echo "Preparing to release bodhi-js-sdk packages..."
	@node ../scripts/git-check-branch.js
	@node ../scripts/git-check-sync.js
	@CURRENT_VERSION=$$(node ../scripts/get-npm-version.js @bodhiapp/bodhi-js-core) && \
	NEXT_VERSION=$$(node ../scripts/increment-version.js $$CURRENT_VERSION) && \
	echo "Current version on npmjs: $$CURRENT_VERSION" && \
	echo "Next version to release: $$NEXT_VERSION" && \
	TAG_NAME="bodhi-js-sdk/v$$NEXT_VERSION" && \
	node ../scripts/delete-tag-if-exists.js "$$TAG_NAME" && \
	echo "Creating tag $$TAG_NAME..." && \
	git tag "$$TAG_NAME" && \
	git push origin "$$TAG_NAME" && \
	echo "Tag $$TAG_NAME pushed. GitHub workflow will handle the release process."

upgrade.ts-client: ## Upgrade @bodhiapp/ts-client to latest version
	@echo "Upgrading @bodhiapp/ts-client..."
	@echo "Current version:"
	@npm list @bodhiapp/ts-client --depth=0 2>/dev/null || echo "Not installed"
	@echo ""
	@echo "Fetching latest version from npm..."
	$(eval LATEST_VERSION := $(shell npm view @bodhiapp/ts-client version))
	@echo "Latest version: $(LATEST_VERSION)"
	@echo ""
	@echo "Updating package.json files with exact version $(LATEST_VERSION)..."
	@sed -i '' 's/"@bodhiapp\/ts-client": "[^"]*"/"@bodhiapp\/ts-client": "$(LATEST_VERSION)"/' package.json
	@sed -i '' 's/"@bodhiapp\/ts-client": "[^"]*"/"@bodhiapp\/ts-client": "$(LATEST_VERSION)"/' core/package.json
	@sed -i '' 's/"@bodhiapp\/ts-client": "[^"]*"/"@bodhiapp\/ts-client": "$(LATEST_VERSION)"/' ext/package.json
	@sed -i '' 's/"@bodhiapp\/ts-client": "[^"]*"/"@bodhiapp\/ts-client": "$(LATEST_VERSION)"/' web/package.json
	@sed -i '' 's/"@bodhiapp\/ts-client": "[^"]*"/"@bodhiapp\/ts-client": "$(LATEST_VERSION)"/' react-core/package.json
	@echo ""
	@echo "Installing..."
	npm install
	@echo "Linting..."
	$(MAKE) lint
	@echo "Building..."
	$(MAKE) clean
	$(MAKE) build

.DEFAULT_GOAL := help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z0-9._-]+:.*?## / {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)