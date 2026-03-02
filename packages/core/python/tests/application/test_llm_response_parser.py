from __future__ import annotations

from src.application.shared.llm_response_parser import clean_code_block, parse_llm_json


class TestParseLlmJson:
    def test_parses_valid_json(self) -> None:
        result = parse_llm_json('{"key": "value"}')
        assert result == {"key": "value"}

    def test_strips_markdown_json_block(self) -> None:
        raw = '```json\n{"key": "value"}\n```'
        result = parse_llm_json(raw)
        assert result == {"key": "value"}

    def test_strips_plain_markdown_block(self) -> None:
        raw = '```\n{"key": "value"}\n```'
        result = parse_llm_json(raw)
        assert result == {"key": "value"}

    def test_returns_empty_on_invalid_json(self) -> None:
        result = parse_llm_json("not json at all")
        assert result == {}

    def test_returns_empty_on_empty_string(self) -> None:
        result = parse_llm_json("")
        assert result == {}


class TestCleanCodeBlock:
    def test_strips_typescript_block(self) -> None:
        raw = '```typescript\nimport { test } from "pw";\n```'
        assert clean_code_block(raw) == 'import { test } from "pw";'

    def test_returns_raw_if_no_block(self) -> None:
        raw = 'import { test } from "pw";'
        assert clean_code_block(raw) == raw

    def test_strips_whitespace(self) -> None:
        assert clean_code_block("  hello  ") == "hello"
