"""
WebSocket endpoint for real-time gesture recognition
"""
import json
import asyncio
from datetime import datetime
from typing import Dict, Set
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session

from ..database.db import SessionLocal
from ..database.models import GesturePrediction, SessionLog
from ..services.inference import inference_service
from ..services.tts_service import tts_service
from ..config import settings
from ..utils.logger import logger

websocket_router = APIRouter()


class ConnectionManager:
    """Manage WebSocket connections"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.session_data: Dict[str, dict] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept and store new connection"""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        self.session_data[session_id] = {
            "connected_at": datetime.now(),
            "prediction_count": 0,
            "last_prediction": None
        }
        logger.info(f"Client connected: {session_id}")
    
    def disconnect(self, session_id: str):
        """Remove connection"""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
        if session_id in self.session_data:
            del self.session_data[session_id]
        logger.info(f"Client disconnected: {session_id}")
    
    async def send_message(self, session_id: str, message: dict):
        """Send message to specific client"""
        if session_id in self.active_connections:
            try:
                await self.active_connections[session_id].send_json(message)
            except Exception as e:
                logger.error(f"Error sending message to {session_id}: {e}")
    
    async def broadcast(self, message: dict):
        """Send message to all connected clients"""
        for session_id in self.active_connections:
            await self.send_message(session_id, message)
    
    def get_connection_count(self) -> int:
        """Get number of active connections"""
        return len(self.active_connections)


# Global connection manager
manager = ConnectionManager()


def get_db_session():
    """Get database session for WebSocket handlers"""
    db = SessionLocal()
    try:
        return db
    finally:
        pass


@websocket_router.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    """
    Main WebSocket endpoint for gesture recognition
    
    Message format (client -> server):
    {
        "type": "landmarks",
        "data": {
            "sequence": [[x, y, z], ...],  // 30 frames x 21 landmarks x 3 coords
            "timestamp": 1234567890
        }
    }
    
    Response format (server -> client):
    {
        "type": "prediction",
        "data": {
            "label": "Alif",
            "arabic": "أَلِف",
            "confidence": 0.95,
            "audio_base64": "...",
            "audio_format": "mp3",
            "timestamp": 1234567890
        }
    }
    """
    await manager.connect(websocket, session_id)
    
    # Create database session
    db = SessionLocal()
    
    # Log session start
    try:
        existing = db.query(SessionLog).filter_by(
            session_id=session_id
        ).first()

        if not existing:
            session_log = SessionLog(
                session_id=session_id,
                client_info={
                  "user_agent": websocket.headers.get("user-agent", "unknown")
              }
            )
            db.add(session_log)
            db.commit()
        else:
              logger.info(f"Session already exists: {session_id}")

    except Exception as e:
        db.rollback()
        logger.error(f"Error logging session start: {e}")

    # Send welcome message
    await manager.send_message(session_id, {
        "type": "connected",
        "data": {
            "session_id": session_id,
            "message": "Connected to Iqro Gesture Recognition",
            "labels": settings.LABELS
        }
    })
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                message_type = message.get("type", "")
                
                if message_type == "landmarks":
                    # Process landmarks
                    await process_landmarks(
                        session_id=session_id,
                        message=message,
                        db=db
                    )
                
                elif message_type == "ping":
                    # Respond to ping
                    await manager.send_message(session_id, {
                        "type": "pong",
                        "data": {"timestamp": datetime.now().isoformat()}
                    })
                
                elif message_type == "get_labels":
                    # Send label information
                    await manager.send_message(session_id, {
                        "type": "labels",
                        "data": {
                            "labels": settings.LABELS,
                            "arabic_labels": settings.ARABIC_LABELS
                        }
                    })
                
                else:
                    logger.warning(f"Unknown message type: {message_type}")
                    
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON from {session_id}: {e}")
                await manager.send_message(session_id, {
                    "type": "error",
                    "data": {"message": "Invalid JSON format"}
                })
                
    except WebSocketDisconnect:
        logger.info(f"Client {session_id} disconnected")
    except Exception as e:
        logger.error(f"WebSocket error for {session_id}: {e}")
    finally:
        # Update session end time
        try:
            session_log = db.query(SessionLog).filter(
                SessionLog.session_id == session_id
            ).first()
            if session_log:
                session_log.end_time = datetime.now()
                session_log.total_predictions = manager.session_data.get(
                    session_id, {}
                ).get("prediction_count", 0)
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Error updating session log: {e}")
        
        manager.disconnect(session_id)
        db.close()


async def process_landmarks(session_id: str, message: dict, db: Session):
    """
    Process incoming landmark data and send prediction
    """
    try:
        data = message.get("data", {})
        sequence = data.get("sequence", [])
        client_timestamp = data.get("timestamp", 0)
        
        # Validate sequence
        if not sequence or len(sequence) < 10:
            await manager.send_message(session_id, {
                "type": "error",
                "data": {"message": "Insufficient landmark data"}
            })
            return
        
        # Run inference
        predicted_label, confidence, class_idx = inference_service.predict(sequence)
        
        # Check confidence threshold
        if confidence < settings.CONFIDENCE_THRESHOLD:
            await manager.send_message(session_id, {
                "type": "low_confidence",
                "data": {
                    "message": "Low confidence prediction",
                    "confidence": confidence
                }
            })
            return
        
        # Generate TTS audio
        audio_base64, audio_format = tts_service.generate_audio(predicted_label)
        
        # Get Arabic label
        arabic_label = settings.ARABIC_LABELS.get(predicted_label, predicted_label)
        
        # Log prediction to database
        try:
            prediction = GesturePrediction(
                session_id=session_id,
                predicted_label=predicted_label,
                confidence=confidence,
                landmark_data=json.dumps(sequence[-5:])  # Store last 5 frames
            )
            db.add(prediction)
            db.commit()
        except Exception as e:
            logger.error(f"Error logging prediction: {e}")
        
        # Update session stats
        if session_id in manager.session_data:
            manager.session_data[session_id]["prediction_count"] += 1
            manager.session_data[session_id]["last_prediction"] = predicted_label
        
        # Send response
        response = {
            "type": "prediction",
            "data": {
                "label": predicted_label,
                "arabic": arabic_label,
                "confidence": round(confidence, 3),
                "class_index": class_idx,
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Include audio if available
        if audio_base64:
            response["data"]["audio_base64"] = audio_base64
            response["data"]["audio_format"] = audio_format
        
        await manager.send_message(session_id, response)
        
        logger.info(f"Prediction sent to {session_id}: {predicted_label} ({confidence:.2f})")
        
    except Exception as e:
        logger.error(f"Error processing landmarks: {e}")
        await manager.send_message(session_id, {
            "type": "error",
            "data": {"message": f"Processing error: {str(e)}"}
        })


@websocket_router.get("/ws/status")
async def websocket_status():
    """Get WebSocket connection status"""
    return {
        "active_connections": manager.get_connection_count(),
        "sessions": list(manager.active_connections.keys())
    }