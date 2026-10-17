from fastapi import FastAPI

from inventario.config import settings


def create_app() -> FastAPI:
    app = FastAPI(title=settings.app_name)

    @app.get("/health", tags=["sistema"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
