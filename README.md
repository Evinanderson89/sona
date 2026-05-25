# Sona

A speaking coach that helps you describe videos more evocatively.

You paste a YouTube link. Sona pulls the transcript and asks Claude to write four model descriptions in different styles (funny, interesting, vivid, warm). Then you record yourself describing the same clip. Sona scores you on vividness, warmth, and engagement, suggests a rewrite in your voice, and journals the take so you can hear yourself improve.

There's also an Improv mode that throws a curveball constraint at you ("no adjectives", "as if whispering a secret", "three sentences, each shorter than the last"), so you stretch.

Ships as one Expo app for **iOS, Android, and web** plus a tiny Hono backend that holds your Anthropic key.

## Repo layout

```
Sona/
├── apps/
│   ├── api/           # Hono backend — proxies Anthropic
│   └── mobile/        # Expo (React Native + Expo Router) — iOS/Android/Web
├── packages/
│   └── shared/        # Types, prompts, scoring, YouTube helpers
└── package.json       # npm workspace root
```

## One-time setup

```bash
cd ~/Documents/Sona
npm install
cp .env.example apps/api/.env
# Edit apps/api/.env and paste your Anthropic key
```

## Run it

In one terminal, start the API:

```bash
npm run api
# → Sona API listening on http://localhost:8787
```

In another, run the mobile app:

```bash
# Web (fastest to iterate)
npm run web

# iOS Simulator (requires Xcode)
npm run ios

# Android emulator
npm run android

# Or scan the QR with Expo Go on your phone
npm run mobile
```

**On a physical phone:** Expo will auto-detect your Mac's LAN IP and point the app at `http://<lan-ip>:8787`. If that fails, set `EXPO_PUBLIC_API_URL=http://<your-mac-ip>:8787` in `apps/mobile/.env` before running.

## Notes on speech-to-text

- **Web:** uses the browser's built-in Web Speech API. Works in Chrome and Safari, no extra setup.
- **iOS / Android:** the app records audio with `expo-av`, but on-device transcription is wired as a placeholder — after stopping, you can type or paste what you said. Adding native STT (`expo-speech-recognition` or `@react-native-voice/voice`) requires an EAS build, which is a follow-up step beyond Expo Go.

This split keeps the web build instantly usable while the mobile build needs one more layer of native integration.

## Building for the App Store / Play Store

You'll need an Expo account and EAS CLI:

```bash
npm i -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

The `app.json` already has the bundle identifiers and required permission strings.

## Costs

Each "Score me" tap is one Claude Sonnet 4.6 call (≈1–2k tokens in, ≈800 tokens out). Each "Analyze video" is similar. Improv rerolls are tiny (<400 tokens). Budget pennies per session.

## What's intentionally local

- The journal lives in `AsyncStorage` per device. Nothing leaves your machine except the prompts that go to Claude and the YouTube transcript fetch.
- The Anthropic key sits in `apps/api/.env`, never in the mobile bundle.

## License

MIT (do whatever you like).
