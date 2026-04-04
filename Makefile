.PHONY: test-js test-swift test-all lint-js lint-swift lint-all ci test-regression

test-js:
	node --test tests/js/*.test.js

test-swift:
	xcodebuild test \
		-project SpeedReader/SpeedReader.xcodeproj \
		-scheme SpeedReader \
		-destination 'platform=macOS' \
		-quiet

test-all: test-js test-swift

lint-js:
	npx eslint .

lint-swift:
	swiftlint --strict

lint-all: lint-js lint-swift

ci: lint-all test-all

test-regression:
	node --test tests/regression/*.test.js
