import sys
import os
import time

# Add backend directory to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.tts_service import tts_service
from app.config import settings

def main():
    print("="*60)
    print("IQRO GESTURE - AUDIO GENERATOR")
    print("="*60)
    print(f"Target Directory: {settings.AUDIO_CACHE_DIR}")
    print(f"Language: {settings.TTS_LANGUAGE}")
    print(f"Total Chunks to Generate: {len(settings.LABELS)}")
    print("-" * 60)

    try:
        # Check if gTTS is installed
        import gtts
        print("gTTS is installed. Proceeding...")
    except ImportError:
        print("ERROR: gTTS is not installed.")
        print("Please run: pip install gTTS pydantic-settings")
        return

    # Trigger pre-generation
    tts_service.pregenerate_all()

    print("="*60)
    print("GENERATION COMPLETE!")
    print(f"Files should be in {settings.AUDIO_CACHE_DIR}")
    print("="*60)

if __name__ == "__main__":
    main()
