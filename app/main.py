from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from app.core.config import settings
from app.api.v1.api import api_router

# Import models to ensure they're loaded
from app.db.base import Base  # noqa
from app.models.user import User  # noqa
from app.models.project import Project  # noqa
from app.models.task import Task  # noqa
from app.models.time_entry import TimeEntry  # noqa

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=None,  # Disable default docs
    redoc_url=None  # Disable default redoc
)

# Configure CORS
origins = [
    "http://localhost:5173",    # Vite dev server
    "http://localhost:5174",    # Vite preview
    "http://localhost:8010",    # Backend API
    "http://0.0.0.0:8010",     # Backend API alternative
    "http://127.0.0.1:8010",   # Backend API alternative
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

@app.get("/docs", include_in_schema=False)
async def custom_swagger_ui_html():
    return get_swagger_ui_html(
        openapi_url=f"{settings.API_V1_STR}/openapi.json",
        title=f"{settings.PROJECT_NAME} - Swagger UI"
    )

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def root():
    return {"message": "Welcome to Time Tracking API"} 