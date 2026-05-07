import assert from "node:assert/strict";
import { handleDailyWordle, scoreGuess } from "../src/dailyWordleAgent.js";

const duplicateScore = scoreGuess("allee", "apple");
assert.equal(duplicateScore.tiles, "🟩🟨⬜⬜🟩");

let response = handleDailyWordle({
  action: "start",
  options: { secretWord: "crane" }
});
assert.equal(response.status, "playing");
assert.equal(response.answer, null);

const firstGuessWithoutState = handleDailyWordle({
  action: "guess",
  guess: "trunk",
  options: null
});
assert.equal(firstGuessWithoutState.status, "playing");
assert.equal(firstGuessWithoutState.attemptsUsed, 1);
assert.equal(firstGuessWithoutState.state.attempts[0].guess, "trunk");
assert.equal(firstGuessWithoutState.answer, null);

response = handleDailyWordle({
  action: "guess",
  guess: "bad",
  state: response.state
});
assert.equal(response.message, "Please guess exactly 5 letters.");
assert.equal(response.attemptsUsed, 0);

response = handleDailyWordle({
  action: "guess",
  guess: "slate",
  state: response.state
});
assert.equal(response.attemptsUsed, 1);
assert.equal(response.answer, null);

response = handleDailyWordle({
  action: "guess",
  guess: "proud",
  state: response.state
});
response = handleDailyWordle({
  action: "guess",
  guess: "fling",
  state: response.state
});
assert.match(response.message, /Hint:/);
assert.equal(response.state.hintOffered, true);

response = handleDailyWordle({
  action: "guess",
  guess: "crane",
  state: response.state
});
assert.equal(response.status, "won");
assert.equal(response.answer, "crane");
assert.match(response.message, /You got it/);

let losingGame = handleDailyWordle({
  action: "start",
  options: { secretWord: "zesty" }
});
for (const guess of ["apple", "brave", "crane", "flame", "mango", "rider"]) {
  losingGame = handleDailyWordle({
    action: "guess",
    guess,
    state: losingGame.state
  });
}
assert.equal(losingGame.status, "lost");
assert.equal(losingGame.answer, "zesty");

const revealed = handleDailyWordle({
  action: "reveal",
  state: handleDailyWordle({ action: "start", options: { secretWord: "ocean" } }).state
});
assert.equal(revealed.status, "revealed");
assert.equal(revealed.answer, "ocean");

console.log("Daily Wordle agent tests passed.");
