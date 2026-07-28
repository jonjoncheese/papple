# Changelog

All notable changes to Papple are documented here.

## [1.0.0] — 2026-07-28

First downloadable Windows release.

### Added
- Windows **NSIS installer** (`Papple-*-Setup.exe`) and **portable** exe via electron-builder
- App icon built from the pixel papple sprite (`build/icon.ico`)
- Packaged default sources folder: `Documents/PappleSources` (writable outside the asar)
- `scripts/verify-packaged.mjs` — launches the built app, parses a real PDF via asar-unpacked `pdf-parse`, and generates a question set end-to-end

### Notes
- Builds are **not code-signed**. Windows SmartScreen / Defender will likely warn on first run — choose "More info" → "Run anyway". A paid signing certificate was deliberately not purchased for this release.
- `pdf-parse` is unpacked from the asar (`asarUnpack`) because the package index crashes without `module.parent`; the app requires the inner `pdf-parse/lib/pdf-parse.js` module.

### Previously shipped (pre-1.0, in-repo)
- Claymorphism UI, dark/light theme, onboarding flow, end-of-set recap
- Pixel sprites (papple / wave / blink / sleep / drink), draggable + throwable buddy + tray
- Hydration reminders, PDF parsing wired into deck loading
- Providers: Gemini, Claude Code, OpenAI, Claude API
- Core library Electron-free and unit-tested (~100 tests at 1.0.0)

## [0.1.0] — 2026-06-15

Development builds only (`npm start`). Public repo, AGPL-3.0, README + demo GIF.
