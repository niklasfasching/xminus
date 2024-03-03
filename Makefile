xminus = $(HOME)/go/bin/xminus

.PHONY: install
install: $(HOME)/go/bin/xminus

$(xminus): $(shell find cli)
	cd cli && go install ./cmd/xminus

.PHONY: dev
dev: install
	$(xminus) -w

.PHONY: bench
bench: install
	$(xminus) test/benchmark/bench.mjs

.PHONY: update-fixtures
update-fixtures: install
	$(xminus) -u test/*.mjs test/integration/*.mjs

.PHONY: test
test: install
	$(xminus) test/*.mjs test/integration/*.mjs

.PHONY: docs
docs: install
	etc/build-docs

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks
