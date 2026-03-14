.PHONY: help install setup-hooks dev build preview \
       lint lint-fix format format-check type-check \
       rust-check rust-clippy rust-fmt rust-fmt-check rust-test \
       test test-watch test-coverage \
       check-all clean clean-all db-reset nuke \
       icon icon-install icon-presets \
       l lf f fc t tc ca

PRESET ?= default

# Default target
help: ## Show this help message
	@echo "Available targets:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Setup ────────────────────────────────────────────────────────────────────

install: ## Install all dependencies
	npm install
	cd src-tauri && cargo fetch

setup-hooks: ## Configure git to use project hooks
	git config core.hooksPath .githooks
	@echo "Git hooks configured to use .githooks/"

# ─── Development ──────────────────────────────────────────────────────────────

dev: ## Start Tauri dev server
	npm run tauri dev

build: ## Build production app
	npm run tauri build

preview: ## Preview frontend build
	npm run preview

# ─── Frontend Quality ─────────────────────────────────────────────────────────

lint: ## Run ESLint
	npx eslint .

lint-fix: ## Run ESLint with auto-fix
	npx eslint . --fix

format: ## Format code with Prettier
	npx prettier --write "src/**/*.{ts,tsx,css}" "*.{json,js,ts}"

format-check: ## Check formatting
	npx prettier --check "src/**/*.{ts,tsx,css}" "*.{json,js,ts}"

type-check: ## Run TypeScript type checking
	npx tsc --noEmit

# ─── Rust Quality ─────────────────────────────────────────────────────────────

rust-check: ## Run cargo check
	cd src-tauri && cargo check

rust-clippy: ## Run Clippy linter
	cd src-tauri && cargo clippy -- -D warnings

rust-fmt: ## Format Rust code
	cd src-tauri && cargo fmt

rust-fmt-check: ## Check Rust formatting
	cd src-tauri && cargo fmt -- --check

rust-test: ## Run Rust tests
	cd src-tauri && cargo test

# ─── Frontend Testing ─────────────────────────────────────────────────────────

test: ## Run tests
	npx vitest run

test-watch: ## Run tests in watch mode
	npx vitest

test-coverage: ## Run tests with coverage
	npx vitest run --coverage

# ─── Combined ─────────────────────────────────────────────────────────────────

check-all: ## Run all checks (format, lint, types, clippy, tests)
	@echo ""
	@echo ">>> Prettier (format check)"
	@$(MAKE) --no-print-directory format-check
	@echo ""
	@echo ">>> ESLint"
	@$(MAKE) --no-print-directory lint
	@echo ""
	@echo ">>> TypeScript"
	@$(MAKE) --no-print-directory type-check
	@echo ""
	@echo ">>> Rust fmt"
	@$(MAKE) --no-print-directory rust-fmt-check
	@echo ""
	@echo ">>> Clippy"
	@$(MAKE) --no-print-directory rust-clippy
	@echo ""
	@echo ">>> Frontend tests"
	@$(MAKE) --no-print-directory test
	@echo ""
	@echo ">>> All checks passed!"

# ─── App Icon ─────────────────────────────────────────────────────────────────

.venv/bin/python3:
	python3 -m venv .venv
	.venv/bin/pip install -r scripts/requirements.txt

icon-install: .venv/bin/python3 ## Install icon generation dependencies

icon: .venv/bin/python3 ## Generate app icon (PRESET=default|dark|light|blue)
	.venv/bin/python3 scripts/generate-icon.py --preset $(PRESET)

icon-presets: .venv/bin/python3 ## List available icon presets
	.venv/bin/python3 scripts/generate-icon.py --list-presets

# ─── Maintenance ──────────────────────────────────────────────────────────────

clean: ## Clean build artifacts
	rm -rf dist/ node_modules/.vite/
	cd src-tauri && cargo clean

clean-all: clean ## Clean everything (including node_modules)
	rm -rf node_modules/

db-reset: ## Delete the local SQLite database
	rm -f ~/Library/Application\ Support/com.marcinbaniowski.transcribr/transcribr.db
	@echo "Database deleted. It will be recreated on next launch."

APP_ID := com.marcinbaniowski.transcribr

nuke: ## Remove all app data and app from /Applications
	rm -rf ~/Library/Application\ Support/$(APP_ID)
	rm -rf ~/Library/Caches/$(APP_ID)
	rm -rf ~/Library/Logs/$(APP_ID)
	rm -rf ~/Library/WebKit/$(APP_ID)
	rm -rf /Applications/Transcribr.app
	@echo "All app data and application removed."

# ─── Short Aliases ────────────────────────────────────────────────────────────

l: lint           ## Alias for lint
lf: lint-fix      ## Alias for lint-fix
f: format         ## Alias for format
fc: format-check  ## Alias for format-check
t: test           ## Alias for test
tc: test-coverage ## Alias for test-coverage
ca: check-all     ## Alias for check-all
