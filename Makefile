cli/xminus: cli/*.go
	go env -w GOPROXY=direct
	cd cli && go get -u ./...
	cd cli && go build *.go

.PHONY: dev
dev: cli/xminus
	cli/xminus

.PHONY: bench
bench: cli/xminus
	cli/xminus -e test/benchmark/bench.mjs

.PHONY: update-fixtures
update-fixtures: cli/xminus
	for f in test/*.mjs; do cli/xminus -e -a update-fixtures $$f > test/fixtures/$$(basename $$f .mjs).json; done

.PHONY: test
test: cli/xminus
	cli/xminus -e test/*.mjs test/integration/*.mjs

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks

.PHONY: docs
docs: cli/xminus
	etc/build-docs
