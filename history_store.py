"""
history_store.py — JSON-based store for user chat sessions and interaction history.
Maintains session metadata (title, timestamps) and detailed message logs for full multi-turn context.
"""

import os
import json
import time
from typing import List, Dict, Any, Optional

HISTORY_FILE_PATH = os.path.join(os.path.dirname(__file__), "chat_history.json")


def _read_db() -> Dict[str, Any]:
    if not os.path.exists(HISTORY_FILE_PATH):
        return {"sessions": {}, "messages": {}}
    try:
        with open(HISTORY_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"sessions": {}, "messages": {}}


def _write_db(data: Dict[str, Any]) -> None:
    try:
        with open(HISTORY_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"[history_store] Error saving history: {e}")


def get_all_sessions(user_id: str = "usr_guest") -> List[Dict[str, Any]]:
    """Retrieve all sessions for a user, sorted newest to oldest."""
    db = _read_db()
    sessions = []
    for s_id, s_data in db.get("sessions", {}).items():
        if s_data.get("user_id", "usr_guest") == user_id:
            sessions.append({
                "session_id": s_id,
                "title": s_data.get("title", "New Consultation"),
                "created_at": s_data.get("created_at", int(time.time())),
                "updated_at": s_data.get("updated_at", int(time.time())),
                "message_count": len(db.get("messages", {}).get(s_id, []))
            })
    # Sort descending by updated_at
    sessions.sort(key=lambda x: x["updated_at"], reverse=True)
    return sessions


def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    """Get all formatted message items for a session."""
    db = _read_db()
    return db.get("messages", {}).get(session_id, [])


def save_message_to_session(session_id: str, message_item: Dict[str, Any], user_id: str = "usr_guest") -> None:
    """Save a user or assistant message to the session."""
    db = _read_db()
    if "sessions" not in db:
        db["sessions"] = {}
    if "messages" not in db:
        db["messages"] = {}

    current_time = int(time.time())

    # Create session entry if not exists
    if session_id not in db["sessions"]:
        # Derive initial title from first user message if possible
        raw_title = message_item.get("text", "New Consultation")
        # Clean title: truncate and sanitize
        clean_title = raw_title.replace("\n", " ").strip()
        if len(clean_title) > 36:
            clean_title = clean_title[:33] + "..."
        if not clean_title:
            clean_title = "New Consultation"

        db["sessions"][session_id] = {
            "session_id": session_id,
            "user_id": user_id,
            "title": clean_title,
            "created_at": current_time,
            "updated_at": current_time
        }
    else:
        db["sessions"][session_id]["updated_at"] = current_time

    # Append message
    if session_id not in db["messages"]:
        db["messages"][session_id] = []
    
    db["messages"][session_id].append(message_item)
    _write_db(db)


def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages."""
    db = _read_db()
    changed = False
    if session_id in db.get("sessions", {}):
        del db["sessions"][session_id]
        changed = True
    if session_id in db.get("messages", {}):
        del db["messages"][session_id]
        changed = True
    if changed:
        _write_db(db)
    return changed
