/*  =========================================================
        🐉  TEAM Leafy  Sea  Dragons'  word  puzzle  game
    =========================================================

        ✦ inspired by  -->  NYT's Wordle
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
            • guess feedback with emoji scorecards under guesses  -->  incl. current player's guess history for this secret word (hints)
            • game session/series summaries and leaderboards (cumulative across replays)

    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */




/*  =============================================================================
        HELPERS  --  EMBED / PORTFOLIO  MODE  -->  runs dialogs inside iframe
    =============================================================================
        ✦ goal  -->  keep original logic + messages  but render UI inside the iframe (no full-tab, blocking browser dialogs)
        ✦ pattern  -->  async dialog layer that mirrors  alert / confirm / prompt  with Promises
            • falls back to native dialogs when not in embed mode
            • driven by  <div id="ui-modal">  markup in index.html
            • focus behavior + ESC to cancel
*/


/* ---------------- querystring reader (tiny, safe helper) ----------------
    pulls named parameter from  window.location.search  and returns string or null
*/
function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);    // tiny API for query parsing
  return params.get(name);    // null if missing
}

/* ---------------- environment switch (single flag) ----------------
    isEmbed  -->  true when  ?ui=embed  so we render dialogs inside this iframe
*/
const ENV = {
    // embed if ?ui=embed  OR  if the game's inside an iframe
    isEmbed: (getQueryParam("ui") === "embed") || (window.self !== window.top),    // boolean switch used by the dialog layer + startup behavior
};

/* ---------------- DOM shortcuts ---------------- */
const $ = (sel) => document.querySelector(sel);    // 1 selector, used sparingly below
const logEl = $("#log");    // optional console-like area in the page
function log(line) {    // helper for demo / debugging
  if (logEl) { logEl.hidden = false; logEl.textContent += String(line) + "\n"; }
}

/* ---------------- in-iframe dialog layer (async, Promise-based) ----------------
   mirrors browser dialogs (same 'shape') so the rest of the game can stay the same
        ask.alert(text)            --> Promise<void>
        ask.confirm(text)          --> Promise<boolean>
        ask.prompt(text, default)  --> Promise<string|null>
   note: returns *native* dialogs when not in embed mode (keeps classic UX intact)
*/
const ask = (() => {
    /* ---------- non-embed fallback  -->  original blocking dialogs (same behavior) ---------- */
    if (!ENV.isEmbed) {
        return {
            alert: async (msg) => { window.alert(msg); },    // same signature as our async version
            confirm: async (msg) => { return window.confirm(msg); },    // resolves to boolean
            prompt: async (msg, defVal = "") => { return window.prompt(msg, defVal); },  // resolves to string or null
        };
    }

    /* ---------- embed path  -->  wires up the reusable modal elements ---------- */
    const modal     = $("#ui-modal");    // root overlay container (hidden=true by default)
    const titleEl   = $("#ui-modal-title");    // small title line (changes with mode)
    const msgEl     = $("#ui-modal-msg");    // multi-line text area for messages
    const formEl    = $("#ui-modal-form");    // wraps input + buttons (so Enter submits)
    const inputEl   = $("#ui-modal-input");    // text input used only by prompt()
    const okBtn     = $("#ui-modal-ok");    // primary action button (OK / Continue)
    const cancelBtn = $("#ui-modal-cancel");    // secondary action button (Cancel)

    // guard  -->  if any element is missing, gracefully fall back to native dialogs
    if (!modal || !titleEl || !msgEl || !formEl || !inputEl || !okBtn || !cancelBtn) {
        return {
            alert: async (msg) => { window.alert(msg); },
            confirm: async (msg) => { return window.confirm(msg); },
            prompt: async (msg, defVal = "") => { return window.prompt(msg, defVal); },
        };
    }

    // internal, per-open state  -->  kept tiny and reset on close
    let currentResolver = null;    // resolves the current dialog's Promise
    let currentMode = "alert";    // "alert" | "confirm" | "prompt"
    let keyHandler = null;    // reference for ESC handler so we can remove it on close

    /* ---------- show modal with a specific mode + text (and optional default) ---------- */
    function open(type, message, defVal = "") {
        currentMode = type;    // remember what UX to show
        titleEl.textContent = (
        type === "alert"   ? "Notice" :
        type === "confirm" ? "Please Confirm" :
                            "Enter a value"
        );
        msgEl.textContent = message || "";    // clear vs undefined friendliness
        inputEl.value = defVal || "";    // applies only to prompt()

        // toggle visible controls by mode (keeps one modal, no conditional DOM inserts)
        inputEl.style.display   = (type === "prompt") ? "block" : "none";
        cancelBtn.style.display = (type !== "alert")  ? "inline-flex" : "none";

        // reveal + focus management
        modal.hidden = false;    // display modal overlay
        setTimeout(() => {    // wait a tick so element is focusable
        if (type === "prompt") inputEl.focus(); else okBtn.focus();
        }, 0);

        // minimal key support  -->  ESC cancels (matches browser dialogs muscle memory)
        keyHandler = (e) => {
        if (e.key === "Escape") { e.preventDefault(); doCancel(); }
        };
        document.addEventListener("keydown", keyHandler);
    }

    /* ---------- hide modal and clean up listeners / transient state ---------- */
    function close() {
        modal.hidden = true;    // hide overlay
        document.removeEventListener("keydown", keyHandler);    // remove ESC handler
        keyHandler = null;    // release reference
    }

    /* ---------- resolve helper (single exit for success paths) ---------- */
    function resolveNow(value) {
        if (currentResolver) currentResolver(value);    // release the awaiting Promise
        currentResolver = null;    // reset
    }

    /* ---------- user chose 'Cancel' or ESC ---------- */
    function doCancel() {
        // shape aligns with browser dialogs:
        //   prompt → null, confirm → false, alert → undefined
        if (currentMode === "prompt") resolveNow(null);
        else if (currentMode === "confirm") resolveNow(false);
        else resolveNow(undefined);
        close();
    }

    /* ---------- user chose 'OK' (Enter or button) ---------- */
    function doOk() {
        // shape aligns with browser dialogs:
        //   prompt → string, confirm → true, alert → undefined
        if (currentMode === "prompt") resolveNow(String(inputEl.value).trim());
        else if (currentMode === "confirm") resolveNow(true);
        else resolveNow(undefined);
        close();
    }

    /* ---------- wire UI events (submit / buttons) ---------- */
    formEl.addEventListener("submit", (e) => { e.preventDefault(); doOk(); });  // Enter submits safely
    cancelBtn.addEventListener("click", doCancel);    // Cancel click → cancel path
    okBtn.addEventListener("click", doOk);    // OK click → ok path

    /* ---------- public API (async) ---------- */
    return {
        alert:  (text)    => new Promise((resolve) => { currentResolver = resolve; open("alert",   text);           }),
        confirm:  (text)    => new Promise((resolve) => { currentResolver = resolve; open("confirm", text);           }),
        prompt:  (text, defVal = "")  => new Promise((resolve) => { currentResolver = resolve; open("prompt",  text, defVal);  }),
    };
})();




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

/* --------------- CLASSIC GAME CONFIGS --------------- */
// kept sepeately for going back to defaults after custom games  ;  reused in prompts (messages / dialogs)
const classicDefaults = { wordLength: 5, maxGuesses: 6, gameRounds: 1 };




/*  =============================================================
        MESSAGES  -->  all dialogs live here (static + dynamic)
    =============================================================
        ✦ define all user-facing text/displays (no hardcoded values)
        ✦ plain strings for fixed phrases  ;  small methods for places that use the 'live' config/state
    -------------------------------------------------------------
*/
const messages = {
    /* ---------------- fixed snippets ---------------- */
    welcome: "Welcome  ‼️  \n\nWould you like to play a word puzzle game ?",
    startOver: "We would love for you to play again another time  🤗",
    endGame: "Are you sure?\n\n    I bet you had a change of heart...  😉 \n\n( CANCEL / ESC ends the game  👀)",
    endLast: "              💔\nSo sad to see you leave...  \nI guess you're not that fun after all.  \n\n...game window closing... \n          😂",
    needMorePlayers: "Requires at least 2 players !",

    /* ----------------  menus  ----------------
        phase options  -->  "mode" | "rules" | "post"
            - "mode"  -->  choose solo / multiplayer / quit
            - "rules"  -->  shows classic vs custom for a specific mode (modeName is printed)
            - "post"  -->  replay / custom / change mode / quit
    */
    menuText(phaseName, modeNameOrNull) {
        if (phaseName === "mode") {    // main (pre-game) menu  -->  user picks a game mode
            return (
                "Choose a game mode:\n\n" +
                "      - solo\n" +
                "      - multiplayer\n" +
                "      - quit\n"
            );
        }
        if (phaseName === "rules") {    // rules for a chosen mode   ( shows the active mode label )
            const modeLabel = (modeNameOrNull || "solo").toString().trim().toUpperCase();    // cleans whitespace and emphasizes the chosen game mode
            return (
                `Choose the rules for  ${modeLabel}  mode:\n\n` +
                `    - classic  ( ${classicDefaults.wordLength} letters,  ${classicDefaults.maxGuesses} guesses,  ${classicDefaults.gameRounds} game )\n` +
                `    - custom   ( choose wordLength,  maxGuesses,  gameRounds )\n`
            );
        }
        // "post"  -->  after one game or a series  ;  user picks next steps
        return (
            "POST-GAME MENU\n\n" +
            "Enter one of these options:\n" +
            "    - replay  -->  same mode + configs\n" +
            "    - custom  -->  same mode, change configs\n" +
            "    - change game mode\n" +
            "    - quit\n"
        );
    },

    /* ---------------- rules  (dynamic  -->  no hardcoding) ----------------
        explains emojis meaning + scoring using live config  -->  stretch goal where custom icons/points system propagates everywhere
    */
    rulesInfo() {
        return (
            `Each player has  ${config.maxGuesses}  tries to guess the hidden  ${config.wordLength}-letter word.  ` +
            `After each guess, the emojis below show how accurate the guess letters are:\n\n` +
            `       ${config.emojis.correct}  ( + ${config.pointsValue.correct} )   -->    right letter in the right spot\n` +
            `       ${config.emojis.almost}  ( + ${config.pointsValue.almost} )    -->    right letter in the wrong spot\n` +
            `       ${config.emojis.incorrect}  ( ${config.pointsValue.incorrect} )    -->    letter not in the word\n\n` +
            `bonus           =    remainingAttempts   *   wordLength ( ${config.wordLength} )   *   correctPoints ( ${config.pointsValue.correct} )\n` +
            `quit penalty    =    remainingAttempts   *   wordLength ( ${config.wordLength} )   *   correctPoints ( ${config.pointsValue.correct} )`
        );
    },

    /* ---------------- getter prompts ----------------
        promptGuess  -->  shared by solo and multi ; if a name is present, it is added to the display header for the current player's turn
        promptEntry  -->  get custom game config values (incl. examples)
        promptGroup  -->  setup players count/names
    */
    promptGuess(playerNameOrNull, boardTextOrEmpty) {
        if (playerNameOrNull) {    // for multiplayer/named solo player  -->  put their name + board in one dialog
            return `${playerNameOrNull}  -->  Guess a word:\n\n${boardTextOrEmpty || ""}`;
        }
        return `Guess a word.\n\n${boardTextOrEmpty || ""}`;    // for solo  ->  board is optional when empty (start of game)
    },
    promptEntryCustomConfig() {
        return "Enter three values  ( wordLength,  maxGuesses,  gameRounds )\n      Example:  5, 6, 3   or   5 6 3 \n";
    },
    promptGroupSetup(modeName, expectedCountOrNull) {
        if (modeName === "solo") {    // optional name for solo  -->  gets stored in the playerNames array
            return "Optional  -->  enter a player name if desired  ( or skip customization and leave blank )\n";
        }
        if (typeof expectedCountOrNull === "number") {    // naming propmt after getting player count  -->  supports names that include numbers (like a team name)
            return `Enter  ${expectedCountOrNull}  names  (comma or space separated).  Numbers are OK.\n      Example:    Rose,  Team7,  Kai,  3Musketeers,  Amen\n`;
        }
        return "How many players?    (ex:  2 - 6 recommended)\n\nType 'yes' after the number (player count) to add custom names in the next dialog.\n      Example:    3  yes\n";    // first multiplayer prompt
    },

    /* ---------------- guess validation messages ----------------
       reason for reprompt  ->  "length" | "unknown"
    */
    invalidGuess(reasonName, info) {
        if (reasonName === "length") {    // print reason inputLen + neededLen + boardText  -->  input is invalid because the length does not match the exact secret game word length (defined in config)
            return (
                `That entry is not the right length.\n` +
                `Enter exactly ${info.neededLen} characters  ( non letters/numbers are cleaned out ).\n\n` +
                (info.boardText || "")
            );
        }
        // otherwise print reason is an "unknown" word (not in the dictionary being played)
        return (
            `That looks like a word of the right length, but it is not in this game's dictionary.\n` +
            `Try another word.\n\n` +
            (info.boardText || "")
        );
    },

    /* ---------------- round end text ----------------
       based on game status on exit  -->  "won" | "lost" | "quit"
    */
    outcomeText(statusName, info) {
        if (statusName === "won") {    // shows attempts used  (from gameplay counter)
            return `Victory !    Solved in  ${info.guessesUsed}  attempt(s).`;
        }
        if (statusName === "lost") {    // takes current game's maxGuesses  (avoid incorrect hardcode from classic setup)
            return `So close !    All  ${config.maxGuesses}  attempts were used.`;
        }
        return "Exit noted  ❌";    // quit
    },

    /* ---------------- shared fragments & titles ---------------- */
    legendLine() {
        return `Legend:\n    correct  =  ${config.emojis.correct}  ( + ${config.pointsValue.correct} )   ` +
               `almost  =  ${config.emojis.almost}  ( + ${config.pointsValue.almost} )   ` +
               `incorrect  =  ${config.emojis.incorrect}  ( ${config.pointsValue.incorrect} )`;
    },
    answersTitle(gameIndexNumber) {
        return `GAME  ${gameIndexNumber}  -->  Answers  +  Definitions\n\n`;
    },
    standingsTitle(gameIndexNumber, guessCycleCountNumber) {
        return `STANDINGS  -->  GAME  ${gameIndexNumber}   --   Guess  ${guessCycleCountNumber}\n\n`;
    },
    seriesTitle(roundCountNumber) {
        return `SERIES COMPLETE  —  ${roundCountNumber}  game(s)\n\n`;
    },
    cumulativeTitle() {
        return "ALL GAMES  -->  Cumulative  Leaderboard:\n\n";
    },

    /* ---------------- dynamic per-turn summary / stat explaination ---------------- */
    roundExplain(
        displayName, roundNow, roundsTotalAll, guessWordNow, emojiRowNow, pointsNow,
        correctCount, almostCount, wrongCount, runningTotalNoBonus, gameIndexOrNull,
        bonusThisTurn, bonusLockedSoFar, runningAllOrNull, seriesBonusSoFar
    ) {
        const gamePrefix = (typeof gameIndexOrNull === "number") ? `Game  ${gameIndexOrNull}  -->  ` : "";    // adds game label for a series
        return (
            `${gamePrefix}${displayName}   -->   Attempt  ${roundNow}  of  ${roundsTotalAll}\n\n` +
            `Guess:  ${guessWordNow.toUpperCase()}   -->   ${emojiRowNow.join(" ")}\n` +
            `\nScore:  + ${pointsNow}  pts` +
            (bonusThisTurn > 0 ? `\nBonus:  + ${bonusThisTurn}  pts` : "") +
            `\n      ( ${config.emojis.correct}:  ${correctCount} × ${config.pointsValue.correct},    ` +
            `${config.emojis.almost}:  ${almostCount} × ${config.pointsValue.almost},    ` +
            `${config.emojis.incorrect}:  ${wrongCount} × ${config.pointsValue.incorrect} )\n` +
            `\nTotal  (this game):    ${runningTotalNoBonus + bonusLockedSoFar}  pts` +
            (bonusLockedSoFar > 0 ? `  ( incl. ${bonusLockedSoFar}  bonus )` : "") +
            (runningAllOrNull !== null
                ? `\nTotal  (all games):   ${runningAllOrNull}  pts` +
                  (seriesBonusSoFar > 0 ? `  ( incl. ${seriesBonusSoFar}  bonus )` : "")
                : ""
            )
        );
    },

    /* ---------------- notices for skipping turns (only shows the first skipped turn) ---------------- */
    solvedSkipNotice(name, totalWithBonus, lockedBonus, hadReplaysYes, runningWithCurrentGame, runningBonusWithCurrent) {
        const allLine = hadReplaysYes
            ? `\n\nAll games:      ${runningWithCurrentGame}  points` + (runningBonusWithCurrent > 0 ? `   ( incl.  ${runningBonusWithCurrent}  bonus )` : "")
            : "";
        return `${name}  solved theirs !    -->    skipping remaining guesses...\n\nThis game:    ${totalWithBonus}  points` + (lockedBonus > 0 ? `   ( incl.  ${lockedBonus}  bonus )` : "") + allLine;
    },
    quitSkipNotice(name, totalNoBonus, penalty, hadReplaysYes, runningAllWithPenalty, runningPenaltyWithCurrent) {
        const afterPenalty = totalNoBonus - penalty;    // final this-game total with penalty applied
        const allLine = hadReplaysYes
            ? `\n\nAll games:      ${runningAllWithPenalty}  points` + (runningPenaltyWithCurrent > 0 ? `   ( - ${runningPenaltyWithCurrent}  penalty )` : "")
            : "";
        return `${name}  quit this game  😢    -->    skipping remaining guesses...\n\n` +
            `This game:    ${afterPenalty}  points   ( - ${penalty}  penalty )` + allLine;
    },

    /* ---------------- session / series summary ----------------
        important  -->  keeping the same return strings so downstream alerts stay consistent
        notes:
            • supports 3 shapes:
                1) multiplayer/series object (has .standings)  → prints leaders + averages
                2) solo session array (2+ elements)             → total/avg/best/worst across games
                3) single round score object                    → prints detailed score breakdown
    */
    statSummary(objOrArr) {
        // multi / series or mid-game objects have standings
        if (objOrArr && objOrArr.standings) {    // detect multi summaries
            const scores = objOrArr;    // alias for readability
            const avgLabel = scores.scope === "series" ? "Average Game" : "Average Guess";    // wording changes depending on scope

            // one-liner for the most interesting headline in this context
            //    series → best single game in the series
            //    mid-game standings → current running total leader
            const firstLine = scores.leaderSingleGame
                ? `Best Game:                ${scores.leaderSingleGame.name}    ( ${scores.leaderSingleGame.points}  points  in  Game  ${scores.leaderSingleGame.gameAt} )`
                : `Running Total:        ${scores.leaderTotal.name}        ( ${scores.leaderTotal.total}  points )`;

            // best & worst attempt lines change phrasing for series vs per-guess view
            const bestAttemptLine = scores.scope === "series"
                ? `Best Attempt:             ${scores.leaderBest.name}     ( ${scores.leaderBest.best}  points )`
                : `Best Attempt:             ${scores.leaderBest.name}     ( Attempt  ${scores.leaderBest.bestAt}  -->  ${scores.leaderBest.best}  points )`;

            const worstAttemptLine = scores.scope === "series"
                ? `Weakest Attempt:       ${scores.leaderWorst.name}     ( ${scores.leaderWorst.worst}  points )`
                : `Weakest Attempt:       ${scores.leaderWorst.name}     ( Attempt ${scores.leaderWorst.worstAt} -->  ${scores.leaderWorst.worst}  points )`;

            // final assemble  →  chosen to be concise but comparable across views
            return (
                `${firstLine}\n` +
                `${avgLabel}:          ${scores.leaderAvg.name}    ( ${parseFloat(scores.leaderAvg.average.toFixed(2))}  points )\n` +
                `${bestAttemptLine}\n` +
                `${worstAttemptLine}`
            );
        }

        // SOLO session summary  -->  array of round totals
        if (Array.isArray(objOrArr)) {
            const rounds = objOrArr;    // alias  -->  expected as array of game totals
            if (rounds.length < 2) return "";    // only show if 2+ rounds

            // pull out numeric totals to compute rollups (sum, avg, best, worst)
            const totals = rounds.map(r => r.totalPoints);    // shape: [number, number, ...]
            const roundsPlayed = totals.length;
            const totalPointsAll = totals.reduce((a, b) => a + b, 0);
            const averagePoints = parseFloat((totalPointsAll / roundsPlayed).toFixed(2));    // trim to 2 decimals for dialogs

            const bestRoundPoints = Math.max(...totals);
            const worstRoundPoints = Math.min(...totals);
            const bestRoundAt = totals.indexOf(bestRoundPoints) + 1;     // 1-based for humans
            const worstRoundAt = totals.indexOf(worstRoundPoints) + 1;   // same idea

            // block aligned for quick scanning after a game
            return `SESSION   SUMMARY    -->    ${roundsPlayed}  rounds

        Total:                           ${totalPointsAll}  points
        Average Game:           ${averagePoints}  points
        Best Game:                 ${bestRoundPoints}  points   ( Game  ${bestRoundAt} )
        Weakest Game:          ${worstRoundPoints}  points   ( Game  ${worstRoundAt} )`;
        }

        // single round summary object
        const gameScore = objOrArr;    // single game’s stats  / per-game summary
        // conditional lines so the block doesn’t print empty bonus/penalty rows
        const bonusLine = (gameScore.unusedGuessPoints || 0) > 0
            ? `\n        Bonus  Points:     ${gameScore.unusedGuessPoints}`
            : "";
        const penaltyLine = (gameScore.quitPenalty || 0) > 0
            ? `\n        Quit  Penalty:     - ${gameScore.quitPenalty}`
            : "";

        // compact 3-line summary  (keeps math visible after reveal)
        return `Score Summary:
                Guess  Points:     ${gameScore.guessesPoints}${bonusLine}${penaltyLine}
                Total  Points:       ${gameScore.totalPoints}`;
    },
};




/*  ============================================================
        DICTIONARY  -->  demo + optional external
    ============================================================
        ✦ tiny, in-line sample for demo / debugging  ; auto-switch to full list (API sim) when present (used by portfolio build)
        ✦ checks for presentation mode and external dict first before switching  ( avoid crashes )
    ------------------------------------------------------------
*/

const demoDictionary = [
    { word: "apple", definition: "A round, crisp fruit from an apple tree." },
    { word: "angle", definition: "The figure formed by two lines meeting at a point." },
    { word: "adapt", definition: "To change to fit new conditions." },
    { word: "align", definition: "To place or arrange in a straight line or proper position." },
    { word: "alert", definition: "Quick to notice; to warn of danger." },
    { word: "argue", definition: "To give reasons for or against something; to dispute." },
    { word: "arise", definition: "To begin or come into being; to get up." },
    { word: "asset", definition: "Something valuable owned." },
    { word: "award", definition: "To give a prize or decision; a prize given." },
    { word: "avoid", definition: "To keep away from." },
];

// check type then non-empty  -->  only switch if real data exists (loaded correctly)
// const externalDict  =  (typeof window !== "undefined") ? require('./dictionaryData') : null ;
// browser-safe  -->  reads the array injected by dictionaryData.js
const externalDict = (typeof window !== "undefined" && Array.isArray(window.dictionaryData)) ? window.dictionaryData : null;
const activeDictionary = (externalDict && externalDict.length)
    ? externalDict    // prefer external list when available  (portfolio mode)
    : demoDictionary;    // fallback to local demo / dev version




/*  =============================================================================
        HELPERS  --  VALID CONFIGS  -->  safe word length clamp, word picker, custom config parser
    ============================================================================= */


/* uses .reduce to go through the list and collect min / max / nearest in one pass
   tie-breaker prefers the smaller length so difficulty does not spike unexpectedly */
function safeWordLength(requestedLength, dictList) {
    const acc = dictList.reduce((curr, entry) => {    // pass over elements once and summarize as we go
        const lengthNow = entry.word.length;    // current word length
        if (curr === null) {    // format 1st elem to be useful in the comparisons (baseline)
            return {
                min: lengthNow, max: lengthNow, nearest: lengthNow,    // set all baselines (equal at start)
                diff: Math.abs(lengthNow - requestedLength),    // distance to requested length
                hasRequested: (lengthNow === requestedLength),    // flag if word(s) of the exact requested length are found (sticky)
            };
        }
        const minLen = Math.min(curr.min, lengthNow);    // keep a global min
        const maxLen = Math.max(curr.max, lengthNow);    // keep a global max
        const distance = Math.abs(lengthNow - requestedLength);    // absolute distance (useful for picking the nearest word length)
        const isCloserChoice =
            (distance < curr.diff) ||    // better candidate if closer to target length than previous closest
            (distance === curr.diff && lengthNow < curr.nearest);    // if there's a distance tie, prefer the smaller length
        return {
            min: minLen, max: maxLen,
            nearest: isCloserChoice ? lengthNow : curr.nearest,    // update nearest length value when a better one is found
            diff: isCloserChoice ? distance : curr.diff,    // update diff accordingly
            hasRequested: curr.hasRequested || (lengthNow === requestedLength),    // use OR so it stays true once seen (sticky)
        };
    }, null);    // start with null so the first elem is used to set the baseline

    if (!acc) return requestedLength;    // don't break if the dictionary is empty (edge case  -->  nothing to clamp)
    return acc.hasRequested ? requestedLength : acc.nearest;    // safe clamp  -->  exact if it exists ; otherwise nearest
}


/*  chooses a new target game word of desired length and avoids repeats when possible */
function pickAWord(dictList, excludeList = gameState.history) {
    const safeLen = safeWordLength(config.wordLength, dictList);    // clamp length safely  -->  protects filters below from breaking
    config.wordLength = safeLen;    // add to config so other functions rely on a valid length

    let candidateDict = dictList.filter(entry =>    // build pool of candidate enties 
        entry.word.length === config.wordLength &&    // only keep words with the correct length (updated one)
        !(excludeList && Array.isArray(excludeList) && excludeList.includes(entry.word))    // and words not in the game history already
    );

    if (candidateDict.length === 0) {    // if every word of this length was used, then allow repeats so the game can continue
        candidateDict = dictList.filter(entry => entry.word.length === config.wordLength);    // drop 'history' filter and only keep the length filter
    }

    const indexNum = Math.floor(Math.random() * candidateDict.length);    // picks a random index inside [0, candidateDict.length)
    return candidateDict[indexNum];    // selected { word, definition } obj returned to the caller
}


/* flexibly parses "len, guesses, rounds" prompt (comma / space separated custom config inputs) */
function customConfig(inputLine) {
    if (!inputLine) {    // if cancel or empty input  -->  keep current settings
        return {
            wordLength: config.wordLength,
            maxGuesses: config.maxGuesses,
            gameRounds: gameState.lastRounds || 1,
        };
    }

    const numericParts = inputLine
        .replace(/\D+/g, " ")    // only keep numbers  -->  commas/pipes/etc collapse into single spaces
        .split(/\s+/)    // split on 1+ spaces and build an array from that
        .filter(Boolean)    // drop empty elements  -->  cleans up accidental gaps
        .map(numberText => parseInt(numberText, 10));    // turn text into base-10 numbers (keep a consistent numeric array and avoid type coersion/errors)

    const [customLen, customMax, customRounds] = numericParts;    // only take first three numbers (extras are ignored)
    const wordLength = Number.isFinite(customLen) ? customLen : config.wordLength;    // guard against NaN / infinite loop (fallback to current config)
    const maxGuesses = Number.isFinite(customMax) ? customMax : config.maxGuesses;    // same idea here  ;  fallback to current config
    const gameRounds = Number.isFinite(customRounds) ? customRounds : (gameState.lastRounds || 1);    // same idea here  ;  fallback to last game's count or classic 1 round

    return { wordLength, maxGuesses, gameRounds };    // compact return for callers use
}




/*  ===========================================================================
        HELPERS -- VALID INPUT  -->  clean → check length → check dictionary (recursion)
    ===========================================================================
        ✦ keep the player inside one friendly question until the input is valid or canceled
            • function calls itself again when a retry is needed  -->  keeps the same board context visible for guidance
            • cancel/ESC returns null so the caller can confirm quitting on this game word
*/
async function validateGuess(inputLine, boardTextForRetry) {
    if (inputLine === null) return null;    // cancel/Esc  -->  pass to caller to confirm

    const cleanedGuess = inputLine.toLowerCase().replace(/[^a-z0-9]/g, "");    // format to lowercase (same as dictionary) + strip to letters/numbers
    const isRightLength = (cleanedGuess.length === config.wordLength);    // exact length check  -->  based on current config
    const isInDictionary = activeDictionary.some(entry => entry.word === cleanedGuess);    // enforce membership in game dictionary

    if (!isRightLength) {    // player input is the wrong length  -->  shows exact target length for clarity
        const nextInput = await ask.prompt(
            messages.invalidGuess("length", { inputLen: cleanedGuess.length, neededLen: config.wordLength, boardText: boardTextForRetry })
        );    // clearly explains the expected size
        return validateGuess(nextInput, boardTextForRetry);    // recursive retry  with the  same game board for context
    }

    if (!isInDictionary) {    // input is the correct length but an unknown word (not in game's dictionary)
        const nextInput = await ask.prompt(
            messages.invalidGuess("unknown", { cleanWord: cleanedGuess, boardText: boardTextForRetry })
        );    // encourage another try
        return validateGuess(nextInput, boardTextForRetry);    // recursive retry
    }

    return cleanedGuess;    // valid and clean  -->  ready for scoring
}




/* ==================================================================================================
        HELPERS -- SCORING  -->  compare guess vs target (2 passes), tally emojis, compute totals
   ================================================================================================== */


/* two-pass scoring (greens first, then yellows, leftover's are white)  -->  keeps duplicate letters hints accurate
   targetWordOverride allows multiplayer to score against their own, per-player secret (closure) */
function scoreGuess(cleanedGuessWord, targetWordOverride) {
    const currentTargetWord = targetWordOverride || gameState.targetWord.word;    // prefer override when present (multiplayer)

    const targetArray = currentTargetWord.split("");    // target letters array  (easier to compare)
    const guessArray = cleanedGuessWord.split("");    // guess letters array  (parallel comparison to letter at current index in target word)
    const gradeArray = Array(guessArray.length).fill(config.emojis.incorrect);    // default all to incorrect (later fill in correct/almost specifically)

    const remainingLetterCount = {};    // frequency map after greens are removed  -->  keys are the remaining letters and values are the count of how many of that letter remains

    // pass 1  -->  set greens and collect remaining counts
    for (let i = 0; i < guessArray.length; i++) {
        if (guessArray[i] === targetArray[i]) {    // exact match at this index  (placement is right and letter is right)
            gradeArray[i] = config.emojis.correct;    // issue green mark for the correct spot
        } else {
            const letterAtTarget = targetArray[i];    // letter to count for yellows later (only non-green positions are remembered in frequency map)
            remainingLetterCount[letterAtTarget]  =  (remainingLetterCount[letterAtTarget] || 0) + 1;    // increment count for this letter
        }
    }

    // pass 2  -->  set yellows using remaining counts  (separate passes prevents over-crediting duplicate letters in the guess)
    for (let i = 0; i < guessArray.length; i++) {
        if (gradeArray[i] === config.emojis.correct) continue;    // skip already green slots
        const letterAtGuess = guessArray[i];    // letter we are trying to place ( candidate for yellow )
        if (remainingLetterCount[letterAtGuess] > 0) {    // if the guess letter exists elsewhere in target (not including already greens)  -->  score with yellow
            gradeArray[i] = config.emojis.almost;    // yellow mark for correct letter wrong spot
            remainingLetterCount[letterAtGuess]--;    // decrease remaining count by 1 (prevent extra yellows)
        } else {
            gradeArray[i] = config.emojis.incorrect;    // white mark  -->  letter not present (or already accounted for all of letter)
        }
    }

    return [cleanedGuessWord, gradeArray];    // format expected by displayGuess and explain windows
}


/* tallies emoji counts and returns points for the single guess. */
function emojiGuessPoints(emojiArray) {
    const counts = { correct: 0, almost: 0, incorrect: 0 };    // running tallies
    for (let i = 0; i < emojiArray.length; i++) {
        const grade = emojiArray[i];    // current emoji
        if (grade === config.emojis.correct) counts.correct++;    // count the greens -->  +2 each by default
        else if (grade === config.emojis.almost) counts.almost++;    // count yellows  -->  +1 each by default
        else counts.incorrect++;    // count whites  -->  -1 each by default
    }
    const points = counts.correct * config.pointsValue.correct    // apply multipliers  (uses current config)
                + counts.almost  * config.pointsValue.almost
                + counts.incorrect * config.pointsValue.incorrect;
    return { points, counts };    // both the number value and the visual breakdown (for messages.roundExplain)
}


/* 
    compute totals for the current gameState (solo or per-player in multi)
    includeBonus  -->  when true, adds remaining * wordLength * correctValue to player's score
*/
function computeGameStats(playersArray, includeBonusFlag = true) {
    const mixedBonus = (includeBonusFlag === "finishedOnly");    // single switch for mid-cycle behavior

    // per-player calculations  -->  totals + best/worst/avg + optional penalties (quit)
    const totals = playersArray.map(player => {
        /* ---------- swap trick ---------- 
            temporarily point the shared gameState board at this player's board
              -->  reuse the solo scorer (computeUserScore) with zero changes
        */

        // stash globals
        const savedAttempts = gameState.attempts;
        const savedRemaining = gameState.remaining;

        // redirect scorers to player data
        gameState.attempts = player.attempts;
        gameState.remaining = player.remaining;

        const scoreNoBonus   = computeUserScore(false).totalPoints;    // base score (no remaining-guess bonus)
        const scoreWithBonus = computeUserScore(true).totalPoints;    // full score (bonus if finished)

        // restore globals
        gameState.attempts = savedAttempts;
        gameState.remaining = savedRemaining;

        // positive bonus delta (never negative)  -->  used for "incl. X bonus" tag in standings
        const bonusPotential = Math.max(0, scoreWithBonus - scoreNoBonus);

        // choose which total to display based on includeBonusFlag
        let total = mixedBonus
            ? (player.status !== "playing" ? scoreWithBonus : scoreNoBonus)    // only finished players show bonus
            : (includeBonusFlag ? scoreWithBonus : scoreNoBonus);    // all or none

        // optional quit penalty (mirrors bonus size)  -->  removes locked bonus that would have existed
        let penaltyNow = 0;
        if (mixedBonus || includeBonusFlag === true) {    // only subtract when bonus is expected to be visible
            if (player.status === "quit") {
                penaltyNow = (player.remainingAtQuit || 0) * config.wordLength * config.pointsValue.correct;    // same product as bonus
                total -= penaltyNow;    // apply penalty to displayed total
            }
        }

        // per-guess analytics  -->  average / best / worst (safe even with empty roundPoints)
        const attemptRow = Array.isArray(player.roundPoints) ? player.roundPoints : [];
        const count   = Math.max(1, attemptRow.length);    // guard divide-by-zero
        const average = attemptRow.reduce((a, b) => a + b, 0) / count;

        let best = -Infinity,  bestAt = 0;    // best single guess + which attempt it was
        for (let i = 0; i < attemptRow.length; i++) {
            if (attemptRow[i] > best) { best = attemptRow[i]; bestAt = i + 1; }
        }
        if (best === -Infinity) { best = 0; bestAt = 0; }    // normalize when no attempts yet

        let worst = Infinity,  worstAt = 0;    // weakest single guess + which attempt it was
        for (let i = 0; i < attemptRow.length; i++) {
            if (attemptRow[i] < worst) { worst = attemptRow[i]; worstAt = i + 1; }
        }
        if (worst === Infinity) { worst = 0; worstAt = 0; }    // normalize when no attempts yet

        // return row shape used by callers + standings builder
        return mixedBonus
            ? { name: player.name, total, average, best, bestAt, worst, worstAt, bonusSoFar: (player.status !== "playing") ? bonusPotential : 0, penaltySoFar: penaltyNow }
            : { name: player.name, total, average, best, bestAt, worst, worstAt };
    });

    // sorted list for quick printing (desc by totalPoints)
    const standings = totals
        .map(row => mixedBonus
            ? ({ name: row.name, totalPoints: row.total, bonusSoFar: row.bonusSoFar, penaltySoFar: row.penaltySoFar })
            : ({ name: row.name, totalPoints: row.total })
        )
        .sort((a, b) => b.totalPoints - a.totalPoints);    // leaderboard style

    // leaders across different cut views (copy arrays before sort to avoid mutating 'totals')
    const leaderTotal = totals.slice().sort((a, b) => b.total   - a.total  )[0];    // highest game total
    const leaderAvg   = totals.slice().sort((a, b) => b.average - a.average)[0];    // highest average per guess
    const leaderBest  = totals.slice().sort((a, b) => b.best    - a.best   )[0];    // strongest single attempt
    const leaderWorst = totals.slice().sort((a, b) => a.worst   - b.worst  )[0];    // weakest single attempt (asc)

    return { standings, leaderTotal, leaderAvg, leaderBest, leaderWorst };    // shape expected by messages.statSummary
}




/*  ===================================================================================================
        HELPERS  -- BOARD PRINTER  -->  turns the game board into a text block (for dialogs)
    ===================================================================================================
        ✦ why  -->  dialogs show a compact, readable board without extra UI widgets
        ✦ layout
            • each attempt prints in 2 lines
                → line 1 = UPPERCASE letters spaced out  (aligns visually with emoji row)
                → line 2 = emoji grades with padding     (✅ / 🟨 / ⬜️)
            • legend added once at the end (emoji meanings + point values)
*/
function displayGuess(attemptsOverride) {
    const attemptsToShow = attemptsOverride || gameState.attempts;    // defaults to current global board (solo) ; allows per-player board in multi

    // map each attempt to a 2-line block then join with newlines to build one big board text
    const attemptText = attemptsToShow
        .map((pairRow, indexNum) => {
            const guessWord = pairRow[0];    // top line source (letters)
            const emojiRow  = pairRow[1];    // bottom line source (grades per letter)

            // highlight with UPPERCASE, then add fixed spacing between letters so columns line up with emojis below
            const spacedLetters = guessWord.toUpperCase().split("")    // split into individual letters
                .join("     ");    // 5 spaces chosen after eyeballing for readability in dialogs

            // emojis are also spaced  →  visual parallel to spacedLetters string above
            const feedbackRow = emojiRow.join("    ");    // 3 spaces keeps total width balanced vs. letters row

            // final 2-line block with attempt counter (1-based) and fixed max for context
            return `${indexNum + 1}  of  ${config.maxGuesses}  :    ${spacedLetters}\n` +
                   `                  ${feedbackRow}`;
        })
        .join("\n");    // stack all attempts in order

    // legend once at the end  →  keeps the "what does each emoji mean" accessible across attempts
    return attemptText + "\n" + messages.legendLine();
}




/*  =========================================================
        GAME ENTRY / EXIT  -->  intro + outro
    ========================================================= */
async function intro() {
    const responseYes = await ask.confirm(messages.welcome);    // funnel to menus or exit game  -->  OK to continue  ;  cancel/ESC to leave
    if (responseYes) {
        return menuRouter("main");    // go to the main menu  -->  choose mode → rules → play
    } else {
        await ask.alert(messages.startOver);    // friendly close
        return outro();    // lets player reconsider exit
    }
}

async function outro() {
    const didChangeMind = await ask.confirm(messages.endGame);    // gives a second chance   -->  accidental cancel safety net
    if (didChangeMind) {
        return intro();    // jump back to entry point ( fresh start )
    } else {
        await ask.alert(messages.endLast);    // final goodbye  -->  session ends
    }
}




/*  ============================================================================================================
        HELPERS  --  MENU ROUTER  -->  chooses mode & rules, loops gameplay, then sends to post-game actions
    ============================================================================================================
        ✦ flow
            • "main"  →  pick mode  →  pick rules  →  start the right game path
            • when a game path ends  -->  switch to "post" menu  ( replay / custom / change / quit )
        ✦ notes
            • uses strings contains checks  -->  "so", "solo", "sOLO" all map to solo
            • preserves solo session summary behavior on exits (only after solo)
*/

async function menuRouter(phaseName = "main") {
    if (phaseName === "main") {    // pre-game flow  -->  pick a mode, then rules for that mode
        const modeInput = await ask.prompt(messages.menuText("mode"));    // ask for mode  -->  solo / multiplayer / quit
        const modeClean = (modeInput || "").toLowerCase().trim();    // normalize user text  -->  account for null/empty

        if (modeInput === null) {    // Cancel on mode menu  -->  exit + (conditionally) solo session summary
            if (gameState.lastGameMode === "solo") {    // only summarize solo sessions when solo was the last mode
                const summary = messages.statSummary(gameState.sessionScores);    // solo session summary appears after 2+ games
                if (summary) await ask.alert(summary);    // show when available
            }
            return outro();    // end or restart from outro
        }

        let chosenModeName = "solo";    // fallback/default when user inputs something unexpected
        switch (true) {    // boolean switch  -->  allows .includes() checks
            case modeClean.includes("so"): { chosenModeName = "solo"; break; }    // solo
            case modeClean.includes("mu"): { chosenModeName = "multi"; break; }    // multiplayer
            case modeClean.includes("q"):  {    // quit
                if (gameState.lastGameMode === "solo") {
                    const summary = messages.statSummary(gameState.sessionScores);
                    if (summary) await ask.alert(summary);
                }
                return outro();
            }
            default: { /* keep default 'solo' */ }
        }

        const rulesInput = await ask.prompt(messages.menuText("rules", chosenModeName));    // pick rules for that mode
        const rulesClean = (rulesInput || "").toLowerCase().trim();    // normalize rules text
        if (rulesInput === null) return menuRouter("main");    // back to mode selection

        let chosenRuleName = "classic";    // default rules
        switch (true) {
            case rulesClean.includes("cu"): { chosenRuleName = "custom";  break; }
            case rulesClean.includes("cl"): { chosenRuleName = "classic"; break; }
            default: { /* keep 'classic' */ }
        }

        if (chosenModeName === "solo") {
            // optional solo name stored the same way as multiplayer names
            const soloNameInput = await ask.prompt(messages.promptGroupSetup("solo"));    // allow solo player to add an optional name
            gameState.playerNames = soloNameInput ? [soloNameInput.trim()] : [];    // empty array means anonymous solo player

            if (chosenRuleName === "classic") {
                config.wordLength = classicDefaults.wordLength;    // apply baseline defaults  -->  classic configs
                config.maxGuesses = classicDefaults.maxGuesses;
                gameState.lastGameMode = "solo";
                gameState.lastRounds = classicDefaults.gameRounds;
                await playGame();    // one classic solo game
            } else {
                const customLine = await ask.prompt(messages.promptEntryCustomConfig());    // prompts for 3 numbers to use for custom configs
                if (customLine === null) return menuRouter("main");    // cancelled ?  --> back to the main menu
                const parsed = customConfig(customLine);    // clamp numbers
                config.wordLength = parsed.wordLength;    // apply all
                config.maxGuesses = parsed.maxGuesses;
                gameState.lastGameMode = "solo";
                gameState.lastRounds = parsed.gameRounds;
                for (let n = 1; n <= parsed.gameRounds; n++) await playGame();    // series of solo games
            }
        } else {
            // multiplayer path
            gameState.lastGameMode = "multi";
            if (chosenRuleName === "classic") {
                config.wordLength = classicDefaults.wordLength;
                config.maxGuesses = classicDefaults.maxGuesses;
                gameState.lastRounds = classicDefaults.gameRounds;
                await playGameMulti({ priorWordLength: config.wordLength, priorMaxGuesses: config.maxGuesses, priorRounds: gameState.lastRounds });    // fast path
            } else {
                await playGameMulti();    // custom path handled inside multi flow
            }
        }

        return menuRouter("post");    // post-game loop starts after any game path finishes
    }

    // POST phase  -->  replay / custom / change mode / quit ; defaults to replay
    const postInput = await ask.prompt(messages.menuText("post"));    // request next steps
    const postClean = (postInput || "").toLowerCase().trim();    // normalized

    if (postInput === null) {    // cancelled at post menu  -->  (conditionally) show solo summary then exit
        if (gameState.lastGameMode === "solo") {    // guard: never show solo summary after a multi series
            const summary = messages.statSummary(gameState.sessionScores);    // solo session summary
            if (summary) await ask.alert(summary);
        }
        return outro();
    }

    switch (true) {
        case postClean.includes("re"): {    // replay same mode/configs
            if (gameState.lastGameMode === "solo") {
                for (let n = 1; n <= gameState.lastRounds; n++) await playGame();    // repeat last solo series
            } else {
                if (gameState.lastMultiplayerSetup) await playGameMulti(gameState.lastMultiplayerSetup);    // repeat last multi setup
                else await playGameMulti();    // no snapshot yet  -->  prompt inside
            }
            break;
        }
        case postClean.includes("cu"): {    // change configs (same mode)
            if (gameState.lastGameMode === "solo") {
                const customLine = await ask.prompt(messages.promptEntryCustomConfig());    // new settings
                if (customLine === null) return menuRouter("post");
                const parsed = customConfig(customLine);
                config.wordLength = parsed.wordLength;
                config.maxGuesses = parsed.maxGuesses;
                gameState.lastRounds = parsed.gameRounds;
                for (let n = 1; n <= parsed.gameRounds; n++) await playGame();
            } else {
                await playGameMulti();    // multiplayer prompts internally
            }
            break;
        }
        case postClean.includes("mo"): {    // change mode
            return menuRouter("main");
        }
        case postClean.includes("q"): {    // quit
            if (gameState.lastGameMode === "solo") {
                const summary = messages.statSummary(gameState.sessionScores);
                if (summary) await ask.alert(summary);
            }
            return outro();
        }
        default: {    // default to replay
            if (gameState.lastGameMode === "solo") {
                for (let n = 1; n <= gameState.lastRounds; n++) await playGame();
            } else {
                if (gameState.lastMultiplayerSetup) await playGameMulti(gameState.lastMultiplayerSetup);
                else await playGameMulti();
            }
            break;
        }
    }

    return menuRouter("post");    // stay in post loop for repeated play / change / quit
}




/*  =========================================================
        PLAY GAME  -->  SOLO  --  one game loop
    =========================================================
        ✦ GAME FLOW  -->
            1)  reset per-game fields ; show rules
            2)  pick target word ; loop prompts  →  validate  →  score  →  track
            3)  end message + reveal + summary ; store solo session totals
*/
async function playGame() {
    // reset per-game fields
    gameState.status = "playing";    // fresh state  -->  new round
    gameState.attempts = [];    // clear board empty the array
    gameState.remaining = config.maxGuesses;    // reset countdown to match current game rules

    await ask.alert(messages.rulesInfo());    // dynamic rules display  -->  uses config values

    // pick target (avoid repeats when possible)
    const gameWordObj = pickAWord(activeDictionary);    // select {word, definition}  -->  verifies safe game word length
    gameState.targetWord = gameWordObj;    // save secret word for scoring and reveal
    if (!gameState.history.includes(gameWordObj.word)) gameState.history.push(gameWordObj.word);    // record globally to reduce repeats later

    // main loop
    while (gameState.status === "playing") {
        const boardText = displayGuess();    // snapshot of current board  -->  helps with guessing
        const guessLine = await ask.prompt(messages.promptGuess(gameState.playerNames[0] || null, boardText));    // solo player may have picked a display name
        let cleanGuess = null;    // will hold validated guess

        if (guessLine !== null) cleanGuess = await validateGuess(guessLine, boardText);    // recursion keeps the same board for invalid inputs

        if (guessLine === null || cleanGuess === null) {    // cancel ?  -->  confirm with user
            const continueYes = await ask.confirm(messages.endGame);    // gives a second chance
            if (continueYes) continue;    // no penalty  -->  skip the rest of this loop
            gameState.status = "quit";    // else  -->  record quit  (affects scoring)
            gameState.remainingAtQuit = gameState.remaining;    // size of penalty (mirrors bonus)
            gameState.remaining = 0;    // prevent phantom points
            break;    // leave loop
        }

        const [guessWordNow, emojiRowNow] = scoreGuess(cleanGuess);    // score for solo target
        gameState.attempts.push([guessWordNow, emojiRowNow]);    // record entry
        gameState.remaining--;    // remove a guess attempt

        if (emojiRowNow.every(mark => mark === config.emojis.correct)) gameState.status = "won";    // player solved
        else if (gameState.remaining === 0) gameState.status = "lost";    // player ran out of tries
    }

    // totals and penalty application
    const baseTotals = computeUserScore(true);    // base includes bonus for any remaining guesses
    const quitPenalty = gameState.status === "quit"
        ? (gameState.remainingAtQuit || 0) * config.wordLength * config.pointsValue.correct    // same size as bonus but negative
        : 0;

    const finalRoundScore = {
        ...baseTotals,    // keep breakdown fields  -->  explains in summary
        totalPoints: baseTotals.totalPoints - quitPenalty,    // apply penalty after computing base
        quitPenalty,    // store the amount for reference
    };

    gameState.sessionScores.push(finalRoundScore);    // record for solo session summary

    const showSoloCumulative = gameState.sessionScores.length > 1;    // show only after 2+ games
    const cumulativePoints = showSoloCumulative
        ? gameState.sessionScores.reduce((sum, row) => sum + row.totalPoints, 0)    // sum all totals so far
        : 0;
    const cumulativeLine = showSoloCumulative ? `\n\nAll games (solo):   ${cumulativePoints}  points` : "";    // optional line

    // reveal + end message
    if (gameState.status === "won") {
        await ask.alert(
            messages.outcomeText("won", { guessesUsed: config.maxGuesses - gameState.remaining }) +    // “solved in X attempts”
            "\n\n" + `${messages.showGameWord ? messages.showGameWord(gameWordObj) : `The game word was:   ${gameWordObj.word.toUpperCase()}\nDefinition:   ${gameWordObj.definition}`}` + 
            "\n\n" + messages.statSummary(finalRoundScore) + cumulativeLine
        );
    } else if (gameState.status === "lost") {
        await ask.alert(
            messages.outcomeText("lost", {}) + "\n\n" +
            `${messages.showGameWord ? messages.showGameWord(gameWordObj) : `The game word was:   ${gameWordObj.word.toUpperCase()}\nDefinition:   ${gameWordObj.definition}`}` +
            "\n\n" + messages.statSummary(finalRoundScore) + cumulativeLine
        );
    } else {
        await ask.alert(
            messages.outcomeText("quit", {}) + "\n\n" +
            `${messages.showGameWord ? messages.showGameWord(gameWordObj) : `The game word was:   ${gameWordObj.word.toUpperCase()}\nDefinition:   ${gameWordObj.definition}`}` +
            "\n\n" + messages.statSummary(finalRoundScore) + cumulativeLine
        );
    }

    // if menuRouter launched the game, control returns there ; otherwise here's a basic replay prompt (from MVP)
    if (typeof gameState.lastGameMode === "undefined") {
        const playAgainYes = await ask.confirm(messages.endGame);    // basic replay confirm
        if (playAgainYes) await playGame(); else await outro();
    }
}




/*  ============================================================================================================
        PLAY GAME  -->  MULTIPLAYER  --  series play using closure, shared calculators, and per-player state
    ============================================================================================================
        ✦ loop shape
            1) setup players (count + optional names) and difficulty (classic or custom)
                • OOP-ish  -->  each playerState is an object with clear properties (name, attempts, status…)
            2) for each game in the series:
                → each player gets a unique secret word
                → round-robin turns until *everyone* is finished (won / lost / quit)
                → show mid-cycle standings after each full guess cycle
                → reveal answers for this game
                → aggregate series stats (per player)
            3) after the series:
                → show series leaderboard + highlights
                → optionally show “ALL GAMES” cumulative board (across replays)
        ✦ closure
            • takeTurnFor(...) is defined inside playGameMulti(...)
                → it can 'see' config, gameIndex, messages, and helpers without passing them as parameters each time
                → captures access (closure) from the lexical scope
            • when takeTurnFor recurses (on retry), it still uses the same remembered outer variables
                → behavior + calculations stay stable
            • tiny 'swap trick'  ->  makes solo play calculators reusable in multi mode by temporarily pointing gameState at a player’s board
                → avoids needing to create extra globals / parameter lists
*/


async function playGameMulti(previousSetupInfo) {
    gameState.multiAllTotals = gameState.multiAllTotals || {};    // cumulative store across replays (built once)
    const hadAnyReplays = Object.keys(gameState.multiAllTotals).length > 0;     // use to decide if “ALL GAMES” board appears later

    /* ---------- replay support (skip prompts) ---------- */
    if (previousSetupInfo && typeof previousSetupInfo.priorWordLength === "number" && typeof previousSetupInfo.priorMaxGuesses === "number") {
        config.wordLength = previousSetupInfo.priorWordLength;    // carry forward difficulty
        config.maxGuesses = previousSetupInfo.priorMaxGuesses;
        gameState.lastRounds = previousSetupInfo.priorRounds || 1;    // ensure at least one game
    }

    /* ---------- player count + optional names ---------- */
    let playersCount = previousSetupInfo?.playersCount || null;    // skip if provided by replay
    let playerNames  = previousSetupInfo?.playerNames  || null;

    if (!playersCount) {   // fresh setup
        const playersPrompt = await ask.prompt(messages.promptGroupSetup("multi"));    // ex: "3 yes"
        if (playersPrompt === null) return;    // exit cleanly back to menu

        const cleanedPlayers    = (playersPrompt || "").toString().trim().toLowerCase();
        const wantsCustomNames  = /\b(yes|y|name|names)\b/.test(cleanedPlayers); // detects naming step
        playersCount            = parseInt(cleanedPlayers, 10);    // base-10 number parse

        if (!Number.isFinite(playersCount) || playersCount < 2) {    // guard → needs at least two players
            await ask.alert(messages.needMorePlayers);
            return;
        }

        if (wantsCustomNames) {    // optional naming pass
            const namesLine = await ask.prompt(messages.promptGroupSetup("multi", playersCount));
            if (namesLine !== null) {
                const parsedNames = (namesLine || "")
                    .split(/[,\s]+/)    // comma or whitespace separated
                    .map(nameText => nameText.trim())
                    .filter(Boolean);
                while (parsedNames.length < playersCount) parsedNames.push(`Player  ${parsedNames.length + 1}`); // fill missing
                playerNames = parsedNames.slice(0, playersCount);    // clamp extra names if any
            }
        }
    }

    /* ---------- difficulty (classic vs custom) ---------- */
    if (!previousSetupInfo) {    // only ask when not replaying
        const customLine = await ask.prompt(
            messages.promptEntryCustomConfig() + "\n( Press  Cancel  or leave  blank  to keep classic multiplayer settings. )\n"
        );
        if (customLine && customLine.trim().length > 0) {
            const parsed = customConfig(customLine);    // parse 3 numbers flexibly
            config.wordLength = parsed.wordLength;    // apply
            config.maxGuesses = parsed.maxGuesses;
            gameState.lastRounds = parsed.gameRounds;
        } else {
            config.wordLength = classicDefaults.wordLength;    // classic defaults
            config.maxGuesses = classicDefaults.maxGuesses;
            gameState.lastRounds = gameState.lastRounds || classicDefaults.gameRounds;
        }
    }

    /* ---------- show rules (dynamic from config) ---------- */
    await ask.alert(messages.rulesInfo());

    /* ---------- remember last setup for quick replays ---------- */
    gameState.lastGameMode = "multi";
    gameState.lastMultiplayerSetup = {
        playersCount,
        playerNames,
        priorWordLength: config.wordLength,
        priorMaxGuesses: config.maxGuesses,
        priorRounds: gameState.lastRounds
    };
    gameState.playerNames = Array.isArray(playerNames) ? playerNames.slice() : [];   // store names for displays

    const seriesTotals = {};    // per-name aggregation for this series only


    /* =========================================
            SERIES LOOP  (gameIndex: 1..N)
       ========================================= */
    for (let gameIndex = 1; gameIndex <= gameState.lastRounds; gameIndex++) {

        /* ---------- per-game per-player state ---------- */
        const playerStateList = Array.from({ length: playersCount }, (_, indexNum) => {
            const chosenWord = pickAWord(activeDictionary);    // personal secret for this player
            if (!gameState.history.includes(chosenWord.word)) gameState.history.push(chosenWord.word); // reduce repeats globally

            return {
                name: (playerNames && playerNames[indexNum]) ? playerNames[indexNum] : `Player  ${indexNum + 1}`,  // label for prompts + boards
                targetWord: chosenWord,    // { word, definition }
                attempts: [],    // [ [guess, [emojiRow]], ... ]
                roundPoints: [],    // per-guess numeric scores (for best/worst/avg)
                status: "playing",    // "playing" | "won" | "lost" | "quit"
                remaining: config.maxGuesses,    // countdown per player
                remainingAtQuit: 0,    // stored for penalty math
                wasSkipAlertShown: false,    // avoid duplicate “skipping turns” alerts
            };
        });

        /* ---------- closure  -->  1 full attempt for a specific player ---------- */
        async function takeTurnFor(playerState) {
            const boardNow = displayGuess(playerState.attempts);    // board snapshot for current player
            const guessLine = await ask.prompt(messages.promptGuess(playerState.name, boardNow)); // per-turn banner
            let cleanGuess = null;

            if (guessLine !== null) cleanGuess = await validateGuess(guessLine, boardNow); // keeps same board during retries

            if (guessLine === null || cleanGuess === null) {    // cancel path → confirm → maybe quit
                const continueYes = await ask.confirm(messages.endGame);
                if (continueYes) return await takeTurnFor(playerState);    // recursion: retry this same turn
                playerState.status = "quit";    // lock quit
                playerState.remainingAtQuit = playerState.remaining;    // store penalty size (mirrors bonus)
                playerState.remaining = 0;    // stabilize math downstream
                return;    // end this player's turn
            }

            // score current guess vs this player's secret
            const [guessWordNow, emojiRowNow] = scoreGuess(cleanGuess, playerState.targetWord.word);
            playerState.attempts.push([guessWordNow, emojiRowNow]);    // add row to their board
            playerState.remaining -= 1;    // consume one attempt

            // check end conditions for this player
            if (emojiRowNow.every(mark => mark === config.emojis.correct)) playerState.status = "won";
            else if (playerState.remaining === 0) playerState.status = "lost";

            // per-guess numeric points (for best/worst + per-turn explain)
            const { points, counts } = emojiGuessPoints(emojiRowNow);
            playerState.roundPoints.push(points);

            // reuse solo scorer via swap trick (points so far, with/without bonus)
            const savedAttempts  = gameState.attempts;
            const savedRemaining = gameState.remaining;
            gameState.attempts   = playerState.attempts;
            gameState.remaining  = playerState.remaining;
            const runningNoBonus   = computeUserScore(false).totalPoints;    // subtotal
            const runningWithBonus = computeUserScore(true).totalPoints;    // if finished, includes locked bonus
            gameState.attempts   = savedAttempts;
            gameState.remaining  = savedRemaining;

            // bonus messaging (show "Bonus: +" only on the winning turn)
            const didJustWin       = (playerState.status === "won");
            const bonusThisTurn    = didJustWin ? playerState.remaining * config.wordLength * config.pointsValue.correct : 0;
            const bonusLockedSoFar = (playerState.status !== "playing")
                ? Math.max(0, runningWithBonus - runningNoBonus)    // after done, show exact locked bonus
                : 0;

            // cross-replay running totals (only when there is prior history)
            const priorAll       = (gameState.multiAllTotals[playerState.name]?.totalAcrossGames) || 0;
            const priorBonusAll  = (gameState.multiAllTotals[playerState.name]?.bonusAcrossGames) || 0;
            const runningAllOrNull   = hadAnyReplays
                ? priorAll + (playerState.status === "won" ? runningWithBonus : runningNoBonus)
                : null;
            const seriesBonusSoFar   = hadAnyReplays
                ? priorBonusAll + (playerState.status !== "playing" ? bonusLockedSoFar : 0)
                : 0;

            // friendly per-turn explain window (teaches scoring live)
            const roundNow = Math.max(1, playerState.attempts.length);    // 1-based human label
            const explain = messages.roundExplain(
                playerState.name, roundNow, config.maxGuesses,
                guessWordNow, emojiRowNow, points,
                counts.correct, counts.almost, counts.incorrect,
                runningNoBonus, gameIndex,
                bonusThisTurn, bonusLockedSoFar, runningAllOrNull, seriesBonusSoFar
            );
            await ask.alert(explain);
        }


        /* ---------- round-robin loop until everyone is finished ---------- */
        let guessCycleCount = 0;
        while (playerStateList.some(p => p.status === "playing")) {    // .some stops early on first true
            guessCycleCount++;
            for (let i = 0; i < playerStateList.length; i++) {
                const onePlayer = playerStateList[i];

                if (onePlayer.status !== "playing") {    // finished players  -->  notify once, then skip the rest of turns for current game word
                    if (!onePlayer.wasSkipAlertShown) {
                        // compute a total to display in the notice
                        const savedAttempts = gameState.attempts;    // save
                        const savedRemaining = gameState.remaining;    // save
                        gameState.attempts = onePlayer.attempts;    // focus on player so scorers can use
                        gameState.remaining = onePlayer.remaining;
                        const totalNoBonus = computeUserScore(false).totalPoints;    // subtotal
                        const totalWithBonus = computeUserScore(true).totalPoints;    // finalized
                        gameState.attempts = savedAttempts;    // restore back to game configs
                        gameState.remaining = savedRemaining;    // restore back to game configs

                        const lockedBonus = Math.max(0, totalWithBonus - totalNoBonus);    // exact bonus amount

                        if (onePlayer.status === "won") {
                            const priorAllSkip = (gameState.multiAllTotals[onePlayer.name]?.totalAcrossGames) || 0;
                            const priorBonusSkip = (gameState.multiAllTotals[onePlayer.name]?.bonusAcrossGames) || 0;
                            const runningWithCurrentGame = priorAllSkip + totalWithBonus;
                            const runningBonusWithCurrent = priorBonusSkip + lockedBonus;
                            await ask.alert(messages.solvedSkipNotice(onePlayer.name, totalWithBonus, lockedBonus, hadAnyReplays, runningWithCurrentGame, runningBonusWithCurrent));
                        } else {
                            const penalty = (onePlayer.remainingAtQuit || 0) * config.wordLength * config.pointsValue.correct;    // mirrors bonus size
                            const priorAllQuit = (gameState.multiAllTotals[onePlayer.name]?.totalAcrossGames) || 0;    // prior points across replays
                            const priorPenaltyQuit = (gameState.multiAllTotals[onePlayer.name]?.penaltyAcrossGames) || 0;    // prior penalty across replays
                            const runningAllWithPenalty = priorAllQuit + (totalNoBonus - penalty);    // updated overall total including this penalty
                            const runningPenaltyWithCurrent = priorPenaltyQuit + penalty;    // updated overall penalty including this game
                            await ask.alert(messages.quitSkipNotice(onePlayer.name, totalNoBonus, penalty, hadAnyReplays, runningAllWithPenalty, runningPenaltyWithCurrent));
                        }

                        onePlayer.wasSkipAlertShown = true;    // mute repeat notices
                    }
                    continue;    // go to next player
                }

                await takeTurnFor(onePlayer);    // CLOSURE call
            }


            // mid-cycle standings
            const standingsCycle = computeGameStats(playerStateList, "finishedOnly").standings;
            const lines = standingsCycle.map((row, posNum) => {
                const metaParts = [];    // collect display tags to mirror “incl. bonus” style
                if ((row.bonusSoFar || 0) > 0) metaParts.push(`incl. ${row.bonusSoFar} bonus`);
                if ((row.penaltySoFar || 0) > 0) metaParts.push(`- ${row.penaltySoFar} penalty`);
                const meta = metaParts.length ? `    (${metaParts.join(" ; ")})` : "";
                return `    ${posNum + 1}.   ${row.name}   —   ${row.totalPoints} pts${meta}`;
            }).join("\n");
            await ask.alert(messages.standingsTitle(gameIndex, guessCycleCount) + lines);
        }


        // answers reveal for this game
        const answersText = playerStateList
            .map(p => `    ${p.name}    -->    ${p.targetWord.word.toUpperCase()}    --    ${p.targetWord.definition}`)
            .join("\n\n");
        await ask.alert(messages.answersTitle(gameIndex) + answersText);


        // series aggregation (per game)
        playerStateList.forEach(p => {
            // totals (reusing solo scorer)
            const savedAttempts = gameState.attempts;    // save
            const savedRemaining = gameState.remaining;    // save
            gameState.attempts = p.attempts;    // focus on this player
            gameState.remaining = p.remaining;
            const finalWith = computeUserScore(true).totalPoints;    // includes bonus if eligible
            const finalNo = computeUserScore(false).totalPoints;    // base without bonus
            gameState.attempts = savedAttempts;    // restore actual
            gameState.remaining = savedRemaining;    // restore actual

            const quitPenalty = p.status === "quit"
                ? (p.remainingAtQuit || 0) * config.wordLength * config.pointsValue.correct
                : 0;
            const finalRoundTotal = finalWith - quitPenalty;    // apply penalty at end
            const bonusThisGame = Math.max(0, finalWith - finalNo);    // non-negative  -->  penalties handled separately

            if (!seriesTotals[p.name]) {
                seriesTotals[p.name] = {
                    totalAcrossGames: 0,
                    roundTotals: [],
                    bestAttempt: -Infinity,
                    worstAttempt: Infinity,
                    bonusAcrossGames: 0,    // track bonuses accross games
                    penaltyAcrossGames: 0,    // track penalties across games in this series
                };
            }

            seriesTotals[p.name].totalAcrossGames += finalRoundTotal;    // sum per game
            seriesTotals[p.name].roundTotals.push(finalRoundTotal);    // store per-game total
            seriesTotals[p.name].bonusAcrossGames += bonusThisGame;    // track bonus across games
            seriesTotals[p.name].penaltyAcrossGames += quitPenalty;    // track penalty across games

            if (p.roundPoints.length) {
                const localBest = Math.max(...p.roundPoints);    // best single attempt this game
                const localWorst = Math.min(...p.roundPoints);    // weakest single attempt
                if (localBest > seriesTotals[p.name].bestAttempt) seriesTotals[p.name].bestAttempt = localBest;
                if (localWorst < seriesTotals[p.name].worstAttempt) seriesTotals[p.name].worstAttempt = localWorst;
            }
        });
    } // end series loop


    /* ---------- series summary board (this series only) ---------- */
    const seriesStandings = Object.entries(seriesTotals)
        .map(([name, info]) => ({ name, totalPoints: info.totalAcrossGames }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    const seriesRows = Object.entries(seriesTotals).map(([name, info]) => {
        const roundsPlayed = Math.max(1, info.roundTotals.length);
        const average = info.roundTotals.reduce((a, b) => a + b, 0) / roundsPlayed;
        return {
            name,
            total: info.totalAcrossGames,
            average,
            best:  info.bestAttempt  === -Infinity ? 0 : info.bestAttempt,
            bestAt: 1,
            worst: info.worstAttempt ===  Infinity ? 0 : info.worstAttempt,
            worstAt: 1
        };
    });


    // highlight cards for quick reading (pick first after sorting copies)
    let leaderSingleGame = null;
    for (const [name, info] of Object.entries(seriesTotals)) {
        if (info.roundTotals.length) {
            const points = Math.max(...info.roundTotals);
            const gameAt = info.roundTotals.indexOf(points) + 1;
            if (!leaderSingleGame || points > leaderSingleGame.points) leaderSingleGame = { name, points, gameAt };
        }
    }
    const leaderTotal = seriesRows.slice().sort((a, b) => b.total   - a.total  )[0];
    const leaderAvg   = seriesRows.slice().sort((a, b) => b.average - a.average)[0];
    const leaderBest  = seriesRows.slice().sort((a, b) => b.best    - a.best   )[0];
    const leaderWorst = seriesRows.slice().sort((a, b) => a.worst   - b.worst  )[0];

    const seriesEndSummary = {
        scope: "series",
        standings: seriesStandings,
        leaderSingleGame,
        leaderAvg,
        leaderBest,
        leaderWorst
    };


    /* ---------- roll series into ALL-GAMES cumulative store (for future replays) ---------- */
    Object.entries(seriesTotals).forEach(([name, info]) => {
        if (!gameState.multiAllTotals[name]) {
            gameState.multiAllTotals[name] = {
                totalAcrossGames: 0,
                roundTotals: [],
                bestAttempt: -Infinity,
                worstAttempt: Infinity,
                bonusAcrossGames: 0,
                penaltyAcrossGames: 0,
            };
        }
        gameState.multiAllTotals[name].totalAcrossGames += info.totalAcrossGames;
        gameState.multiAllTotals[name].roundTotals.push(...info.roundTotals);
        gameState.multiAllTotals[name].bestAttempt  = Math.max(gameState.multiAllTotals[name].bestAttempt,  info.bestAttempt);
        gameState.multiAllTotals[name].worstAttempt = Math.min(gameState.multiAllTotals[name].worstAttempt, info.worstAttempt);
        gameState.multiAllTotals[name].bonusAcrossGames   += (info.bonusAcrossGames   || 0);
        gameState.multiAllTotals[name].penaltyAcrossGames += (info.penaltyAcrossGames || 0);
    });


    /* ---------- ALL-GAMES cumulative board (only when prior history exists) ---------- */
    const overallStandings = Object.entries(gameState.multiAllTotals)
        .map(([name, info]) => ({ name, totalPoints: info.totalAcrossGames }))
        .sort((a, b) => b.totalPoints - a.totalPoints);

    const overallRows = Object.entries(gameState.multiAllTotals).map(([name, info]) => {
        const roundsPlayed = Math.max(1, info.roundTotals.length);
        const average = info.roundTotals.reduce((a, b) => a + b, 0) / roundsPlayed;
        return {
            name,
            total: info.totalAcrossGames,
            average,
            best:  info.bestAttempt  === -Infinity ? 0 : info.bestAttempt,
            bestAt: 1,
            worst: info.worstAttempt ===  Infinity ? 0 : info.worstAttempt,
            worstAt: 1
        };
    });

    let overallSingleGame = null;
    for (const [name, info] of Object.entries(gameState.multiAllTotals)) {
        if (info.roundTotals.length) {
            const points = Math.max(...info.roundTotals);
            const gameAt = info.roundTotals.indexOf(points) + 1;
            if (!overallSingleGame || points > overallSingleGame.points) overallSingleGame = { name, points, gameAt };
        }
    }
    const overallLeaderAvg   = overallRows.slice().sort((a, b) => b.average - a.average)[0];
    const overallLeaderBest  = overallRows.slice().sort((a, b) => b.best    - a.best   )[0];
    const overallLeaderWorst = overallRows.slice().sort((a, b) => a.worst   - b.worst  )[0];

    const overallEndSummary = {
        scope: "series",
        standings: overallStandings,
        leaderSingleGame: overallSingleGame,
        leaderAvg:  overallLeaderAvg,
        leaderBest: overallLeaderBest,
        leaderWorst: overallLeaderWorst
    };

    /* ---------- end-of-series displays ---------- */
    await ask.alert(
        messages.seriesTitle(gameState.lastRounds) +
        `Leaderboard  (this series):\n` +
        seriesStandings.map((row, pos) => {
            const bonusAcross   = seriesTotals[row.name]?.bonusAcrossGames   || 0;
            const penaltyAcross = seriesTotals[row.name]?.penaltyAcrossGames || 0;
            const tags = [];
            if (bonusAcross   > 0) tags.push(`incl.  ${bonusAcross}  bonus`);
            if (penaltyAcross > 0) tags.push(`- ${penaltyAcross}  penalty`);
            const note = tags.length ? `   ( ${tags.join(" ; ")} )` : "";
            return `    ${pos + 1}.   ${row.name}  —  ${row.totalPoints}  points${note}`;
        }).join("\n") +
        `\n\n` + messages.statSummary(seriesEndSummary)
    );

    if (hadAnyReplays) {
        await ask.alert(
            messages.cumulativeTitle() +
            overallStandings.map((row, pos) => {
                const bonusAcross   = gameState.multiAllTotals[row.name]?.bonusAcrossGames   || 0;
                const penaltyAcross = gameState.multiAllTotals[row.name]?.penaltyAcrossGames || 0;
                const tags = [];
                if (bonusAcross   > 0) tags.push(`incl.  ${bonusAcross}  bonus`);
                if (penaltyAcross > 0) tags.push(`- ${penaltyAcross}  penalty`);
                const note = tags.length ? `   ( ${tags.join(" ; ")} )` : "";
                return `    ${pos + 1}.   ${row.name}  —  ${row.totalPoints}  points${note}`;
            }).join("\n") +
            `\n\n` + messages.statSummary(overallEndSummary)
        );
    }
}




// ----- button controls on the page (only used when present) -----
function wireControls() {
  const btnStart   = document.getElementById("btn-start");
  const btnRules   = document.getElementById("btn-rules");
  const btnRestart = document.getElementById("btn-restart");

  if (btnStart)   btnStart.addEventListener("click", async () => { btnRestart.hidden = false; await intro(); });
  if (btnRules)   btnRules.addEventListener("click", async () => { await ask.alert(messages.rulesInfo()); });
  if (btnRestart) btnRestart.addEventListener("click", () => window.location.reload());
}




/*  =========================================================
        BOOT UP  -->  actual entry point
    ========================================================= */

if (ENV.isEmbed) {
  // in iframe  -->  don’t auto-run, show the start screen and buttons
  wireControls();
} else {
  // full page  -->  behave like the classic version (auto-runs)
  intro();    // starts the game flow at the welcome → menu  -->  then follows the router paths
}
