from __future__ import annotations

from unittest.mock import patch

from fastapi.testclient import TestClient

from src.server import app

client = TestClient(app)


def test_ping_returns_200() -> None:
    response = client.get("/ping")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "version": "0.1.0"}


def test_ping_is_fast() -> None:
    with patch("src.server.get_container") as mock_get_container:
        response = client.get("/ping")
    assert response.status_code == 200
    mock_get_container.assert_not_called()


def test_startup_info_returns_version_and_models() -> None:
    response = client.get("/startup-info")
    assert response.status_code == 200
    data = response.json()
    assert data["version"] != ""
    assert data["model_fast"] != ""
    assert data["model_strong"] != ""
