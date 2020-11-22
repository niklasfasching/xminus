.PHONY: install
install:
	go get github.com/niklasfasching/goheadless/cmd/headless

.PHONY: bench
bench:
	headless run test/bench.mjs

.PHONY: update-fixtures
update-fixtures:
	headless run test/test.mjs update-fixtures 2> test/testcases/index.json

.PHONY: test
test:
	headless run test/test.mjs update-fixtures 2> /tmp/index.json || true
	git --no-pager diff /tmp/index.json test/testcases/index.json
