"""
Gesture inference service
Handles both dummy and real LSTM model inference
"""
import torch
import torch.nn as nn
import numpy as np
import json
import random
from pathlib import Path
from typing import Tuple, Optional, List

from ..config import settings
from ..utils.logger import logger


class LSTMModel(nn.Module):
    """LSTM model for gesture recognition"""
    
    def __init__(
        self,
        input_size: int = 63,
        hidden_size: int = 128,
        num_layers: int = 2,
        num_classes: int = 5,
        dropout: float = 0.3
    ):
        super(LSTMModel, self).__init__()
        
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=True
        )
        
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, num_classes)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # LSTM forward
        lstm_out, _ = self.lstm(x)
        
        # Take the last output
        last_output = lstm_out[:, -1, :]
        
        # Fully connected layers
        output = self.fc(last_output)
        
        return output


class InferenceService:
    """Service for running gesture inference"""
    
    def __init__(self):
        self.model: Optional[LSTMModel] = None
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.labels = settings.LABELS
        self.use_dummy = settings.USE_DUMMY_INFERENCE
        self.model_loaded = False
        
        logger.info(f"Inference service initialized. Device: {self.device}")
        logger.info(f"Using dummy inference: {self.use_dummy}")
        
        if not self.use_dummy:
            self._load_model()
    
    def _load_model(self) -> bool:
        """Load the trained LSTM model"""
        model_path = settings.MODEL_PATH
        
        if not model_path.exists():
            logger.warning(f"Model not found at {model_path}. Using dummy inference.")
            self.use_dummy = True
            return False
        
        try:
            self.model = LSTMModel(
                input_size=settings.LANDMARK_SIZE,
                hidden_size=128,
                num_layers=2,
                num_classes=len(self.labels)
            )
            
            checkpoint = torch.load(model_path, map_location=self.device)
            
            if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
                self.model.load_state_dict(checkpoint['model_state_dict'])
            else:
                self.model.load_state_dict(checkpoint)
            
            self.model.to(self.device)
            self.model.eval()
            self.model_loaded = True
            
            logger.info(f"Model loaded successfully from {model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self.use_dummy = True
            return False
    
    def preprocess_landmarks(self, landmarks: List[List[float]]) -> torch.Tensor:
        """
        Preprocess landmark data for inference
        
        Args:
            landmarks: List of frames, each containing 21 landmarks with [x, y, z]
                      Shape: (sequence_length, 21, 3) or (sequence_length, 63)
        
        Returns:
            Tensor of shape (1, sequence_length, 63)
        """
        try:
            arr = np.array(landmarks, dtype=np.float32)
            
            # Handle different input shapes
            if arr.ndim == 3:
                # Shape: (seq_len, 21, 3) -> (seq_len, 63)
                arr = arr.reshape(arr.shape[0], -1)
            
            # Ensure correct sequence length
            if arr.shape[0] < settings.SEQUENCE_LENGTH:
                # Pad with zeros
                padding = np.zeros((settings.SEQUENCE_LENGTH - arr.shape[0], settings.LANDMARK_SIZE))
                arr = np.vstack([padding, arr])
            elif arr.shape[0] > settings.SEQUENCE_LENGTH:
                # Take last N frames
                arr = arr[-settings.SEQUENCE_LENGTH:]
            
            # Normalize landmarks (assuming values are between 0 and 1)
            # Additional normalization can be added here
            
            # Convert to tensor
            tensor = torch.from_numpy(arr).unsqueeze(0)  # Add batch dimension
            
            return tensor.to(self.device)
            
        except Exception as e:
            logger.error(f"Error preprocessing landmarks: {e}")
            raise ValueError(f"Invalid landmark data: {e}")
    
    def predict(self, landmarks: List[List[float]]) -> Tuple[str, float, int]:
        """
        Run inference on landmark data
        
        Args:
            landmarks: Sequence of landmark frames
        
        Returns:
            Tuple of (predicted_label, confidence, class_index)
        """
        if self.use_dummy or not self.model_loaded:
            return self._dummy_predict(landmarks)
        
        try:
            # Preprocess
            input_tensor = self.preprocess_landmarks(landmarks)
            
            # Inference
            with torch.no_grad():
                outputs = self.model(input_tensor)
                probabilities = torch.softmax(outputs, dim=1)
                confidence, predicted_idx = torch.max(probabilities, dim=1)
                
                predicted_label = self.labels[predicted_idx.item()]
                confidence_value = confidence.item()
                
                logger.info(f"Prediction: {predicted_label} (confidence: {confidence_value:.2f})")
                
                return predicted_label, confidence_value, predicted_idx.item()
                
        except Exception as e:
            logger.error(f"Inference error: {e}")
            return self._dummy_predict(landmarks)
    
    def _dummy_predict(self, landmarks: List[List[float]]) -> Tuple[str, float, int]:
        """
        Dummy prediction for testing
        Uses simple heuristics based on landmark positions
        """
        try:
            # Simple heuristic based on landmark variance
            arr = np.array(landmarks)
            if arr.ndim == 3:
                arr = arr.reshape(arr.shape[0], -1)
            
            # Calculate variance as a simple feature
            variance = np.var(arr)
            
            # Map variance to class (simple heuristic)
            class_idx = int(variance * 1000) % len(self.labels)
            
            # Add some randomness for testing
            if random.random() < 0.3:
                class_idx = random.randint(0, len(self.labels) - 1)
            
            predicted_label = self.labels[class_idx]
            confidence = random.uniform(0.7, 0.95)
            
            logger.info(f"Dummy prediction: {predicted_label} (confidence: {confidence:.2f})")
            
            return predicted_label, confidence, class_idx
            
        except Exception as e:
            logger.error(f"Dummy prediction error: {e}")
            return self.labels[0], 0.5, 0
    
    def get_model_info(self) -> dict:
        """Get information about the current model"""
        return {
            "model_loaded": self.model_loaded,
            "using_dummy": self.use_dummy,
            "device": str(self.device),
            "labels": self.labels,
            "sequence_length": settings.SEQUENCE_LENGTH,
            "landmark_size": settings.LANDMARK_SIZE
        }


# Singleton instance
inference_service = InferenceService()