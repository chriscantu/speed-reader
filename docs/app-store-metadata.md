# App Store Connect Metadata

**App Store Name:** SpeedReader - RSVP Reader

Drafts for App Store submission. Reference: [#40](https://github.com/chriscantu/speed-reader/issues/40)

## Category

Utilities (primary), Productivity (secondary)

## App Description

Reading shouldn't be this hard.

SpeedReader is a free Safari extension that lets you speed read any web page using RSVP (Rapid Serial Visual Presentation) — showing one word at a time at a controlled pace.

For neurodivergent readers — people with ADHD, dyslexia, or other processing differences — traditional reading is exhausting. Eyes jump between lines, focus drifts mid-paragraph, and articles get abandoned halfway through. RSVP removes the cognitive overhead of eye tracking and line scanning, so your brain just processes.

**How it works**
Tap the SpeedReader icon in Safari's toolbar. The article text is extracted automatically and words appear one at a time with a highlighted focus point. Tap anywhere to pause, tap again to resume. That's it.

**Features**
• Focus-point highlighting — each word highlights its optimal recognition point, the letter your eye naturally anchors to
• Context preview — pause and see the surrounding sentence to re-orient quickly
• Punctuation pacing — periods and commas add natural micro-pauses so content flows like speech
• Speed control — 100 to 600 words per minute
• OpenDyslexic font — toggle the dyslexia-friendly font with one tap
• Light and dark mode — follows your system theme or override manually
• Keyboard shortcuts — on Mac and iPad: Space to play/pause, arrows to navigate
• Text selection fallback — select any text on a page and speed read just that
• Works entirely offline — no data leaves your device

No accounts. No subscriptions. No tracking. Free and open source.

## Keywords

```
speed reading,RSVP,ADHD,dyslexia,accessibility,safari extension,read faster,focus,web reader
```

(96 / 100 characters)

## App Review Notes

SpeedReader is a Safari Web Extension. To test it:

1. After installing, go to Settings > Apps > Safari > Extensions (iOS/iPadOS) or Safari > Settings > Extensions (Mac)
2. Enable "SpeedReader" and set website access to "All Websites"
3. Open any article in Safari (e.g., https://en.wikipedia.org/wiki/Speed_reading)
4. Tap the puzzle piece icon in Safari's toolbar, then tap SpeedReader
5. The RSVP overlay will appear and begin playing automatically
6. Tap anywhere on the overlay to pause/resume. Use the controls to adjust speed, font, and theme.

The companion app provides onboarding instructions and a settings screen. The core functionality is the Safari extension.

## Support URL

<https://github.com/chriscantu/speed-reader>

## Privacy Policy URL

Host on GitHub Wiki: `https://github.com/chriscantu/speed-reader/wiki/Privacy`

Content drafted in `docs/Privacy-Policy.md` — copy to wiki after initializing it:

1. Go to <https://github.com/chriscantu/speed-reader/wiki>
2. Click "Create the first page"
3. Title it "Privacy Policy"
4. Paste the content from `docs/Privacy-Policy.md`

## Screenshots

Use `scripts/capture-screenshots.sh` to launch simulators with a test article.
Required sizes: iPhone 6.7", iPhone 6.1", iPad 13".

## Age Rating

Expected answers for the App Store Connect questionnaire:

- Cartoon or Fantasy Violence: None
- Realistic Violence: None
- Prolonged Graphic or Sadistic Realistic Violence: None
- Profanity or Crude Humor: None
- Mature/Suggestive Themes: None
- Horror/Fear Themes: None
- Medical/Treatment Information: None
- Simulated Gambling: None
- Sexual Content or Nudity: None
- Unrestricted Web Access: **Yes** (it's a Safari extension that runs on any web page)
- Alcohol, Tobacco, or Drug Use: None
- Gambling with Real Currency: None

This should result in a **12+** rating due to unrestricted web access.
