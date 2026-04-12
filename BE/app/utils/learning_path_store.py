import json
from pathlib import Path
from datetime import datetime

#FILE_PATH = Path(__file__).resolve().parent.parent / "data" / "pushed_learning_paths.json"
FILE_PATH = Path(__file__).resolve().parents[2] / "data" / "pushed_learning_paths.json"


def read_store():
    """
    Safely read JSON store
    """
    if not FILE_PATH.exists():
        return {}

    try:
        with open(FILE_PATH, "r") as f:
            content = f.read().strip()
            if not content:
                return {}
            return json.loads(content)
    except Exception:
        # Corrupt file fallback
        return {}


def write_store(data):
    """
    Write JSON store safely
    """
    FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    print(f"[STORE DEBUG] FILE_PATH: {FILE_PATH}")

    with open(FILE_PATH, "w") as f:
        json.dump(data, f, indent=2)


def save_learning_path(email: str, session_id: str, topic: str, courses: list):
    """
    Save or replace learning path for a user
    """
    store = read_store()

    store[email] = {
        "session_id": session_id,
        "topic": topic,
        "recommended_courses": courses,
        "pushed_at": datetime.utcnow().isoformat()
    }

    write_store(store)


def get_learning_path(email: str):
    """
    Retrieve learning path for a user
    """
    store = read_store()
    return store.get(email)