"""
Training script for gesture recognition model
"""
import os
import sys
import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Tuple, Optional

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader
from torch.optim.lr_scheduler import ReduceLROnPlateau
import numpy as np

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from ml_training.model import GestureLSTM, SimpleLSTM
from ml_training.dataset_builder import (
    create_data_loaders,
    create_synthetic_loaders,
    GestureDataset,
    SyntheticGestureDataset
)


class Trainer:
    """Training class for gesture recognition model"""
    
    def __init__(
        self,
        model: nn.Module,
        train_loader: DataLoader,
        val_loader: DataLoader,
        device: torch.device,
        learning_rate: float = 0.001,
        weight_decay: float = 1e-5
    ):
        self.model = model.to(device)
        self.train_loader = train_loader
        self.val_loader = val_loader
        self.device = device
        
        self.criterion = nn.CrossEntropyLoss()
        self.optimizer = optim.Adam(
            model.parameters(),
            lr=learning_rate,
            weight_decay=weight_decay
        )
        self.scheduler = ReduceLROnPlateau(
            self.optimizer,
            mode='min',
            factor=0.5,
            patience=5,
            verbose=True
        )
        
        self.train_losses = []
        self.val_losses = []
        self.train_accuracies = []
        self.val_accuracies = []
        self.best_val_loss = float('inf')
        self.best_val_acc = 0.0
    
    def train_epoch(self) -> Tuple[float, float]:
        """Train for one epoch"""
        self.model.train()
        total_loss = 0.0
        correct = 0
        total = 0
        
        for batch_idx, (data, target) in enumerate(self.train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            self.optimizer.zero_grad()
            output = self.model(data)
            loss = self.criterion(output, target)
            loss.backward()
            
            # Gradient clipping
            torch.nn.utils.clip_grad_norm_(self.model.parameters(), max_norm=1.0)
            
            self.optimizer.step()
            
            total_loss += loss.item()
            _, predicted = output.max(1)
            total += target.size(0)
            correct += predicted.eq(target).sum().item()
        
        avg_loss = total_loss / len(self.train_loader)
        accuracy = 100.0 * correct / total
        
        return avg_loss, accuracy
    
    def validate(self) -> Tuple[float, float]:
        """Validate model"""
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for data, target in self.val_loader:
                data, target = data.to(self.device), target.to(self.device)
                
                output = self.model(data)
                loss = self.criterion(output, target)
                
                total_loss += loss.item()
                _, predicted = output.max(1)
                total += target.size(0)
                correct += predicted.eq(target).sum().item()
        
        avg_loss = total_loss / len(self.val_loader)
        accuracy = 100.0 * correct / total
        
        return avg_loss, accuracy
    
    def train(
        self,
        epochs: int,
        save_dir: str,
        early_stopping_patience: int = 10
    ) -> dict:
        """
        Full training loop
        
        Args:
            epochs: Number of epochs to train
            save_dir: Directory to save model
            early_stopping_patience: Patience for early stopping
        
        Returns:
            Training history
        """
        save_path = Path(save_dir)
        save_path.mkdir(parents=True, exist_ok=True)
        
        best_model_path = save_path / "model.pt"
        patience_counter = 0
        
        print(f"\nTraining on device: {self.device}")
        print(f"Training samples: {len(self.train_loader.dataset)}")
        print(f"Validation samples: {len(self.val_loader.dataset)}")
        print("-" * 60)
        
        for epoch in range(1, epochs + 1):
            # Train
            train_loss, train_acc = self.train_epoch()
            self.train_losses.append(train_loss)
            self.train_accuracies.append(train_acc)
            
            # Validate
            val_loss, val_acc = self.validate()
            self.val_losses.append(val_loss)
            self.val_accuracies.append(val_acc)
            
            # Learning rate scheduling
            self.scheduler.step(val_loss)
            
            # Print progress
            print(f"Epoch {epoch:3d}/{epochs} | "
                  f"Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | "
                  f"Val Loss: {val_loss:.4f} | Val Acc: {val_acc:.2f}%")
            
            # Save best model
            if val_loss < self.best_val_loss:
                self.best_val_loss = val_loss
                self.best_val_acc = val_acc
                patience_counter = 0
                
                torch.save({
                    'epoch': epoch,
                    'model_state_dict': self.model.state_dict(),
                    'optimizer_state_dict': self.optimizer.state_dict(),
                    'val_loss': val_loss,
                    'val_acc': val_acc,
                    'train_loss': train_loss,
                    'train_acc': train_acc
                }, best_model_path)
                
                print(f"  → Saved best model (Val Loss: {val_loss:.4f})")
            else:
                patience_counter += 1
            
            # Early stopping
            if patience_counter >= early_stopping_patience:
                print(f"\nEarly stopping triggered after {epoch} epochs")
                break
        
        print("-" * 60)
        print(f"Training complete!")
        print(f"Best Val Loss: {self.best_val_loss:.4f}")
        print(f"Best Val Acc: {self.best_val_acc:.2f}%")
        print(f"Model saved to: {best_model_path}")
        
        # Save training history
        history = {
            "train_losses": self.train_losses,
            "val_losses": self.val_losses,
            "train_accuracies": self.train_accuracies,
            "val_accuracies": self.val_accuracies,
            "best_val_loss": self.best_val_loss,
            "best_val_acc": self.best_val_acc
        }
        
        with open(save_path / "training_history.json", 'w') as f:
            json.dump(history, f, indent=2)
        
        return history


def train_model(
    data_dir: Optional[str] = None,
    use_synthetic: bool = True,
    epochs: int = 50,
    batch_size: int = 32,
    learning_rate: float = 0.001,
    hidden_size: int = 128,
    num_layers: int = 2,
    dropout: float = 0.3,
    use_simple_model: bool = False
):
    """
    Main training function
    """
    # Configuration
    labels = ["Alif", "Ba", "Ta", "Tsa", "Jim"]
    sequence_length = 30
    input_size = 63  # 21 landmarks * 3
    
    # Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")
    
    if torch.cuda.is_available():
        print(f"GPU: {torch.cuda.get_device_name(0)}")
        print(f"Memory: {torch.cuda.get_device_properties(0).total_memory / 1e9:.2f} GB")
    
    # Create data loaders
    if use_synthetic:
        print("\nUsing synthetic data for training")
        train_loader, val_loader = create_synthetic_loaders(
            num_samples=5000,
            batch_size=batch_size,
            train_split=0.8
        )
    else:
        if data_dir is None:
            raise ValueError("data_dir must be provided when not using synthetic data")
        print(f"\nLoading data from: {data_dir}")
        train_loader, val_loader = create_data_loaders(
            data_dir=data_dir,
            labels=labels,
            batch_size=batch_size,
            sequence_length=sequence_length,
            train_split=0.8
        )
    
    # Create model
    if use_simple_model:
        model = SimpleLSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            num_classes=len(labels),
            dropout=dropout
        )
    else:
        model = GestureLSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            num_classes=len(labels),
            dropout=dropout
        )
    
    # Print model info
    total_params = sum(p.numel() for p in model.parameters())
    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"\nModel: {model.__class__.__name__}")
    print(f"Total parameters: {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,}")
    
    # Create trainer
    trainer = Trainer(
        model=model,
        train_loader=train_loader,
        val_loader=val_loader,
        device=device,
        learning_rate=learning_rate
    )
    
    # Train
    save_dir = Path(__file__).parent / "saved_models"
    history = trainer.train(
        epochs=epochs,
        save_dir=str(save_dir),
        early_stopping_patience=10
    )
    
    return history


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train gesture recognition model")
    parser.add_argument("--data-dir", type=str, help="Directory containing training data")
    parser.add_argument("--synthetic", action="store_true", default=True,
                        help="Use synthetic data for training")
    parser.add_argument("--epochs", type=int, default=50, help="Number of epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=0.001, help="Learning rate")
    parser.add_argument("--hidden-size", type=int, default=128, help="LSTM hidden size")
    parser.add_argument("--num-layers", type=int, default=2, help="Number of LSTM layers")
    parser.add_argument("--dropout", type=float, default=0.3, help="Dropout rate")
    parser.add_argument("--simple", action="store_true", help="Use simple LSTM model")
    
    args = parser.parse_args()
    
    train_model(
        data_dir=args.data_dir,
        use_synthetic=args.synthetic,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        hidden_size=args.hidden_size,
        num_layers=args.num_layers,
        dropout=args.dropout,
        use_simple_model=args.simple
    )