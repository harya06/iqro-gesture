"""
LSTM Model for gesture recognition
"""
import torch
import torch.nn as nn
from typing import Tuple


class GestureLSTM(nn.Module):
    """
    LSTM model for gesture sequence classification
    
    Architecture:
    - Bidirectional LSTM
    - Attention mechanism
    - Fully connected classifier
    """
    
    def __init__(
        self,
        input_size: int = 63,      # 21 landmarks * 3 coordinates
        hidden_size: int = 128,
        num_layers: int = 2,
        num_classes: int = 5,
        dropout: float = 0.3,
        bidirectional: bool = True
    ):
        super(GestureLSTM, self).__init__()
        
        self.input_size = input_size
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_classes = num_classes
        self.bidirectional = bidirectional
        self.num_directions = 2 if bidirectional else 1
        
        # Input normalization
        self.batch_norm = nn.BatchNorm1d(input_size)
        
        # LSTM layers
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0,
            bidirectional=bidirectional
        )
        
        # Attention mechanism
        self.attention = nn.Sequential(
            nn.Linear(hidden_size * self.num_directions, hidden_size),
            nn.Tanh(),
            nn.Linear(hidden_size, 1),
            nn.Softmax(dim=1)
        )
        
        # Classifier
        self.classifier = nn.Sequential(
            nn.Linear(hidden_size * self.num_directions, hidden_size),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size, hidden_size // 2),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_size // 2, num_classes)
        )
        
    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Forward pass
        
        Args:
            x: Input tensor of shape (batch_size, sequence_length, input_size)
        
        Returns:
            Output tensor of shape (batch_size, num_classes)
        """
        batch_size, seq_len, features = x.shape
        
        # Normalize input
        x = x.transpose(1, 2)  # (batch, features, seq_len)
        x = self.batch_norm(x)
        x = x.transpose(1, 2)  # (batch, seq_len, features)
        
        # LSTM forward pass
        lstm_out, (hidden, cell) = self.lstm(x)
        # lstm_out: (batch, seq_len, hidden_size * num_directions)
        
        # Apply attention
        attention_weights = self.attention(lstm_out)  # (batch, seq_len, 1)
        context = torch.sum(attention_weights * lstm_out, dim=1)  # (batch, hidden_size * 2)
        
        # Classify
        output = self.classifier(context)  # (batch, num_classes)
        
        return output
    
    def get_attention_weights(self, x: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        """Get attention weights for visualization"""
        batch_size, seq_len, features = x.shape
        
        x = x.transpose(1, 2)
        x = self.batch_norm(x)
        x = x.transpose(1, 2)
        
        lstm_out, _ = self.lstm(x)
        attention_weights = self.attention(lstm_out)
        
        return attention_weights, lstm_out


class SimpleLSTM(nn.Module):
    """
    Simplified LSTM model for quick training
    """
    
    def __init__(
        self,
        input_size: int = 63,
        hidden_size: int = 128,
        num_layers: int = 2,
        num_classes: int = 5,
        dropout: float = 0.3
    ):
        super(SimpleLSTM, self).__init__()
        
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
        lstm_out, _ = self.lstm(x)
        last_output = lstm_out[:, -1, :]
        output = self.fc(last_output)
        return output