# HANDOFF — Papple (next agent)

Written 2026-07-28 after the overnight "FINISH IT" ship run. Read this before the vault wiki — older wiki pages were badly stale and were rewritten the same night.

## What shipped

| Item | Where |
|---|---|
| Windows NSIS + portable | https://github.com/jonjoncheese/papple/releases/tag/v1.1.0 |
| Public repo + description + topics | `jonjoncheese/papple` |
| CI Test (push/PR) | `.github/workflows/test.yml` — green |
| CI Release (tag `v*`) | `.github/workflows/release.yml` — green on v1.0.0 + v1.1.0 |
| No-key prompt-handoff (5th provider) | `src/core/providers/prompt-handoff.js` + `src/main/prompt-handoff.js` |
| Tests | **108** pass (`npm test`) — was 96 at session start |

Commits (order): `254c378` package → `27078ce` 1.0.0 docs → `785e7e6` CI → `33baaed` handoff → `1775fbf` 1.1.0 polish.

## Packaging gotchas (will bite you again)

1. **`pdf-parse` under asar** — index.js crashes without `module.parent`. Require `pdf-parse/lib/pdf-parse.js`. Keep `asarUnpack` for `**/node_modules/pdf-parse/**`. Fallback paths live in `src/main/pdf.js`. A green `npm start` does **not** prove packaged PDF parse.
2. **Verify for real:** `npm run dist` then `npm run verify:packaged`. Pass = launches exe, parses PDF from `app.asar.unpacked`, generates questions (seed uses `claude-code` — needs CLI on PATH).
3. **Unsigned** — `Get-AuthenticodeSignature` = `NotSigned`. SmartScreen warns. Do not buy a cert unless chica asks. README already says this.
4. **Default sources when packaged:** `Documents/PappleSources` (may be OneDrive-backed). Dev still uses repo `papple-sources/`.
5. **`gh` CLI** — full path `C:\Program Files\GitHub CLI\gh.exe` (not always on PATH).
6. **electron-builder** logs "signing with signtool.exe" even when the file is NotSigned — ignore the wording; check Authenticode.

## Core law (do not break)

`src/core/` stays Electron-free. Network + PDF + clipboard/shell are injected at the main boundary. That's why the unit suite works.

## What's left (parked — not blockers for "downloadable app")

- **macOS / Linux builds** — Windows only tonight.
- **Code signing / SmartScreen reputation** — needs paid cert or enough downloads over time.
- **Auto-update** — `latest.yml` appears in release artifacts from electron-builder; app does **not** wire `electron-updater` yet.
- **Handoff UX polish** — works; could add "prompt length" meter, remember last paste site better, friendlier parse errors using `personality.handoffBad`.
- **Showcase / social** — chica's call. Do not post.
- **Codex OSS application** — `second brain/projects/papple/codex-open-source-application.md` updated (README claim fixed). Still needs his OpenAI Org ID; **he** submits.
- **Monetization** — freemium is intent only. No payments/license/backend.

## Single next thing

Use the **v1.1.0 installer yourself** once: onboarding → pick No-key handoff → Generate → paste a real ChatGPT/Claude/Gemini reply → confirm a quiz round. That's the student path the public release is for.

## Quick commands

```bash
cd C:\Users\chica\papple
npm test
npm start
npm run dist
npm run verify:packaged
```
