"""
history_store.py — Database-backed store for user chat sessions and interaction history.

Persists conversations in the SQLAlchemy `conversations` table in `app.db`.
Maintains backward compatibility with endpoints returning `session_id`, `title`, and `messages`.
"""

import time
from typing import List, Dict, Any, Optional
from db import SessionLocal, Conversation, User


def get_all_sessions(user_id: str = "usr_local_dev") -> List[Dict[str, Any]]:
    """
    Retrieve all sessions for a user, sorted newest to oldest.
    Accepts usr_guest or usr_local_dev seamlessly.
    """
    db = SessionLocal()
    try:
        # Fallback to usr_local_dev if user_id is guest
        query_user = user_id
        if query_user == "usr_guest":
            # Check if user exists or default to usr_local_dev
            dev_user = db.query(User).filter_by(user_id="usr_local_dev").first()
            if dev_user:
                query_user = "usr_local_dev"

        convs = (
            db.query(Conversation)
            .filter(Conversation.user_id.in_([query_user, "usr_guest", "usr_local_dev"]))
            .order_by(Conversation.updated_at.desc())
            .all()
        )

        sessions = []
        for c in convs:
            created_ts = int(c.created_at.timestamp()) if c.created_at else int(time.time())
            updated_ts = int(c.updated_at.timestamp()) if c.updated_at else int(time.time())
            sessions.append({
                "session_id": c.conversation_id,
                "conversation_id": c.conversation_id,
                "title": c.title,
                "created_at": created_ts,
                "updated_at": updated_ts,
                "message_count": len(c.messages) if c.messages else 0
            })
        return sessions
    finally:
        db.close()


def get_session_messages(session_id: str) -> List[Dict[str, Any]]:
    """Get all formatted message items for a specific conversation session."""
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter_by(conversation_id=session_id).first()
        if not conv or not conv.messages:
            return []
        return conv.messages
    finally:
        db.close()


def save_message_to_session(
    session_id: str,
    message_item: Dict[str, Any],
    user_id: str = "usr_local_dev"
) -> None:
    """
    Append a user or assistant message to the conversation thread.
    Creates the conversation record if this is the first turn.
    """
    db = SessionLocal()
    try:
        # Normalize target user to usr_local_dev if guest
        target_user_id = user_id
        if target_user_id == "usr_guest":
            target_user_id = "usr_local_dev"

        # Ensure user exists in users table
        user = db.query(User).filter_by(user_id=target_user_id).first()
        if not user:
            # Fallback to usr_local_dev
            dev_user = db.query(User).filter_by(user_id="usr_local_dev").first()
            if dev_user:
                target_user_id = "usr_local_dev"
            else:
                user = User(
                    user_id=target_user_id,
                    username="Guest User",
                    email="guest@localhost"
                )
                db.add(user)
                db.commit()

        conv = db.query(Conversation).filter_by(conversation_id=session_id).first()

        if not conv:
            # First message sets the title
            raw_title = message_item.get("text", "New Consultation")
            clean_title = raw_title.replace("\n", " ").strip()
            if len(clean_title) > 36:
                clean_title = clean_title[:33] + "..."
            if not clean_title:
                clean_title = "New Consultation"

            conv = Conversation(
                conversation_id=session_id,
                user_id=target_user_id,
                title=clean_title,
                messages=[message_item]
            )
            db.add(conv)
        else:
            # Append new message
            current_msgs = list(conv.messages or [])
            current_msgs.append(message_item)
            conv.messages = current_msgs

        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[history_store] Error saving message to DB: {e}")
    finally:
        db.close()


def delete_session(session_id: str) -> bool:
    """Delete a conversation session and all its messages."""
    db = SessionLocal()
    try:
        conv = db.query(Conversation).filter_by(conversation_id=session_id).first()
        if conv:
            db.delete(conv)
            db.commit()
            return True
        return False
    except Exception as e:
        db.rollback()
        print(f"[history_store] Error deleting session: {e}")
        return False
    finally:
        db.close()
