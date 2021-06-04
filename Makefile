cli/xminus: cli/*.go cli/go.mod cli/go.sum cli/assets/*
	go env -w GOPROXY=direct
	cd cli && go get -u ./...
	cd cli && go build -o xminus *.go

.PHONY: dev
dev: cli/xminus
	cli/xminus -w

.PHONY: bench
bench: cli/xminus
	cli/xminus test/benchmark/bench.mjs

.PHONY: update-fixtures
update-fixtures: cli/xminus
	cli/xminus -u test/*.mjs test/integration/*.mjs

.PHONY: test
test: cli/xminus
	cli/xminus test/*.mjs test/integration/*.mjs

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks

.PHONY: docs
docs: cli/xminus
	etc/build-docs
