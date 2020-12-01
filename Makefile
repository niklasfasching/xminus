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
	cli/xminus -e -r test/test.mjs update-fixtures 2> test/fixtures/test.json
	cli/xminus -e -r test/parser.mjs update-fixtures 2> test/fixtures/parser.json

.PHONY: test
test:
	cli/xminus -e -r test/test.mjs
	cli/xminus -e -r test/parser.mjs

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks
