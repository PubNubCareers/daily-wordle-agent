# Daily Wordle Agent

A reusable Blocks.ai-callable agent for a cheerful Wordle-style 5-letter word guessing game.

## What It Does

- Chooses one secret 5-letter English word.
- Gives the user 6 guesses.
- Scores each valid guess:
  - 🟩 correct letter, correct position
  - 🟨 correct letter, wrong position
  - ⬜ letter not in word
- Validates that guesses are exactly 5 letters.
- Tracks attempts in state.
- Offers a hint after 3 failed guesses.
- Reveals the answer only when the user wins, loses, or asks to reveal it.

## Blocks.ai Input

Call `handleDailyWordle(input)` from `src/dailyWordleAgent.js`.

```json
{
  "action": "start | guess | reveal",
  "guess": "crane",
  "state": {
    "answerToken": "YXBwbGU=",
    "attempts": [],
    "maxAttempts": 6,
    "status": "playing",
    "hintOffered": false
  },
  "options": {
    "secretWord": "apple",
    "words": ["apple", "brave", "crane"]
  }
}
```

### Actions

- `start`: begins a new game.
- `guess`: scores the submitted 5-letter guess.
- `reveal`: reveals the answer and ends the game.

`state` should be passed back into the next call. If no state is provided, the agent starts a new game.

`options.secretWord` is useful for tests or controlled runs. In production, omit it and the agent chooses a deterministic daily word from its word list.

The returned `state` is internal Blocks.ai state. Do not display it to the player. The player-facing answer is only returned in the top-level `answer` field after a win, loss, or reveal request.

## Blocks.ai Output

```json
{
  "message": "🟩⬜⬜🟨⬜ 5 guesses left.",
  "state": {
    "answerToken": "YXBwbGU=",
    "attempts": [
      {
        "guess": "crane",
        "tiles": "⬜⬜⬜⬜🟩",
        "letters": [
          { "letter": "c", "status": "absent", "tile": "⬜" }
        ]
      }
    ],
    "maxAttempts": 6,
    "status": "playing",
    "hintOffered": false
  },
  "attemptsUsed": 1,
  "attemptsRemaining": 5,
  "status": "playing",
  "answer": null
}
```

`answer` is `null` while the game is still in progress. It is only populated after a win, loss, or reveal request.

## Example

```js
import { handleDailyWordle } from "./src/dailyWordleAgent.js";

let result = handleDailyWordle({ action: "start" });
result = handleDailyWordle({
  action: "guess",
  guess: "crane",
  state: result.state
});

console.log(result.message);
```

## Connect To Blocks.ai

The Blocks.ai-ready agent lives in `.blocks/daily_wordle`.

Blocks agents are Python entrypoints, so `.blocks/daily_wordle/main.py` contains a Python wrapper with the same Wordle behavior as the JavaScript module.

Deploy it with the Blocks CLI:

```bash
pip install blocks-sdk
blocks configure --key <your-blocks-api-key>
blocks push .blocks/daily_wordle/main.py
```

After pushing, open the Blocks dashboard, enable the `webhook` event for `daily-wordle-agent`, and copy the generated webhook URL.

Use these payloads:

Start:

```json
{
  "action": "start"
}
```

Guess:

```json
{
  "action": "guess",
  "guess": "crane",
  "state": "<state returned by the previous call>"
}
```

Reveal:

```json
{
  "action": "reveal",
  "state": "<state returned by the previous call>"
}
```

Show `message` to the player. Store and pass back `state` on the next call. The top-level `answer` stays `null` until the player wins, loses, or asks to reveal.

## Play It As A Game

The Blocks page shows raw task output. For non-technical players, use the included game frontend instead.

Open one Terminal window and start the Blocks agent:

```bash
cd "/Users/rama.sudha/Documents/Codex/2026-05-05/create-a-daily-wordle-agent-the"
export PATH="$HOME/.npm-global/bin:$PATH"
blocks run
```

Leave that window open.

Open a second Terminal window and start the game website:

```bash
cd "/Users/rama.sudha/Documents/Codex/2026-05-05/create-a-daily-wordle-agent-the"
npm run game
```

Then open:

```text
http://localhost:4173
```

Players only see the Wordle board, a guess box, hint, reveal, and new game controls. The website stores and sends the Blocks state behind the scenes.
