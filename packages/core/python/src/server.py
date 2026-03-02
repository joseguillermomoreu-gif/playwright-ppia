from fastapi import FastAPI

from src.application.dto.prepare_input import PrepareInputRequest, PrepareInputResponse
from src.application.use_cases.prepare_input.prepare_input_use_case import PrepareInputUseCase
from src.infrastructure.config.dependency_injection import get_container

app = FastAPI(title="PPIA AI Service", version="0.1.0")


@app.get("/ping")
async def ping() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}


@app.post("/prepare-input")
async def prepare_input(request: PrepareInputRequest) -> PrepareInputResponse:
    container = get_container()
    llm_service = container.get_llm_service(model_override=request.model)
    use_case = PrepareInputUseCase(llm_service)
    return await use_case.execute(request)
