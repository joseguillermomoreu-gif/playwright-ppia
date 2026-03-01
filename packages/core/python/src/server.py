from fastapi import FastAPI

app = FastAPI(title="PPIA AI Service", version="0.1.0")


@app.get("/ping")
async def ping() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}
