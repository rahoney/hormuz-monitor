from fastapi import FastAPI

app = FastAPI(title="Hormuz Monitor API")


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
