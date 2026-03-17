from src.domain.repository.llm_service import LlmService
from src.infrastructure.ai.anthropic.claude_llm_service import ClaudeLlmService
from src.infrastructure.ai.openai.openai_llm_service import OpenAiLlmService
from src.infrastructure.config.settings import Settings, get_settings
from src.infrastructure.pricing.pricing_store import PricingStore
from src.infrastructure.session.session_store import SessionStore


class Container:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()
        self._llm_service: LlmService | None = None
        self._session_store: SessionStore | None = None
        self._pricing_stores: dict[str, PricingStore] = {}

    def get_session_store(self) -> SessionStore:
        if self._session_store is None:
            self._session_store = SessionStore()
        return self._session_store

    def get_llm_service(self, model_override: str = "") -> LlmService:
        if not model_override or model_override == self.settings.default_model:
            if self._llm_service is None:
                self._llm_service = _create_llm_service(self.settings)
            return self._llm_service
        override_settings = self.settings.model_copy(update={"default_model": model_override})
        return _create_llm_service(override_settings)

    def get_pricing_store(self, project_root: str) -> PricingStore:
        if project_root not in self._pricing_stores:
            self._pricing_stores[project_root] = PricingStore(project_root)
        return self._pricing_stores[project_root]


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
