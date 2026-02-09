"""
HTTP API routes
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List
import os

from ..database.db import get_db
from ..database.models import GesturePrediction, SessionLog
from ..services.inference import inference_service
from ..services.tts_service import tts_service
from ..config import settings
from ..utils.logger import logger

router = APIRouter()


@router.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Iqro Gesture Recognition API",
        "version": settings.APP_VERSION,
        "status": "running"
    }


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_info": inference_service.get_model_info()
    }


@router.get("/labels")
async def get_labels():
    """Get available gesture labels"""
    return {
        "labels": settings.LABELS,
        "arabic_labels": settings.ARABIC_LABELS,
        "pronunciation": settings.ARABIC_PRONUNCIATION
    }


@router.get("/predictions")
async def get_predictions(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get prediction history"""
    predictions = db.query(GesturePrediction)\
        .order_by(GesturePrediction.timestamp.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    
    return {
        "predictions": [
            {
                "id": p.id,
                "session_id": p.session_id,
                "label": p.predicted_label,
                "confidence": p.confidence,
                "timestamp": p.timestamp.isoformat()
            }
            for p in predictions
        ]
    }


@router.get("/predictions/session/{session_id}")
async def get_session_predictions(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Get predictions for a specific session"""
    predictions = db.query(GesturePrediction)\
        .filter(GesturePrediction.session_id == session_id)\
        .order_by(GesturePrediction.timestamp.desc())\
        .all()
    
    return {
        "session_id": session_id,
        "count": len(predictions),
        "predictions": [
            {
                "id": p.id,
                "label": p.predicted_label,
                "confidence": p.confidence,
                "timestamp": p.timestamp.isoformat()
            }
            for p in predictions
        ]
    }


@router.get("/audio/{filename}")
async def get_audio(filename: str):
    """Serve cached audio file"""
    file_path = settings.AUDIO_CACHE_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    
    return FileResponse(
        path=file_path,
        media_type="audio/mpeg",
        filename=filename
    )


@router.post("/tts/generate/{label}")
async def generate_tts(label: str):
    """Generate TTS audio for a label"""
    if label not in settings.LABELS:
        raise HTTPException(status_code=400, detail=f"Invalid label: {label}")
    
    audio_base64, audio_format = tts_service.generate_audio(label)
    
    if audio_base64 is None:
        raise HTTPException(status_code=500, detail="Failed to generate audio")
    
    return {
        "label": label,
        "arabic": settings.ARABIC_LABELS.get(label),
        "audio_base64": audio_base64,
        "format": audio_format
    }


@router.post("/tts/pregenerate")
async def pregenerate_tts():
    """Pre-generate all TTS audio files"""
    tts_service.pregenerate_all()
    return {"message": "TTS audio pre-generated for all labels"}


@router.delete("/tts/cache")
async def clear_tts_cache():
    """Clear TTS audio cache"""
    count = tts_service.clear_cache()
    return {"message": f"Cleared {count} cached audio files"}


@router.get("/stats")
async def get_stats(db: Session = Depends(get_db)):
    """Get prediction statistics"""
    from sqlalchemy import func
    
    total_predictions = db.query(func.count(GesturePrediction.id)).scalar()
    
    label_counts = db.query(
        GesturePrediction.predicted_label,
        func.count(GesturePrediction.id)
    ).group_by(GesturePrediction.predicted_label).all()
    
    avg_confidence = db.query(func.avg(GesturePrediction.confidence)).scalar()
    
    return {
        "total_predictions": total_predictions,
        "label_distribution": {label: count for label, count in label_counts},
        "average_confidence": round(avg_confidence, 3) if avg_confidence else 0
    }