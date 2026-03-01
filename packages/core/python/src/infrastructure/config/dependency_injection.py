from src.infrastructure.config.settings import Settings, get_settings


class Container:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()


_container: Container | None = None


def get_container() -> Container:
    global _container
    if _container is None:
        _container = Container()
    return _container
