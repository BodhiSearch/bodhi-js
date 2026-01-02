.PHONY: all setup install build dev.build clean lint lint-fix dependencies dev.dependencies ci.build typecheck

all: setup lint-fix build

setup:
	npm ci

install:
	npm install

build:
	npm run build

dev.build: ## Dev: Build with caching
	npm run dev:build

ci.build: ## CI: Build only (no dep rebuild)
	npm run ci:build

clean:
	npm run clean

lint:
	npm run lint

typecheck: ## Type check all
	npm run typecheck

lint-fix:
	npm run lint:fix
	npm run typecheck

dependencies:
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