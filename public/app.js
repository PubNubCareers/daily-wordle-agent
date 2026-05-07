const board = document.querySelector('#board');
const form = document.querySelector('#guess-form');
const input = document.querySelector('#guess-input');
const message = document.querySelector('#message');
const submit = document.querySelector('#submit');
const newGame = document.querySelector('#new-game');
const hint = document.querySelector('#hint');
const reveal = document.querySelector('#reveal');

let gameState = null;
let lastHint = '';

renderBoard([]);
startGame();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const guess = input.value.trim().toLowerCase();

  if (!/^[a-z]{5}$/.test(guess)) {
    setMessage('Please enter exactly 5 letters.');
    input.focus();
    return;
  }

  await sendAction({ action: 'guess', guess, state: gameState });
  input.value = '';
  input.focus();
});

newGame.addEventListener('click', startGame);

hint.addEventListener('click', () => {
  setMessage(lastHint || 'Hints appear after 3 guesses. Keep going!');
});

reveal.addEventListener('click', async () => {
  await sendAction({ action: 'reveal', state: gameState });
});

input.addEventListener('input', () => {
  input.value = input.value.replace(/[^a-zA-Z]/g, '').slice(0, 5).toUpperCase();
});

async function startGame() {
  gameState = null;
  lastHint = '';
  await sendAction({ action: 'start' });
  input.focus();
}

async function sendAction(payload) {
  setBusy(true);
  try {
    const response = await fetch('/api/wordle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Could not reach the Wordle agent.');
    }

    gameState = result.state;
    lastHint = extractHint(result.message) || lastHint;
    renderBoard(result.state?.attempts ?? []);
    setMessage(result.message);
    updateControls(result);
  } catch (error) {
    const text = error instanceof Error ? error.message : 'Something went wrong.';
    setMessage(text);
  } finally {
    setBusy(false);
  }
}

function renderBoard(attempts) {
  board.innerHTML = '';

  for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
    const row = document.createElement('div');
    row.className = 'row';

    const attempt = attempts[rowIndex];
    for (let columnIndex = 0; columnIndex < 5; columnIndex += 1) {
      const tile = document.createElement('div');
      const letter = attempt?.letters?.[columnIndex];
      tile.className = `tile ${letter?.status ?? ''}`;
      tile.textContent = letter?.letter ?? '';
      row.append(tile);
    }

    board.append(row);
  }
}

function setMessage(text) {
  message.textContent = text;
}

function setBusy(isBusy) {
  submit.disabled = isBusy;
  newGame.disabled = isBusy;
  reveal.disabled = isBusy || !gameState;
  input.disabled = isBusy;
}

function updateControls(result) {
  const isFinished = ['won', 'lost', 'revealed'].includes(result.status);
  submit.disabled = isFinished;
  input.disabled = isFinished;
  reveal.disabled = isFinished;
}

function extractHint(text) {
  const index = text.indexOf('Hint:');
  return index >= 0 ? text.slice(index) : '';
}
