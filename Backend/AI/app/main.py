from fastapi import FastAPI

app = FastAPI(title="ATHLASX Compute", version="0.1.0")


@app.get("/api/v1/compute/health")
async def health() -> dict:
    return {"status": "ok", "service": "compute"}
