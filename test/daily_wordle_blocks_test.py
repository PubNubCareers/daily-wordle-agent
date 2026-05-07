import importlib.util
from pathlib import Path


module_path = Path(__file__).resolve().parents[1] / ".blocks" / "daily_wordle" / "main.py"
spec = importlib.util.spec_from_file_location("daily_wordle_blocks", module_path)
daily_wordle_blocks = importlib.util.module_from_spec(spec)
spec.loader.exec_module(daily_wordle_blocks)


def test_blocks_wordle_flow():
    response = daily_wordle_blocks.daily_wordle(
        {"action": "start", "options": {"secretWord": "crane"}}
    )
    assert response["status"] == "playing"
    assert response["answer"] is None

    response = daily_wordle_blocks.daily_wordle(
        {"action": "guess", "guess": "bad", "state": response["state"]}
    )
    assert response["message"] == "Please guess exactly 5 letters."
    assert response["attemptsUsed"] == 0

    response = daily_wordle_blocks.daily_wordle(
        {"action": "guess", "guess": "slate", "state": response["state"]}
    )
    response = daily_wordle_blocks.daily_wordle(
        {"action": "guess", "guess": "proud", "state": response["state"]}
    )
    response = daily_wordle_blocks.daily_wordle(
        {"action": "guess", "guess": "fling", "state": response["state"]}
    )
    assert "Hint:" in response["message"]

    response = daily_wordle_blocks.daily_wordle(
        {"action": "guess", "guess": "crane", "state": response["state"]}
    )
    assert response["status"] == "won"
    assert response["answer"] == "crane"


if __name__ == "__main__":
    test_blocks_wordle_flow()
    print("Blocks Daily Wordle agent test passed.")
