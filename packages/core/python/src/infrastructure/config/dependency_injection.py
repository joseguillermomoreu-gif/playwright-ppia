from src.domain.repository.llm_service import LlmService
from src.infrastructure.ai.anthropic.claude_llm_service import ClaudeLlmService
from src.infrastructure.ai.openai.openai_llm_service import OpenAiLlmService
from src.infrastructure.config.settings import Settings, get_settings


class Container:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._llm_service: LlmService | None = None

    def get_llm_service(self) -> LlmService:
        if self._llm_service is None:
            self._llm_service = _create_llm_service(self.settings)
        return self._llm_service


def _create_llm_service(settings: Settings) -> LlmService:
    model = settings.default_model
    if model.startswith("claude"):
        return ClaudeLlmService(settings)
    return OpenAiLlmService(settings)


_container: Container | None = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = Container()
    return _container
