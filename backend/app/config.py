"""
Application configuration settings
"""
import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Iqro Gesture Recognition API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    
    # Paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    ML_MODELS_DIR: Path = BASE_DIR / "ml_training" / "saved_models"
    MODEL_PATH: Path = ML_MODELS_DIR / "model.pt"
    AUDIO_CACHE_DIR: Path = BASE_DIR / "audio_cache"
    
    # Database
    DATABASE_URL: str = "sqlite:///./iqro_gesture.db"
    
    # WebSocket
    WS_MAX_CONNECTIONS: int = 100
    SEQUENCE_LENGTH: int = 30
    LANDMARK_SIZE: int = 63  # 21 landmarks * 3 (x, y, z)
    
    # Inference
    USE_DUMMY_INFERENCE: bool = True  # Toggle for testing
    CONFIDENCE_THRESHOLD: float = 0.5
    
    # TTS
    TTS_LANGUAGE: str = "id"
    TTS_ENABLED: bool = True
    
    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    
    # Label mapping
    # Combined Iqro (Hijaiyah) + Al-Fatihah Chunks
    LABELS: List[str] = [
        # Hijaiyah
        "Alif", "Ba", "Ta", "Tsa", "Jim", 
        # Al-Fatihah Chunks
        "bis", "mil", "lah", "hir", "rah", "maa", "nir", "ra", "hiim",
        "al", "ham", "du", "lil", "rab", "bil", "aa", "la", "miin",
        "ar", "li", "ki", "yaw", "mi", "dii", "ni",
        "iy", "yaa", "ka", "na", "bu", "wa", "nas", "ta", "iin",
        "ih", "di", "naa", "as", "shi", "raa", "tal", "mus", "qiim",
        "dhi", "an", "am", "a", "lai", "him", "ghai", "ril", "magh", 
        "duu", "bi", "lad", "dhaal", "liin"
    ]
    ARABIC_LABELS: dict = {
        "Alif": "أَلِف",
        "Ba": "بَاء",
        "Ta": "تَاء",
        "Tsa": "ثَاء",
        "Jim": "جِيم"
    }
    ARABIC_PRONUNCIATION: dict = {
        # Hijaiyah (keep Arabic for these)
        "Alif": "Alif",
        "Ba": "Ba",
        "Ta": "Ta",
        "Tsa": "Tsa",
        "Jim": "Jim",
        # Al-Fatihah Chunks will use their labels directly as Indonesian phonetics
        # If any specific chunk needs special spelling for ID TTS, add here:
        "mil": "mil", 
        "lah": "lah",
        "hiim": "him",
        "miin": "min",
        "qiim": "qim"
    }
    
    class Config:
        env_file = ".env"
        extra = "allow"


settings = Settings()

# Ensure directories exist
settings.AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)
settings.ML_MODELS_DIR.mkdir(parents=True, exist_ok=True)