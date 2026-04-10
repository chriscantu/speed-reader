.PHONY: test-js test-bun test-swift test-all lint-js lint-swift lint-all ci test-regression

test-js:
	node --test tests/js/*.test.js

test-bun:
	bun test tests/bun/*.test.js

test-swift:
	xcodebuild test \
		-project SpeedReader/SpeedReader.xcodeproj \
		-scheme SpeedReader \
		-destination 'platform=macOS' \
		-quiet

test-all: test-js test-bun test-swift

lint-js:
	npx eslint .

lint-swift:
	swiftlint --strict

lint-all: lint-js lint-swift

ci: lint-all test-all

test-regression:
	node --test --test-concurrency=1 tests/regression/*.test.js
