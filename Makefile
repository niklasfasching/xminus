.PHONY: install
install:
	go build -o cli/xminus cli/*.go

.PHONY: dev
dev:
	cli/xminus

.PHONY: bench
bench:
	cli/xminus -e -r test/bench.mjs

.PHONY: update-fixtures
update-fixtures:
	cli/xminus -e -r test/test.mjs update-fixtures 2> test/testcases/index.json

.PHONY: test
test:
	cli/xminus -e -r test/test.mjs update-fixtures 2> /tmp/index.json || true
	git --no-pager diff test/testcases/index.json /tmp/index.json

.PHONY: setup
setup:
	git config core.hooksPath etc/githooks
