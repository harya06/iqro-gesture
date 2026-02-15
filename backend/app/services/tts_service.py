"""
Text-to-Speech service for Arabic pronunciation
"""
import base64
import hashlib
import os
from pathlib import Path
from typing import Optional, Tuple
import io

from gtts import gTTS

from ..config import settings
from ..utils.logger import logger


class TTSService:
    """Service for generating Arabic text-to-speech audio"""
    
    def __init__(self):
        self.cache_dir = settings.AUDIO_CACHE_DIR
        self.language = settings.TTS_LANGUAGE
        self.enabled = settings.TTS_ENABLED
        self.pronunciation_map = settings.ARABIC_PRONUNCIATION
        
        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"TTS Service initialized. Enabled: {self.enabled}")
    
    def _get_cache_path(self, label: str) -> Path:
        """Generate cache file path based on label"""
        # Sanitize label for filename
        safe_label = "".join(c for c in label if c.isalnum() or c in ('-', '_')).lower()
        return self.cache_dir / f"{safe_label}.mp3"
    
    def generate_audio(self, label: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Generate TTS audio for a label
        
        Args:
            label: The gesture label (e.g., "Alif")
        
        Returns:
            Tuple of (base64_audio, audio_format)
        """
        if not self.enabled:
            logger.info("TTS disabled, skipping audio generation")
            return None, None
        
        try:
            # Get Arabic pronunciation text
            arabic_text = self.pronunciation_map.get(label, label)
            
            # Check cache
            cache_path = self._get_cache_path(label)
            
            if cache_path.exists():
                logger.info(f"Using cached audio for: {label}")
                with open(cache_path, 'rb') as f:
                    audio_data = f.read()
            else:
                logger.info(f"Generating TTS audio for: {label} ({arabic_text})")
                
                # Generate audio
                tts = gTTS(text=arabic_text, lang=self.language, slow=True)
                
                # Save to buffer
                audio_buffer = io.BytesIO()
                tts.write_to_fp(audio_buffer)
                audio_buffer.seek(0)
                audio_data = audio_buffer.read()
                
                # Cache the audio
                with open(cache_path, 'wb') as f:
                    f.write(audio_data)
                
                logger.info(f"Audio cached at: {cache_path}")
            
            # Convert to base64
            base64_audio = base64.b64encode(audio_data).decode('utf-8')
            
            return base64_audio, "mp3"
            
        except Exception as e:
            logger.error(f"TTS generation error: {e}")
            return None, None
    
    def get_audio_url(self, label: str) -> Optional[str]:
        """
        Get audio file URL (for serving via HTTP)
        
        Args:
            label: The gesture label
        
        Returns:
            URL path to audio file
        """
        arabic_text = self.pronunciation_map.get(label, label)
        cache_path = self._get_cache_path(label)
        
        if cache_path.exists():
            return f"/audio/{cache_path.name}"
        
        # Generate if not exists
        self.generate_audio(label)
        
        if cache_path.exists():
            return f"/audio/{cache_path.name}"
        
        return None
    
    def pregenerate_all(self) -> None:
        """Pre-generate audio for all labels"""
        logger.info("Pre-generating TTS audio for all labels...")
        
        for label in settings.LABELS:
            self.generate_audio(label)
        
        logger.info("TTS pre-generation complete")
    
    def clear_cache(self) -> int:
        """Clear audio cache and return number of files deleted"""
        count = 0
        for file in self.cache_dir.glob("*.mp3"):
            file.unlink()
            count += 1
        
        logger.info(f"Cleared {count} cached audio files")
        return count


# Singleton instance
tts_service = TTSService()