# 🐉  woorddle

*Team Leafy Sea Dragon Presents:   A Wordle-inspired, word puzzle game with solo & multiplayer modes*



Play in the browser using simple dialogs  (` alert`,  `confirm`,  `prompt` ). Solo runs, custom rules, multiplayer rounds with running leaderboards, scoring breakdowns, and replay menus are all built in.


> **Live demo:**    https://github.com/morrisxelijah/woorddle
> (Replacing later after deploying)

---

## Features

- **Two modes  →**  Solo and Multiplayer (series of games supported)
- **Two rule sets:**
  - **Classic**  **→**  5 letters, 6 guesses, 1 game
  - **Custom**  **→**  choose word length, max guesses, number of games
- **Clear feedback  →**   ✅ correct spot,   🟨 wrong spot,   ⬜️ not in word
- **Scoring**  **→**  Points per letter + bonus for unused guesses; quit penalty mirrors the bonus size
- **Mid-game summaries**  **→**  Per-turn scoring explanation and cycle-by-cycle standings
- **Session/series summaries**  **→**  Best game, best/worst attempt, averages, and cumulative totals across replays
- **No frameworks**  **→**  Minimal HTML/CSS and vanilla JS; runs on GitHub Pages

---

## How to Play

1. **Open the game** (live demo or `index.html` locally)
2. **Welcome prompt  →  Main Menu**
   - Choose **solo** or **multiplayer** (or quit)
   - Choose **classic** or **custom** rules
3. **Guessing**
   - Enter a word of the correct length
   - Feedback emojis show how close you are
   - In multiplayer, turns rotate; finished players’ turns are skipped (with a one-time notice)
4. **End of game / series**
   - Final score and target word + definition are revealed
   - Post-game menu lets you **replay**, **customize**, **change mode**, or **quit**

---

## Scoring

- **Per letter**:
  - ✅ `+2`
  - 🟨 `+1`
  - ⬜️ `-1`
- **Bonus**  **→**   Remaining guesses × word length × `2` (the ✅ value)
- **Quit penalty**  **→**   Same magnitude as the bonus you would have earned, subtracted once

---

## Menu Map (quick reference)

- **Main  menu**  **→**   `solo` | `multiplayer` | `quit`
- **Rules  per  mode**  **→**   `classic` | `custom`
- **Post-game  menu**  **→**   `replay` (same settings) | `custom` (tune settings) | `change game mode` | `quit`

---

## Tech Highlights

- **Recursion** for input validation until a real word is entered (`validateGuess`)
- **Closures** inside multiplayer turn handling (the `takeTurnFor` helper captures config/series index)
- **Higher-order array methods** (`map`, `reduce`, `filter`, `find`, `includes`, `sort`) for scoring and stats
- **Guardrails**  **→**   `safeWordLength` clamps custom sizes to the nearest available in the dictionary.
- **State management** with a single `gameState` object (attempts, remaining guesses, history, cumulative totals)
