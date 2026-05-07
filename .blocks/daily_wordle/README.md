# Daily Wordle Blocks.ai Agent

This folder is ready to push to Blocks.ai as a webhook-triggered agent.

## Files

- `main.py`: Blocks.ai entrypoint. Exposes `daily_wordle(event)`.
- `requirements.txt`: Blocks dependency list.
- `sample-start.json`: Starts a new game.
- `sample-guess.json`: Example follow-up guess payload.

## Deploy

Install and configure the Blocks CLI:

```bash
pip install blocks-sdk
blocks configure --key <your-blocks-api-key>
```

Push the agent:

```bash
blocks push .blocks/daily_wordle/main.py
```

Then open the Blocks dashboard and enable the `webhook` event for `daily-wordle-agent`. Blocks will provide a unique webhook URL.

## Call Shape

Start a game:

```json
{
  "action": "start"
}
```

Make a guess:

```json
{
  "action": "guess",
  "guess": "crane",
  "state": {
    "answerToken": "YXBwbGU=",
    "attempts": [],
    "maxAttempts": 6,
    "status": "playing",
    "hintOffered": false
  }
}
```

Reveal the answer:

```json
{
  "action": "reveal",
  "state": {
    "answerToken": "YXBwbGU=",
    "attempts": [],
    "maxAttempts": 6,
    "status": "playing",
    "hintOffered": false
  }
}
```

Always pass the returned `state` into the next call. Display `message` to the player. Display `answer` only when it is not `null`.
