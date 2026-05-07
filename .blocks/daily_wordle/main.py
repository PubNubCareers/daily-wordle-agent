from __future__ import annotations

import base64
import datetime as dt
import re
from typing import Any

try:
    from blocks import agent, on
except ImportError:
    def agent(**_kwargs):
        def decorator(func):
            return func

        return decorator

    def on(*_args, **_kwargs):
        def decorator(func):
            return func

        return decorator


DEFAULT_WORDS = [
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
    "zesty",
]

MAX_ATTEMPTS = 6
WORD_LENGTH = 5
TILE = {
    "correct": "🟩",
    "present": "🟨",
    "absent": "⬜",
}


@agent(name="daily-wordle-agent", runtime="python3.12")
@on("webhook")
def daily_wordle(event: dict[str, Any]) -> dict[str, Any]:
    """Blocks.ai webhook entrypoint."""
    return handle_daily_wordle(event or {})


def handle_daily_wordle(input_data: dict[str, Any]) -> dict[str, Any]:
    action = input_data.get("action", "guess")
    state = normalize_state(input_data.get("state"))

    if action == "start":
        next_state = create_initial_state(input_data.get("options"))
        return build_response(
            state=next_state,
            message="Daily Wordle is ready. Guess a 5-letter word!",
            reveal_answer=False,
        )

    if state is None:
        next_state = create_initial_state(input_data.get("options"))
        return build_response(
            state=next_state,
            message="New Daily Wordle started. Guess a 5-letter word!",
            reveal_answer=False,
        )

    if action == "reveal":
        revealed_state = {**state, "status": "revealed"}
        return build_response(
            state=revealed_state,
            message=f"The answer is {state['secretWord'].upper()}. Nice try!",
            reveal_answer=True,
        )

    if state["status"] != "playing":
        return build_response(
            state=state,
            message=final_message_for(state),
            reveal_answer=True,
        )

    if action != "guess":
        return build_response(
            state=state,
            message="Please send a 5-letter guess, or ask to reveal the answer.",
            reveal_answer=False,
        )

    guess = normalize_guess(input_data.get("guess"))
    if guess is None:
        return build_response(
            state=state,
            message="Please guess exactly 5 letters.",
            reveal_answer=False,
        )

    scored_guess = score_guess(guess, state["secretWord"])
    attempts = [*state["attempts"], scored_guess]
    won = guess == state["secretWord"]
    lost = not won and len(attempts) >= state["maxAttempts"]

    next_state = {
        **state,
        "attempts": attempts,
        "status": "won" if won else "lost" if lost else "playing",
    }

    should_offer_hint = (
        not won
        and not lost
        and len(attempts) >= 3
        and not state["hintOffered"]
    )
    if should_offer_hint:
        next_state["hintOffered"] = True

    return build_response(
        state=next_state,
        message=build_guess_message(next_state, scored_guess, should_offer_hint),
        reveal_answer=won or lost,
    )


def create_initial_state(options: dict[str, Any] | None = None) -> dict[str, Any]:
    options = options or {}
    words = normalize_word_list(options.get("words", DEFAULT_WORDS))
    secret_word = normalize_secret(options.get("secretWord"), words)

    return {
        "secretWord": secret_word,
        "attempts": [],
        "maxAttempts": MAX_ATTEMPTS,
        "status": "playing",
        "hintOffered": False,
    }


def score_guess(guess: str, secret_word: str) -> dict[str, Any]:
    normalized_guess = normalize_guess(guess)
    normalized_secret = normalize_secret(secret_word)
    if normalized_guess is None:
        raise ValueError("Guess must be exactly 5 letters.")

    statuses = ["absent"] * WORD_LENGTH
    remaining: dict[str, int] = {}

    for index in range(WORD_LENGTH):
        if normalized_guess[index] == normalized_secret[index]:
            statuses[index] = "correct"
        else:
            letter = normalized_secret[index]
            remaining[letter] = remaining.get(letter, 0) + 1

    for index in range(WORD_LENGTH):
        letter = normalized_guess[index]
        if statuses[index] == "correct":
            continue
        if remaining.get(letter, 0) > 0:
            statuses[index] = "present"
            remaining[letter] -= 1

    return {
        "guess": normalized_guess,
        "tiles": "".join(TILE[status] for status in statuses),
        "letters": [
            {
                "letter": letter,
                "status": statuses[index],
                "tile": TILE[statuses[index]],
            }
            for index, letter in enumerate(normalized_guess)
        ],
    }


def build_guess_message(
    state: dict[str, Any],
    scored_guess: dict[str, Any],
    should_offer_hint: bool,
) -> str:
    if state["status"] == "won":
        return (
            f"{scored_guess['tiles']} You got it in "
            f"{len(state['attempts'])}/{state['maxAttempts']}! "
            f"The answer was {state['secretWord'].upper()}."
        )

    if state["status"] == "lost":
        return f"{scored_guess['tiles']} Good game! The answer was {state['secretWord'].upper()}."

    remaining = state["maxAttempts"] - len(state["attempts"])
    hint = f" Hint: {make_hint(state['secretWord'])}" if should_offer_hint else ""
    return f"{scored_guess['tiles']} {remaining} guesses left.{hint}"


def make_hint(secret_word: str) -> str:
    return (
        f"the word starts with {secret_word[0].upper()} "
        f"and ends with {secret_word[WORD_LENGTH - 1].upper()}."
    )


def build_response(
    state: dict[str, Any],
    message: str,
    reveal_answer: bool,
) -> dict[str, Any]:
    return {
        "message": message,
        "state": public_state(state, reveal_answer),
        "attemptsUsed": len(state["attempts"]),
        "attemptsRemaining": state["maxAttempts"] - len(state["attempts"]),
        "status": state["status"],
        "answer": state["secretWord"] if reveal_answer else None,
    }


def public_state(state: dict[str, Any], reveal_answer: bool) -> dict[str, Any]:
    public = {
        "answerToken": encode_answer(state["secretWord"]),
        "attempts": state["attempts"],
        "maxAttempts": state["maxAttempts"],
        "status": state["status"],
        "hintOffered": state["hintOffered"],
    }
    if reveal_answer:
        public["secretWord"] = state["secretWord"]
    return public


def normalize_state(state: Any) -> dict[str, Any] | None:
    if not isinstance(state, dict) or not (state.get("secretWord") or state.get("answerToken")):
        return None

    return {
        "secretWord": normalize_secret(state.get("secretWord") or decode_answer(state.get("answerToken"))),
        "attempts": state.get("attempts") if isinstance(state.get("attempts"), list) else [],
        "maxAttempts": state.get("maxAttempts") if isinstance(state.get("maxAttempts"), int) else MAX_ATTEMPTS,
        "status": state.get("status", "playing"),
        "hintOffered": bool(state.get("hintOffered")),
    }


def normalize_guess(guess: Any) -> str | None:
    if not isinstance(guess, str):
        return None

    normalized = guess.strip().lower()
    return normalized if re.fullmatch(r"[a-z]{5}", normalized) else None


def normalize_secret(secret_word: Any, fallback_words: list[str] | None = None) -> str:
    if isinstance(secret_word, str) and re.fullmatch(r"[a-zA-Z]{5}", secret_word.strip()):
        return secret_word.strip().lower()

    words = normalize_word_list(fallback_words or DEFAULT_WORDS)
    return words[get_daily_word_index(len(words))]


def normalize_word_list(words: list[Any]) -> list[str]:
    normalized = [
        word.strip().lower()
        for word in words
        if isinstance(word, str) and re.fullmatch(r"[a-z]{5}", word.strip().lower())
    ]
    if not normalized:
        raise ValueError("Word list must include at least one 5-letter English word.")
    return normalized


def get_daily_word_index(word_count: int) -> int:
    today = dt.datetime.now(dt.timezone.utc).date().isoformat()
    word_hash = 0
    for character in today:
        word_hash = (word_hash * 31 + ord(character)) & 0xFFFFFFFF
    return word_hash % word_count


def final_message_for(state: dict[str, Any]) -> str:
    if state["status"] == "won":
        return f"You already won! The answer was {state['secretWord'].upper()}."

    if state["status"] == "lost":
        return f"Game over. The answer was {state['secretWord'].upper()}."

    return f"The answer is {state['secretWord'].upper()}."


def encode_answer(secret_word: str) -> str:
    return base64.b64encode(secret_word.encode("utf-8")).decode("utf-8")


def decode_answer(answer_token: Any) -> str | None:
    if not isinstance(answer_token, str):
        return None

    try:
        return base64.b64decode(answer_token.encode("utf-8")).decode("utf-8")
    except Exception:
        return None
