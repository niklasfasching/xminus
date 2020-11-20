.PHONY: test
test:
	headless run test/index.mjs

.PHONY: install
install:
	go get github.com/niklasfasching/goheadless/cmd/headless
