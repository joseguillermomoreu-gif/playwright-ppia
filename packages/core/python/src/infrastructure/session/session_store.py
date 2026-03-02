from __future__ import annotations

from src.domain.model.session import Session


class SessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, Session] = {}

    def create(self, objective: str = "") -> Session:
        session = Session(objective=objective)
        self._sessions[session.id] = session
        return session

    def get(self, session_id: str) -> Session | None:
        return self._sessions.get(session_id)

    def close(self, session_id: str) -> bool:
        return self._sessions.pop(session_id, None) is not None
