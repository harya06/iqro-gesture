"""
Dataset builder for gesture recognition training
"""
import os
import json
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader
from typing import List, Tuple, Optional, Dict
from pathlib import Path
import random


class GestureDataset(Dataset):
    """
    Dataset for gesture sequences
    
    Expected data format:
    - Directory structure:
      data/
        Alif/
          sequence_001.json
          sequence_002.json
        Ba/
          sequence_001.json
        ...
    
    - Each JSON file:
      {
        "frames": [
          [[x, y, z], [x, y, z], ...],  // 21 landmarks per frame
          ...
        ],
        "label": "Alif"
      }
    """
    
    def __init__(
        self,
        data_dir: str,
        labels: List[str],
        sequence_length: int = 30,
        augment: bool = False,
        normalize: bool = True
    ):
        self.data_dir = Path(data_dir)
        self.labels = labels
        self.label_to_idx = {label: idx for idx, label in enumerate(labels)}
        self.sequence_length = sequence_length
        self.augment = augment
        self.normalize = normalize
        
        self.samples: List[Tuple[np.ndarray, int]] = []
        self._load_data()
    
    def _load_data(self):
        """Load all data from directory"""
        for label in self.labels:
            label_dir = self.data_dir / label
            
            if not label_dir.exists():
                print(f"Warning: Directory {label_dir} not found")
                continue
            
            for file_path in label_dir.glob("*.json"):
                try:
                    with open(file_path, 'r') as f:
                        data = json.load(f)
                    
                    frames = np.array(data["frames"], dtype=np.float32)
                    label_idx = self.label_to_idx[label]
                    
                    # Process frames
                    processed = self._process_frames(frames)
                    if processed is not None:
                        self.samples.append((processed, label_idx))
                        
                except Exception as e:
                    print(f"Error loading {file_path}: {e}")
        
        print(f"Loaded {len(self.samples)} samples")
    
    def _process_frames(self, frames: np.ndarray) -> Optional[np.ndarray]:
        """Process frame sequence to fixed length"""
        if len(frames) == 0:
            return None
        
        # Reshape if necessary
        if frames.ndim == 3:
            # Shape: (seq_len, 21, 3) -> (seq_len, 63)
            frames = frames.reshape(frames.shape[0], -1)
        
        # Pad or truncate to sequence_length
        if len(frames) < self.sequence_length:
            padding = np.zeros((self.sequence_length - len(frames), frames.shape[1]))
            frames = np.vstack([padding, frames])
        elif len(frames) > self.sequence_length:
            frames = frames[-self.sequence_length:]
        
        # Normalize
        if self.normalize:
            frames = self._normalize(frames)
        
        return frames
    
    def _normalize(self, frames: np.ndarray) -> np.ndarray:
        """Normalize landmark coordinates"""
        # Center around wrist (landmark 0)
        for i in range(len(frames)):
            if frames[i].sum() != 0:  # Skip padding frames
                wrist = frames[i, :3].copy()
                for j in range(21):
                    frames[i, j*3:(j+1)*3] -= wrist
        
        # Scale to [-1, 1]
        max_val = np.abs(frames).max()
        if max_val > 0:
            frames = frames / max_val
        
        return frames
    
    def _augment(self, frames: np.ndarray) -> np.ndarray:
        """Apply data augmentation"""
        if not self.augment:
            return frames
        
        # Random scaling
        if random.random() < 0.5:
            scale = random.uniform(0.8, 1.2)
            frames = frames * scale
        
        # Random noise
        if random.random() < 0.5:
            noise = np.random.normal(0, 0.01, frames.shape)
            frames = frames + noise
        
        # Random time shift
        if random.random() < 0.5:
            shift = random.randint(-5, 5)
            if shift > 0:
                frames = np.vstack([np.zeros((shift, frames.shape[1])), frames[:-shift]])
            elif shift < 0:
                frames = np.vstack([frames[-shift:], np.zeros((-shift, frames.shape[1]))])
        
        return frames.astype(np.float32)
    
    def __len__(self) -> int:
        return len(self.samples)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        frames, label = self.samples[idx]
        
        if self.augment:
            frames = self._augment(frames.copy())
        
        return torch.from_numpy(frames), label


class SyntheticGestureDataset(Dataset):
    """
    Generate synthetic data for testing
    """
    
    def __init__(
        self,
        num_samples: int = 1000,
        labels: List[str] = ["Alif", "Ba", "Ta", "Tsa", "Jim"],
        sequence_length: int = 30,
        num_landmarks: int = 21
    ):
        self.num_samples = num_samples
        self.labels = labels
        self.sequence_length = sequence_length
        self.num_landmarks = num_landmarks
        self.feature_size = num_landmarks * 3
        
        self.samples = self._generate_synthetic_data()
    
    def _generate_synthetic_data(self) -> List[Tuple[np.ndarray, int]]:
        """Generate synthetic gesture data"""
        samples = []
        
        for _ in range(self.num_samples):
            label_idx = random.randint(0, len(self.labels) - 1)
            
            # Generate base pattern based on class
            base_freq = (label_idx + 1) * 0.1
            t = np.linspace(0, 2 * np.pi, self.sequence_length)
            
            # Create landmark sequence
            frames = np.zeros((self.sequence_length, self.feature_size), dtype=np.float32)
            
            for frame_idx in range(self.sequence_length):
                for landmark_idx in range(self.num_landmarks):
                    # Add class-specific patterns
                    offset = landmark_idx * 0.1 + label_idx * 0.5
                    
                    x = np.sin(t[frame_idx] * base_freq + offset) * 0.3 + 0.5
                    y = np.cos(t[frame_idx] * base_freq + offset) * 0.3 + 0.5
                    z = np.sin(t[frame_idx] * base_freq * 0.5) * 0.1
                    
                    # Add noise
                    x += np.random.normal(0, 0.02)
                    y += np.random.normal(0, 0.02)
                    z += np.random.normal(0, 0.01)
                    
                    base_idx = landmark_idx * 3
                    frames[frame_idx, base_idx] = x
                    frames[frame_idx, base_idx + 1] = y
                    frames[frame_idx, base_idx + 2] = z
            
            samples.append((frames, label_idx))
        
        return samples
    
    def __len__(self) -> int:
        return len(self.samples)
    
    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, int]:
        frames, label = self.samples[idx]
        return torch.from_numpy(frames), label


def create_data_loaders(
    data_dir: str,
    labels: List[str],
    batch_size: int = 32,
    sequence_length: int = 30,
    train_split: float = 0.8,
    num_workers: int = 4
) -> Tuple[DataLoader, DataLoader]:
    """
    Create train and validation data loaders
    """
    dataset = GestureDataset(
        data_dir=data_dir,
        labels=labels,
        sequence_length=sequence_length,
        augment=True,
        normalize=True
    )
    
    # Split dataset
    train_size = int(len(dataset) * train_split)
    val_size = len(dataset) - train_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset, [train_size, val_size]
    )
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
        pin_memory=True
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
        pin_memory=True
    )
    
    return train_loader, val_loader


def create_synthetic_loaders(
    num_samples: int = 5000,
    batch_size: int = 32,
    train_split: float = 0.8
) -> Tuple[DataLoader, DataLoader]:
    """
    Create data loaders with synthetic data
    """
    dataset = SyntheticGestureDataset(num_samples=num_samples)
    
    train_size = int(len(dataset) * train_split)
    val_size = len(dataset) - train_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(
        dataset, [train_size, val_size]
    )
    
    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=0
    )
    
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=0
    )
    
    return train_loader, val_loader