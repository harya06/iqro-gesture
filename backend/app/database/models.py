"""
SQLAlchemy database models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from .db import Base


class GesturePrediction(Base):
    """Model for storing gesture predictions"""
    
    __tablename__ = "gesture_predictions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), index=True)
    predicted_label = Column(String(50), nullable=False)
    confidence = Column(Float, nullable=False)
    landmark_data = Column(Text, nullable=True)  # JSON string of landmarks
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    client_ip = Column(String(50), nullable=True)
    
    def __repr__(self):
        return f"<GesturePrediction(id={self.id}, label={self.predicted_label}, confidence={self.confidence})>"


class SessionLog(Base):
    """Model for storing session logs"""
    
    __tablename__ = "session_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True)
    start_time = Column(DateTime(timezone=True), server_default=func.now())
    end_time = Column(DateTime(timezone=True), nullable=True)
    total_predictions = Column(Integer, default=0)
    client_info = Column(JSON, nullable=True)
    
    def __repr__(self):
        return f"<SessionLog(id={self.id}, session_id={self.session_id})>"