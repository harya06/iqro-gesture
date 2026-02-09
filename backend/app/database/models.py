"""
Database models
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean
from sqlalchemy.sql import func
from .db import Base


class User(Base):
    """User model for authentication"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)


class GestureLog(Base):
    """Log of recognized gestures"""
    __tablename__ = "gesture_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True)  # Optional: link to user
    session_id = Column(String, index=True)
    predicted_label = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    hand_type = Column(String)  # 'left', 'right', 'both'