/*  =========================================================
        🐉  Team Leafy  Sea  Dragons'  word  puzzle  game
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

/* --------------- CLASSIC GAME CONFIGS --------------- */
//  kept sepeately for going back to defaults after custom games  ;  reused in prompts (messages / dialogs)
const classicDefaults = { wordLength: 5, maxGuesses: 6, gameRounds: 1 };




/*  =============================================================
        MESSAGES  —  all dialogs live here (static + dynamic)
    =============================================================
        ✦ define all user-facing text/displays (no hardcoded values)
        ✦ plain strings for fixed phrases  ;  small methods for places that use the 'live' config/state
    -------------------------------------------------------------
*/

const messages = {
    /* ---------------- fixed snippets ---------------- */
    welcome: "Welcome !  Would you like to play a word puzzle game ?",
    startOver: "Good choice !  Welcome back friend  🤗",
    endGame: "Are you sure?\n\n    I bet you had a change of heart...  😉 \n\n( CANCEL / ESC ends the game  👀)",
    endLast: "    💔\nSo sad to see you leave...  \n\nI guess you're not that fun after all.  \n\n...Game window closing... 😂",
    needMorePlayers: "Requires at least 2 players !",

    /* ---------------- menus  (consolidated) ----------------
        phase options: "mode" | "rules" | "post"
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
                "      - quit"
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
            `Each player  (you)  have  ${config.maxGuesses}  tries to guess the hidden  ${config.wordLength}-letter word.\n` +
            `After each guess, the emojis below show how accurate the guess letters are:\n\n` +
            `       ${config.emojis.correct}  -->  right letter in the right spot\n` +
            `       ${config.emojis.almost}  -->  right letter in the wrong spot\n` +
            `       ${config.emojis.incorrect}  -->  letter not in the word\n\n` +
            `Scoring breakdown:  ` +
            `${config.emojis.correct}  =  +${config.pointsValue.correct} \n` +
            `${config.emojis.almost}  =  +${config.pointsValue.almost} \n` +
            `${config.emojis.incorrect}  =  ${config.pointsValue.incorrect} \n` +
            `bonus  =  remaining  *  ${config.wordLength}  *  ${config.pointsValue.correct}`
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
        return "Enter three values  ( wordLength,  maxGuesses,  gameRounds )\n      Example:  5, 6, 3   or   5 6 3";
    },
    promptGroupSetup(modeName, expectedCountOrNull) {
        if (modeName === "solo") {    // optional name for solo  -->  gets stored in the playerNames array
            return "Optional  -->  enter a player name if desired  ( or skip customization and leave blank )";
        }
        if (typeof expectedCountOrNull === "number") {    // naming propmt after getting player count  -->  supports names that include numbers (like a team name)
            return `Enter ${expectedCountOrNull} names (comma or space separated). Teams can use numbers.\n    Example:  Rose, Team7, Kai, 3Musketeers, Amen`;
        }
        return "How many players?  (ex: 2 - 6 recommended)\n\nType 'yes' after the number (player count) to add custom names in the next dialog.\n    Example:  3 yes";    // first multiplayer prompt
    },

    /* ---------------- guess validation messages ----------------
       reason for reprompt  ->  "length" | "unknown"
    */
    invalidGuess(reasonName, info) {
        if (reasonName === "length") {    // print reason inputLen + neededLen + boardText  -->  input is invalid because the length does not match the exact secret game word length (defined in config)
            return (
                `That entry is not the right length.\n` +
                `      Enter exactly ${info.neededLen} characters  ( non letters/numbers are cleaned out ).\n\n` +
                (info.boardText || "")
            );
        }
        // otherwise print reason is an "unknown" word (not in the dictionary being played)
        return (
            `That looks like a word of the right length, but it is not in this game's dictionary.\n` +
            `      Try another word.\n\n` +
            (info.boardText || "")
        );
    },

    /* ---------------- round end text ----------------
       based on game status on exit  -->  "won" | "lost" | "quit"
    */
    outcomeText(statusName, info) {
        if (statusName === "won") {    // shows attempts used  (from gameplay counter)
            return `Victory !  Solved it in  ${info.guessesUsed}  attempt(s).`;
        }
        if (statusName === "lost") {    // takes current game's maxGuesses  (avoid incorrect hardcode from classic setup)
            return `So close !  All  ${config.maxGuesses}  attempts were used.`;
        }
        return "Exit noted  ❌";    // quit
    },

    /* ---------------- shared fragments & titles ---------------- */
    legendLine() {
        return `Legend:\n       Correct  =  ${config.emojis.correct}  ( + ${config.pointsValue.correct}  pts)   ` +
               `Almost  =  ${config.emojis.almost}  ( + ${config.pointsValue.almost}  pts)   ` +
               `Incorrect  =  ${config.emojis.incorrect}  ( ${config.pointsValue.incorrect}  pts)`;
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
            `${gamePrefix}${displayName}  -->  Attempt  ${roundNow}  of  ${roundsTotalAll}\n\n` +
            `Guess:  ${guessWordNow.toUpperCase()}   -->   ${emojiRowNow.join(" ")}\n` +
            `\nScore:  +${pointsNow}  pts` +
            (bonusThisTurn > 0 ? `\nBonus:  +${bonusThisTurn}  pts` : "") +
            `\n      ( ${config.emojis.correct}:  ${correctCount} × ${config.pointsValue.correct},  ` +
            `${config.emojis.almost}:  ${almostCount} × ${config.pointsValue.almost},  ` +
            `${config.emojis.incorrect}:  ${wrongCount} × ${config.pointsValue.incorrect} )\n` +
            `\nTotal  (this game):   ${runningTotalNoBonus + bonusLockedSoFar}  pts` +
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
        return `${name}  solved theirs !  -->  skipping remaining guesses...\n\nThis game:    ${totalWithBonus}  points` + (lockedBonus > 0 ? `   ( incl.  ${lockedBonus}  bonus )` : "") + allLine;
    },
    quitSkipNotice(name, totalNoBonus, penalty, hadReplaysYes, runningAllWithPenalty) {
        const allLine = hadReplaysYes ? `\n\nAll games (with current penalty):      ${runningAllWithPenalty}  points` : "";
        return `${name}  quit this game  😢  -->  skipping remaining guesses...\n\nThis game:    ${totalNoBonus}  points\nQuit penalty:   - ${penalty}  points` + allLine;
    },

    /* ---------------- session / series summary ---------------- */
    statSummary(objOrArr) {
        // multi / series or mid-game objects have standings
        if (objOrArr && objOrArr.standings) {    // detect multi summaries
            const scores = objOrArr;    // alias for readability
            const avgLabel = scores.scope === "series" ? "Average Game" : "Average Guess";    // wording changes depending on scope

            const firstLine = scores.leaderSingleGame
                ? `Best Game:                 ${scores.leaderSingleGame.name}    ( ${scores.leaderSingleGame.points}  points  in  Game  ${scores.leaderSingleGame.gameAt} )`
                : `Running Total:        ${scores.leaderTotal.name}        ( ${scores.leaderTotal.total}  points )`;

            const bestAttemptLine = scores.scope === "series"
                ? `Best Attempt:              ${scores.leaderBest.name}     ( ${scores.leaderBest.best}  points )`
                : `Best Attempt:              ${scores.leaderBest.name}     ( Attempt  ${scores.leaderBest.bestAt}  -->  ${scores.leaderBest.best}  points )`;

            const worstAttemptLine = scores.scope === "series"
                ? `Weakest Attempt:       ${scores.leaderWorst.name}     ( ${scores.leaderWorst.worst}  points )`
                : `Weakest Attempt:       ${scores.leaderWorst.name}     ( Attempt ${scores.leaderWorst.worstAt} -->  ${scores.leaderWorst.worst}  points )`;

            return (
                `${firstLine}\n` +
                `${avgLabel}:           ${scores.leaderAvg.name}    ( ${parseFloat(scores.leaderAvg.average.toFixed(2))}  points )\n` +
                `${bestAttemptLine}\n` +
                `${worstAttemptLine}`
            );
        }

        // SOLO session summary  -->  array of round totals
        if (Array.isArray(objOrArr)) {
            const rounds = objOrArr;    // alias  -->  expected as array of game totals
            if (rounds.length < 2) return "";    // only show if 2+ rounds

            const totals = rounds.map(r => r.totalPoints);    // pull out an array of numeric totals
            const roundsPlayed = totals.length;    // length of totals  ( used for avg )
            const totalPointsAll = totals.reduce((a, b) => a + b, 0);    // sum all points ( start at 0 )
            const averagePoints = parseFloat((totalPointsAll / roundsPlayed).toFixed(2));    // format to 2 decimals and remove whitespeace ( leading/trailing zeros )

            const bestRoundPoints = Math.max(...totals);    // highest total using the whole array
            const worstRoundPoints = Math.min(...totals);    // lowest total  ;  same spread approach
            const bestRoundAt = totals.indexOf(bestRoundPoints) + 1;    // convert to human friendly ( 1-based index )
            const worstRoundAt = totals.indexOf(worstRoundPoints) + 1;    // same idea here

            return `SESSION   SUMMARY    -->    ${roundsPlayed}  rounds

        Total:                           ${totalPointsAll}  points
        Average Game:           ${averagePoints}  points
        Best Game:                 ${bestRoundPoints}  points   ( Game  ${bestRoundAt} )
        Weakest Game:          ${worstRoundPoints}  points   ( Game  ${worstRoundAt} )`;
        }

        // single round summary object
        const gameScore = objOrArr;    // single game’s stats  / per-game summary
        return `Score Summary:
        Guess  Points:     ${gameScore.guessesPoints}
        Bonus  Points:     ${gameScore.unusedGuessPoints}
        Total  Points:        ${gameScore.totalPoints}`;
    },
};




/*  ============================================================
        DICTIONARY  —  demo + optional external
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

const activeDictionary = Array.isArray(window.dictionaryData) && window.dictionaryData.length    // check type then non-empty  -->  only switch if real data exists (loaded correctly)
    ? window.dictionaryData    // prefer external list when available  (portfolio mode)
    : demoDictionary;    // fallback to local demo / dev version




/*  =============================================================================
        HELPERS  —  safe word length clamp, word picker, custom config parser
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
        VALIDATION  —  clean → check length → check dictionary (recursion)
    ===========================================================================
        ✦ keep the player inside one friendly question until the input is valid or canceled
            • function calls itself again when a retry is needed  -->  keeps the same board context visible for guidance
            • cancel/ESC returns null so the caller can confirm quitting on this game word
*/
function validateGuess(inputLine, boardTextForRetry) {
    if (inputLine === null) return null;    // cancel/Esc  -->  pass to caller to confirm

    const cleanedGuess = inputLine.toLowerCase().replace(/[^a-z0-9]/g, "");    // format to lowercase (same as dictionary) + strip to letters/numbers  ;  also used to normalize team names and words
    const isRightLength = (cleanedGuess.length === config.wordLength);    // exact length check  -->  based on current config
    const isInDictionary = activeDictionary.some(entry => entry.word === cleanedGuess);    // enforce membership in game dictionary  (may be a real word but it may not be in the game)  ;  .some() stops early when found

    if (!isRightLength) {    // player input is the wrong length  -->  shows exact target length for clarity
        const nextInput = prompt(messages.invalidGuess("length", { inputLen: cleanedGuess.length, neededLen: config.wordLength, boardText: boardTextForRetry }));    // clearly explains the explected size
        return validateGuess(nextInput, boardTextForRetry);    // recursive retry  with the  same game board for context
    }

    if (!isInDictionary) {    // input is the correct length but an unknown word (not in game's dictionary)
        const nextInput = prompt(messages.invalidGuess("unknown", { cleanWord: cleanedGuess, boardText: boardTextForRetry }));    // encourage another try
        return validateGuess(nextInput, boardTextForRetry);    // recursive retry
    }

    return cleanedGuess;    // valid and clean  -->  ready for scoring
}
