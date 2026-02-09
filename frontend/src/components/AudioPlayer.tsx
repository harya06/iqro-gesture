import React, { useRef, useEffect, useCallback } from 'react';

interface AudioPlayerProps {
  audioBase64: string | null;
  audioFormat: string;
  onPlayStart?: () => void;
  onPlayEnd?: () => void;
}

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  audioFormat,
  onPlayStart,
  onPlayEnd
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastPlayedRef = useRef<string | null>(null);

  const playAudio = useCallback(async () => {
    if (!audioRef.current || !audioBase64) return;
    
    // Don't replay the same audio
    if (audioBase64 === lastPlayedRef.current) return;
    
    try {
      // Create audio source from base64
      const audioSrc = `data:audio/${audioFormat};base64,${audioBase64}`;
      audioRef.current.src = audioSrc;
      
      lastPlayedRef.current = audioBase64;
      onPlayStart?.();
      
      await audioRef.current.play();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [audioBase64, audioFormat, onPlayStart]);

  useEffect(() => {
    if (audioBase64) {
      playAudio();
    }
  }, [audioBase64, playAudio]);

  const handleEnded = useCallback(() => {
    onPlayEnd?.();
  }, [onPlayEnd]);

  return (
    <audio
      ref={audioRef}
      className="audio-player"
      onEnded={handleEnded}
      onError={(e) => console.error('Audio error:', e)}
    />
  );
};

export default AudioPlayer;