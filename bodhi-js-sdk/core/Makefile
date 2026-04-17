.PHONY: dependencies build clean

dependencies:
	@echo "Building dependencies..."
	@$(MAKE) -C ../../setup-modal build
	@$(MAKE) -C ../../setup-modal-v2 build

build: dependencies
	@echo "Building bodhi-js-core..."
	@npm run build

clean:
	@npm run clean
	@echo "Cleaned bodhi-js-core build artifacts"
