from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.application.use_cases.explore.explore_use_case import ExploreUseCase
from src.domain.model.session import Session
from src.infrastructure.session.session_store import SessionStore


def _mock_llm(response: dict[str, object]) -> AsyncMock:
    service = AsyncMock()
    service.generate_with_history.return_value = (json.dumps(response), 0.001)
    service.count_tokens.return_value = 100
    return service


class TestExploreUseCase:
    @pytest.mark.asyncio
    async def test_returns_action(self) -> None:
        llm_response = {
            "action": "click",
            "target": '[data-testid="login-btn"]',
            "value": None,
            "completed": False,
            "analysis_summary": "Click login button to proceed",
        }
        service = _mock_llm(llm_response)
        session = Session(objective="test login")
        use_case = ExploreUseCase(service)

        result = await use_case.execute(session, "<html>...</html>", {})

        assert result.action == "click"
        assert result.target == '[data-testid="login-btn"]'
        assert result.value is None
        assert not result.completed

    @pytest.mark.asyncio
    async def test_accumulates_history(self) -> None:
        service = _mock_llm(
            {"action": "click", "target": "btn", "value": None, "completed": False, "analysis_summary": "x"}
        )
        session = Session()
        use_case = ExploreUseCase(service)

        await use_case.execute(session, "<html>round1</html>", {})
        assert len(session.history) == 2  # user + assistant

        await use_case.execute(session, "<html>round2</html>", {})
        assert len(session.history) == 4  # 2 rounds * 2 messages

        # Verify generate_with_history receives full history on second call
        second_call_messages = service.generate_with_history.call_args_list[1].kwargs["messages"]
        assert len(second_call_messages) == 4

    @pytest.mark.asyncio
    async def test_marks_completed(self) -> None:
        service = _mock_llm(
            {"action": "assert", "target": "h1", "value": None, "completed": True, "analysis_summary": "done"}
        )
        session = Session()
        use_case = ExploreUseCase(service)

        result = await use_case.execute(session, "<html>done</html>", {})

        assert result.completed
        assert session.completed


class TestSessionStore:
    def test_create_and_get(self) -> None:
        store = SessionStore()
        session = store.create(objective="test login")
        assert store.get(session.id) is session
        assert session.objective == "test login"

    def test_close(self) -> None:
        store = SessionStore()
        session = store.create()
        assert store.close(session.id)
        assert store.get(session.id) is None

    def test_close_nonexistent(self) -> None:
        store = SessionStore()
        assert not store.close("nonexistent")

    def test_parallel_sessions_isolated(self) -> None:
        store = SessionStore()
        s1 = store.create(objective="login")
        s2 = store.create(objective="checkout")
        s1.add_message("user", "html1")
        assert len(s1.history) == 1
        assert len(s2.history) == 0
