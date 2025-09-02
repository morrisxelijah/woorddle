/*  =========================================================
        🐉  Team Leafy  Sea  Dragon's  word  puzzle  game
    =========================================================

    ✦ inspried by  -->  NYT's Wordle
    ✦ purpose  -->  group project from class made into it's own, public repo so ppl outside the org can view/play
    ✦ design style
        • objects say what (OOP-like)  -->  data that belongs together is grouped into plain objects (e.g. config and gameState)
        • functions say how (FP-like)  -->  helpers do 1 main thing  (read an input, calculate, and return an output) and keep things organized

    ✦ how to play  -->  guess the secret word in limited tries (guess attempts)
    ✦ scoring  -->  emojis show letter accuracy per position
        • values / emojis pulled from config dynamically
        • bonus  =  remainingGuessAttempts  *  wordLength  *  pointsForCorrectLetter  (when a player guesses their secret before they run out of allowed attempts)
        • quit penalty  -->  same calc as bonus but negative (subtract from total points)

    ✦ key features
        • simple UI  -->  played using dialogs only (prompt/confirm/alert)
        • solo mode  or  multiplayer mode  -->  both have optional, custom team/player names
        • rules  -->  classic (5 letters, 6 guesses)  or  custom (length/guesses/rounds)
        • 'live' guess feedback with emoji scorecards under guesses  -->  incl. current player's guess history for this secret word (hints)
        • game session/series summaries and leaderboards (cumulative across replays)

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */



"use strict";    // turn on safer defaults  -->  blocks silent mistakes ; makes demo more predictable



/*  =========================================================
        CONFIGURATION  &  STATE
    ========================================================= */

/* ---------------- CONFIG (dynamic legend & points pulled from here) ---------------- */
// optionally tweaked live by game modes and read by display methods for dynamic UI experience
const config = {
    wordLength: 5,    // classic baseline length  -->  safely changed with custom rules
    emojis: { correct: "✅", almost: "🟨", incorrect: "⬜️" },    // central icon map  ;  can be changed later for an even more custom game (maybe stretch feature)
    maxGuesses: 6,    // classic baseline guesses  ;  used to help determine remaining, bonuses, and penalties
    pointsValue: { correct: 2, almost: 1, incorrect: -1 },    // scoring map to avoid hardcoding in messages  ;  can be changed later for an even more custom game (maybe stretch feature)
};

/* --------------- SHARED STATE (solo + multiplayer) --------------- */
// records the what is happening right now across current game modes and for replays
const gameState = {
    targetWord: "",    // used by scoring/reveals  -->  {word, definition} goes here when a game starts
    attempts: [],    // rows of [guessWord, [emojiRow]]  ;  printed by displayGuess
    status: "playing",    // drives gameflow in while loops  -->  "playing" | "won" | "lost" | "quit"
    remaining: config.maxGuesses,    // allowed attempts countdown per game  ;  also used for bonus math
    history: [],    // already used words from dictionary (global list)  ;  reduces repeats across games and players
    sessionScores: [],    // solo series totals per finished game  ;  summarized after 2+ games
    playerNames: [],    // makes leaderboards/game stats displays easy  ->  for solo → [name] or []  ;  for multi → ["Team7","Eli",...]
    lastGameMode: undefined,    // "solo" | "multi"  ;  helps replay to the same game mode
    lastRounds: undefined,    // series length  -->  used by menus/replay
    lastMultiplayerSetup: undefined,    // saved multi config for quick replays  ;  holds player names/count and game rules
    multiAllTotals: undefined,    // cumulative multi stats across replays (built when needed)  ;  helps when creating the “ALL GAMES” stats/learboard
};



