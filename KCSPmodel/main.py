from fastapi import FastAPI
from api.routes import router

app = FastAPI(title="AgriForecast Model Server", version="0.1.0")
app.include_router(router, prefix="/api")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
