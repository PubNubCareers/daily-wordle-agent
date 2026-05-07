const DEFAULT_WORDS = [
  "apple",
  "brave",
  "crane",
  "delta",
  "eagle",
  "flame",
  "grape",
  "heart",
  "ivory",
  "jolly",
  "knife",
  "lemon",
  "mango",
  "noble",
  "ocean",
  "pearl",
  "queen",
  "rider",
  "stone",
  "tiger",
  "unity",
  "vivid",
  "whale",
  "xenon",
  "young",
  "zesty"
];

const MAX_ATTEMPTS = 6;
const WORD_LENGTH = 5;
const TILE = {
  correct: "🟩",
  present: "🟨",
  absent: "⬜"
};

export function createInitialState(options = {}) {
  options = options ?? {};
  const words = normalizeWordList(options.words ?? DEFAULT_WORDS);
  const secretWord = normalizeSecret(options.secretWord, words);

  return {
    secretWord,
    attempts: [],
    maxAttempts: MAX_ATTEMPTS,
    status: "playing",
    hintOffered: false
  };
}

export function handleDailyWordle(input = {}) {
  const action = input.action ?? "guess";
  const state = normalizeState(input.state);

  if (action === "start") {
    const nextState = createInitialState(input.options);
    return buildResponse({
      state: nextState,
      message: "Daily Wordle is ready. Guess a 5-letter word!",
      revealAnswer: false
    });
  }

  if (!state) {
    const nextState = createInitialState(input.options);
    if (action === "guess" && normalizeGuess(input.guess)) {
      return handleDailyWordle({
        ...input,
        state: nextState
      });
    }

    return buildResponse({
      state: nextState,
      message: "New Daily Wordle started. Guess a 5-letter word!",
      revealAnswer: false
    });
  }

  if (action === "reveal") {
    return buildResponse({
      state: { ...state, status: "revealed" },
      message: `The answer is ${state.secretWord.toUpperCase()}. Nice try!`,
      revealAnswer: true
    });
  }

  if (state.status !== "playing") {
    return buildResponse({
      state,
      message: finalMessageFor(state),
      revealAnswer: true
    });
  }

  if (action !== "guess") {
    return buildResponse({
      state,
      message: "Please send a 5-letter guess, or ask to reveal the answer.",
      revealAnswer: false
    });
  }

  const guess = normalizeGuess(input.guess);
  if (!guess) {
    return buildResponse({
      state,
      message: "Please guess exactly 5 letters.",
      revealAnswer: false
    });
  }

  const scoredGuess = scoreGuess(guess, state.secretWord);
  const attempts = [...state.attempts, scoredGuess];
  const won = guess === state.secretWord;
  const lost = !won && attempts.length >= state.maxAttempts;
  const nextState = {
    ...state,
    attempts,
    status: won ? "won" : lost ? "lost" : "playing"
  };

  const shouldOfferHint = !won && !lost && attempts.length >= 3 && !state.hintOffered;
  if (shouldOfferHint) {
    nextState.hintOffered = true;
  }

  return buildResponse({
    state: nextState,
    message: buildGuessMessage(nextState, scoredGuess, shouldOfferHint),
    revealAnswer: won || lost
  });
}

export function scoreGuess(guess, secretWord) {
  const normalizedGuess = normalizeGuess(guess);
  const normalizedSecret = normalizeSecret(secretWord);
  if (!normalizedGuess) {
    throw new Error("Guess must be exactly 5 letters.");
  }

  const statuses = Array(WORD_LENGTH).fill("absent");
  const remaining = {};

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    if (normalizedGuess[index] === normalizedSecret[index]) {
      statuses[index] = "correct";
    } else {
      remaining[normalizedSecret[index]] = (remaining[normalizedSecret[index]] ?? 0) + 1;
    }
  }

  for (let index = 0; index < WORD_LENGTH; index += 1) {
    const letter = normalizedGuess[index];
    if (statuses[index] === "correct") {
      continue;
    }
    if (remaining[letter] > 0) {
      statuses[index] = "present";
      remaining[letter] -= 1;
    }
  }

  return {
    guess: normalizedGuess,
    tiles: statuses.map((status) => TILE[status]).join(""),
    letters: normalizedGuess.split("").map((letter, index) => ({
      letter,
      status: statuses[index],
      tile: TILE[statuses[index]]
    }))
  };
}

function buildGuessMessage(state, scoredGuess, shouldOfferHint) {
  if (state.status === "won") {
    return `${scoredGuess.tiles} You got it in ${state.attempts.length}/${state.maxAttempts}! The answer was ${state.secretWord.toUpperCase()}.`;
  }

  if (state.status === "lost") {
    return `${scoredGuess.tiles} Good game! The answer was ${state.secretWord.toUpperCase()}.`;
  }

  const remaining = state.maxAttempts - state.attempts.length;
  const hint = shouldOfferHint ? ` Hint: ${makeHint(state.secretWord)}` : "";
  return `${scoredGuess.tiles} ${remaining} guesses left.${hint}`;
}

function makeHint(secretWord) {
  return `the word starts with ${secretWord[0].toUpperCase()} and ends with ${secretWord[WORD_LENGTH - 1].toUpperCase()}.`;
}

function buildResponse({ state, message, revealAnswer }) {
  return {
    message,
    state: publicState(state, revealAnswer),
    attemptsUsed: state.attempts.length,
    attemptsRemaining: state.maxAttempts - state.attempts.length,
    status: state.status,
    answer: revealAnswer ? state.secretWord : null
  };
}

function publicState(state, revealAnswer) {
  return {
    answerToken: encodeAnswer(state.secretWord),
    secretWord: revealAnswer ? state.secretWord : undefined,
    attempts: state.attempts,
    maxAttempts: state.maxAttempts,
    status: state.status,
    hintOffered: state.hintOffered
  };
}

function normalizeState(state) {
  if (!state || typeof state !== "object" || (!state.secretWord && !state.answerToken)) {
    return null;
  }

  return {
    secretWord: normalizeSecret(state.secretWord ?? decodeAnswer(state.answerToken)),
    attempts: Array.isArray(state.attempts) ? state.attempts : [],
    maxAttempts: Number.isInteger(state.maxAttempts) ? state.maxAttempts : MAX_ATTEMPTS,
    status: state.status ?? "playing",
    hintOffered: Boolean(state.hintOffered)
  };
}

function normalizeGuess(guess) {
  if (typeof guess !== "string") {
    return null;
  }

  const normalized = guess.trim().toLowerCase();
  return /^[a-z]{5}$/.test(normalized) ? normalized : null;
}

function normalizeSecret(secretWord, fallbackWords = DEFAULT_WORDS) {
  if (typeof secretWord === "string" && /^[a-zA-Z]{5}$/.test(secretWord.trim())) {
    return secretWord.trim().toLowerCase();
  }

  const words = normalizeWordList(fallbackWords);
  return words[getDailyWordIndex(words.length)];
}

function normalizeWordList(words) {
  const normalized = words
    .map((word) => (typeof word === "string" ? word.trim().toLowerCase() : ""))
    .filter((word) => /^[a-z]{5}$/.test(word));

  if (normalized.length === 0) {
    throw new Error("Word list must include at least one 5-letter English word.");
  }

  return normalized;
}

function getDailyWordIndex(wordCount) {
  const today = new Date().toISOString().slice(0, 10);
  let hash = 0;
  for (const character of today) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % wordCount;
}

function finalMessageFor(state) {
  if (state.status === "won") {
    return `You already won! The answer was ${state.secretWord.toUpperCase()}.`;
  }

  if (state.status === "lost") {
    return `Game over. The answer was ${state.secretWord.toUpperCase()}.`;
  }

  return `The answer is ${state.secretWord.toUpperCase()}.`;
}

function encodeAnswer(secretWord) {
  return Buffer.from(secretWord, "utf8").toString("base64");
}

function decodeAnswer(answerToken) {
  if (typeof answerToken !== "string") {
    return null;
  }

  try {
    return Buffer.from(answerToken, "base64").toString("utf8");
  } catch {
    return null;
  }
}
