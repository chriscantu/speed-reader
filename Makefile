.PHONY: test-js test-swift test-all

test-js:
	node --test tests/js/

test-swift:
	xcodebuild test \
		-project SpeedReader/SpeedReader.xcodeproj \
		-scheme SpeedReader \
		-destination 'platform=macOS' \
		-quiet

test-all: test-js test-swift
