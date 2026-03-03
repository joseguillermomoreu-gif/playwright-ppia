from fastapi import FastAPI, HTTPException

from src.application.dto.explore import (
    CloseSessionResponse,
    CreateSessionResponse,
    ExploreRequest,
    ExploreResponse,
)
from src.application.dto.generate import (
    GenerateArtifactsRequest,
    GenerateArtifactsResponse,
    GenerateTestRequest,
    GenerateTestResponse,
)
from src.application.dto.prepare_input import PrepareInputRequest, PrepareInputResponse
from src.application.use_cases.explore.explore_use_case import ExploreUseCase
from src.application.use_cases.generate.generate_artifacts_use_case import GenerateArtifactsUseCase
from src.application.use_cases.generate.generate_test_use_case import GenerateTestUseCase
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


@app.post("/session")
async def create_session() -> CreateSessionResponse:
    container = get_container()
    session = container.get_session_store().create()
    return CreateSessionResponse(session_id=session.id)


@app.delete("/session/{session_id}")
async def close_session(session_id: str) -> CloseSessionResponse:
    container = get_container()
    closed = container.get_session_store().close(session_id)
    if not closed:
        raise HTTPException(status_code=404, detail="Session not found")
    return CloseSessionResponse(closed=True)


@app.post("/session/{session_id}/explore")
async def explore(session_id: str, request: ExploreRequest) -> ExploreResponse:
    container = get_container()
    session = container.get_session_store().get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    llm_service = container.get_llm_service(model_override=request.model)
    use_case = ExploreUseCase(llm_service)
    return await use_case.execute(session, request.html, request.context)


@app.post("/session/{session_id}/generate-test")
async def generate_test(session_id: str, request: GenerateTestRequest) -> GenerateTestResponse:
    container = get_container()
    session = container.get_session_store().get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    llm_service = container.get_llm_service(model_override=request.model)
    use_case = GenerateTestUseCase(llm_service)
    return await use_case.execute(session, request)


@app.post("/session/{session_id}/generate-artifacts")
async def generate_artifacts(session_id: str, request: GenerateArtifactsRequest) -> GenerateArtifactsResponse:
    container = get_container()
    session = container.get_session_store().get(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Session not found")
    llm_service = container.get_llm_service(model_override=request.model)
    use_case = GenerateArtifactsUseCase(llm_service)
    return await use_case.execute(session)
