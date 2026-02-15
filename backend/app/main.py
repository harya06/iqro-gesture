"""
Main FastAPI application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .config import settings
from .database.db import init_db
from .api.routes import router
from .api.websocket import websocket_router
from .services.tts_service import tts_service
from .utils.logger import logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Iqro Gesture Recognition API...")
    
    # Initialize database
    init_db()
    logger.info("Database initialized")
    
    # Pre-generate TTS audio
    if settings.TTS_ENABLED:
        tts_service.pregenerate_all()
    
    logger.info("Application startup complete")
    
    yield
    
    # Shutdown
    logger.info("Shutting down application...")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Real-time gesture recognition for Iqro Arabic letters",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for audio
app.mount(
    "/audio",
    StaticFiles(directory=str(settings.AUDIO_CACHE_DIR)),
    name="audio"
)

# Include routers
app.include_router(router, prefix="/api", tags=["API"])
app.include_router(websocket_router, tags=["WebSocket"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Iqro Gesture Recognition API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
        "websocket": "/ws/{session_id}"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )