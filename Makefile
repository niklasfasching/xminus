.PHONY: install
install:
	go env -w GOPROXY=direct
	cd cli && go get -u ./...
	cd cli && go build *.go

.PHONY: dev
dev:
	cli/xminus

.PHONY: bench
bench:
	cli/xminus -e -r test/integration/bench.mjs

.PHONY: update-fixtures
update-fixtures:
	for f in test/*.mjs; do cli/xminus -e -r $$f update-fixtures > test/fixtures/$$(basename $$f .mjs).json; done

.PHONY: test
test:
	for f in test/*.mjs; do cli/xminus -e -r $$f; done
	cli/xminus -e -r test/integration/todomvc.mjs

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks
