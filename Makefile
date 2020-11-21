.PHONY: install
install:
	go get github.com/niklasfasching/goheadless/cmd/headless

.PHONY: bench
bench:
	headless run test/bench.mjs
