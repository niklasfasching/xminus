.PHONY: install
install:
	go get github.com/niklasfasching/goheadless/cmd/headless

.PHONY: bench
bench:
	headless run test/bench.mjs

.PHONY: update-fixtures
update-fixtures:
	headless run test/test.mjs update-fixtures 2> test/testcases/index.json
