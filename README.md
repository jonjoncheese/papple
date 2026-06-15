<img src="src/renderer/papple.png" width="110" align="right" alt="Papple the pixel pineapple">

# Papple

A tiny pixel pineapple that lives in the corner of your screen and quizzes you on your own schoolwork.

Drop your class notes and PDFs into folders, pick an AI, and Papple turns them into a short daily set of quiz questions. It tracks what you keep getting wrong, keeps a streak so you actually come back, and occasionally reminds you to drink water. You can grab him, throw him off the screen, and he'll wait in the tray until you want him back.

It's a desktop app (Electron), it runs locally, and your notes never leave your machine except as prompts to whichever AI you choose.

> _Screenshot / GIF goes here. (Drop a short clip of a quiz + the recap graph.)_

## What it does

- Reads your own notes and PDFs, organized into subject folders ("decks"), and writes questions from them. Empty folder? It falls back to its general knowledge of that subject.
- Mixes multiple-choice and type-your-answer questions, with instant grading, a hint button, and an explanation on every question.
- Tracks your score, daily streak, and the topics you miss most, then leans questions toward your weak spots.
- Endless mode for cram sessions, plus a NotebookLM-style recap at the end showing how each topic went and what to review.
- Lives as a draggable, throwable buddy with a tray icon, hydration reminders, and a dark/light theme.

## How it works

Your decks are just folders inside one sources folder you pick on first launch. For example:

```
PappleSources/
  AP Chem/        <- notes.md, unit-3.pdf ...
  APUSH/
  Algebra 2/
```

Each folder becomes a subject. Papple builds one prompt across your active decks and asks the AI for the whole day's set in a single call, so it's fast and the questions don't repeat (it remembers what you've already seen).

## Pick your AI

Papple is provider-agnostic. Set this in Settings:

- **Gemini API key** — free tier, fast. Good default if you don't mind grabbing a key.
- **Claude login (claude-code)** — no key needed, free, but slower to start.
- **OpenAI API key** — fast, paid per use.
- **Claude API key** — fast, paid per use.

You bring your own key (or login). Nothing is hardcoded.

## Run it

Papple isn't packaged into an installer yet, so for now you run it from source. You'll need Node 24+.

```bash
git clone https://github.com/jonjoncheese/papple.git
cd papple
npm install
npm start
```

First launch walks you through picking your sources folder and your AI.

## Tests

```bash
npm test
```

Around 96 tests covering the core logic (question generation, grading, streaks, scheduling, providers). The whole `src/core/` library is pure and Electron-free, so it's all testable without launching the app.

## Privacy

Your settings and progress live in a local JSON file (`%APPDATA%/papple` on Windows). Your notes stay on disk. The only thing that goes out is the text Papple sends to the AI you picked, using your own key or login.

## License

[AGPL-3.0](LICENSE). Free to use and modify. If you run a modified version for others, you have to share your changes.

## Status

Early and built solo. I use it daily for my own classes. Feedback and issues welcome.
