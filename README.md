# SpeedReader

**Reading shouldn't be this hard.**

For millions of neurodivergent readers — people with ADHD, dyslexia, or other processing differences — traditional reading is exhausting. Eyes jump between lines, focus drifts mid-paragraph, and articles get abandoned halfway through. Many default to audiobooks or skip written content entirely.

RSVP (Rapid Serial Visual Presentation) changes that. By showing one word at a time at a controlled pace, it removes the cognitive overhead of eye tracking and line scanning. Your brain just... processes. It's an accessibility bridge that's been locked behind paywalls and unreliable tools — until now.

**SpeedReader is a free, open-source Safari extension that brings RSVP reading to every web page on iPhone, iPad, and Mac.**

<!-- TODO: Replace with actual screenshot
![SpeedReader in action](assets/hero-screenshot.png)
-->

## How It Works

1. Navigate to any article or web page in Safari
2. Tap the SpeedReader icon in the toolbar
3. The article text is extracted automatically
4. Words appear one at a time with a highlighted focus point
5. Read at your pace — tap anywhere to pause, tap again to resume

That's it. No accounts, no subscriptions, no tracking.

## Features

- **Focus-point highlighting** — Each word highlights its optimal recognition point (the letter your eye naturally anchors to), reducing the effort of finding where to look
- **Context preview** — When you pause, see the surrounding sentence so you can re-orient quickly (especially helpful for ADHD readers who lose their place)
- **Punctuation pacing** — Periods and commas add natural micro-pauses, so content flows like speech rather than a strobe light
- **Speed control** — Adjustable from 100 to 600 words per minute with a simple slider
- **OpenDyslexic font** — Toggle the dyslexia-friendly font with one tap
- **Light and dark mode** — Follows your system theme automatically, or override manually
- **Keyboard shortcuts** — On Mac and iPad with keyboard: Space to play/pause, arrows to navigate, Esc to close
- **Text selection fallback** — If automatic extraction doesn't work, select any text on the page and activate SpeedReader on just that selection
- **Works offline** — Everything runs locally in Safari. No data leaves your device.

<!-- TODO: Replace with actual screenshots
### iPhone
![iPhone screenshot](assets/screenshot-iphone.png)

### iPad
![iPad screenshot](assets/screenshot-ipad.png)

### Mac
![Mac screenshot](assets/screenshot-mac.png)
-->

## Install

### App Store (recommended)

<!-- TODO: Replace with actual App Store link -->
[Download on the App Store](#)

After installing, enable the extension:
1. Open **Settings > Apps > Safari > Extensions** (iOS/iPadOS) or **Safari > Settings > Extensions** (Mac)
2. Turn on **SpeedReader**
3. Set permissions to **Allow** for all websites (or choose specific sites)

### Build from Source

If you prefer to build it yourself, see the [Contributing Guide](CONTRIBUTING.md) for setup instructions.

## Controls

| Action | iPhone / iPad | iPad + Keyboard | Mac |
|--------|---------------|-----------------|-----|
| Play / Pause | Tap anywhere on overlay | Space | Space |
| Previous sentence | Tap **⏮** | **←** | **←** |
| Next sentence | Tap **⏭** | **→** | **→** |
| Adjust speed | Drag slider | **↑ / ↓** | **↑ / ↓** |
| Close | Tap **✕** | **Esc** | **Esc** |

## Settings

| Setting | Default | Options |
|---------|---------|---------|
| Words per minute | 250 | 100–600 |
| Font | System (San Francisco) | System, OpenDyslexic |
| Theme | System | Light, Dark, System |
| Punctuation pausing | On | On, Off |

Settings sync between the companion app and the extension automatically.

## Platform Support

| Platform | Minimum Version |
|----------|----------------|
| iPhone | iOS 17+ |
| iPad | iPadOS 17+ |
| Mac | macOS 14 (Sonoma)+ |

## Roadmap

See [ROADMAP.md](ROADMAP.md) for what's planned — including a progress scrubber, reading position memory, font customization, and more.

## Contributing

SpeedReader is open source and contributions are welcome. See the [Contributing Guide](CONTRIBUTING.md) for development setup, project structure, and how to submit changes.

## License

[MIT](LICENSE) — free to use, modify, and distribute.

## Why This Exists

This project was born out of personal need. As someone with ADHD and suspected dyslexia, I find traditional reading genuinely tiring. RSVP reading works for my brain in a way that paragraphs of text don't. The tools that existed were either paid, unreliable, or both. Simple technology like this shouldn't be behind a paywall.

If SpeedReader helps you read more easily, that's the whole point.
