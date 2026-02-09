"""
Inference service testing script
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import numpy as np
from app.services.inference import inference_service
from app.services.tts_service import tts_service
from app.config import settings


def test_inference():
    """Test inference service"""
    print("Testing Inference Service")
    print("=" * 50)
    
    # Print model info
    info = inference_service.get_model_info()
    print(f"Model Info: {info}")
    print()
    
    # Generate dummy data
    print("Generating dummy landmark data...")
    sequence = []
    for frame in range(30):
        landmarks = []
        for landmark in range(21):
            x = np.random.random()
            y = np.random.random()
            z = np.random.random() * 0.1
            landmarks.append([x, y, z])
        sequence.append(landmarks)
    
    print(f"Sequence shape: {len(sequence)} frames x {len(sequence[0])} landmarks")
    
    # Run inference
    print("\nRunning inference...")
    label, confidence, class_idx = inference_service.predict(sequence)
    
    print(f"Predicted label: {label}")
    print(f"Confidence: {confidence:.3f}")
    print(f"Class index: {class_idx}")
    print()
    
    # Test multiple times
    print("Running 5 inference tests...")
    for i in range(5):
        # Vary the input slightly
        for frame in sequence:
            for j, landmark in enumerate(frame):
                frame[j] = [
                    landmark[0] + np.random.normal(0, 0.01),
                    landmark[1] + np.random.normal(0, 0.01),
                    landmark[2] + np.random.normal(0, 0.001)
                ]
        
        label, confidence, class_idx = inference_service.predict(sequence)
        print(f"  Test {i+1}: {label} ({confidence:.3f})")
    
    print("\nInference test completed!")


def test_tts():
    """Test TTS service"""
    print("\nTesting TTS Service")
    print("=" * 50)
    
    for label in settings.LABELS:
        print(f"\nGenerating audio for: {label}")
        audio_base64, audio_format = tts_service.generate_audio(label)
        
        if audio_base64:
            print(f"  Format: {audio_format}")
            print(f"  Audio length: {len(audio_base64)} chars (base64)")
        else:
            print("  Failed to generate audio")
    
    print("\nTTS test completed!")


if __name__ == "__main__":
    test_inference()
    test_tts()