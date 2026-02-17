import React, { useState, useCallback, useEffect } from 'react';
import CameraView from './components/CameraView';
import GestureIndicator from './components/GestureIndicator';
import AudioPlayer from './components/AudioPlayer';
import { useWebSocket } from './hooks/useWebSocket';
import { LandmarkArray, DetectionState } from './types';
import './App.css';

const App: React.FC = () => {
  const {
    connectionState,
    lastPrediction,
    connect,
    disconnect,
    sendLandmarks,
    sessionId
  } = useWebSocket();

  const [handDetected, setHandDetected] = useState<boolean>(false);
  const [detectionState, setDetectionState] = useState<DetectionState>('idle');
  const [audioData, setAudioData] = useState<{
    base64: string | null;
    format: string;
  }>({ base64: null, format: 'mp3' });

  // Update detection state based on hand and connection
  useEffect(() => {
    if (!handDetected) {
      setDetectionState('waiting');
    } else if (connectionState === 'connected') {
      setDetectionState('detecting');
    } else {
      setDetectionState('idle');
    }
  }, [handDetected, connectionState]);

  // Handle new predictions
  useEffect(() => {
    if (lastPrediction?.audio_base64) {
      setAudioData({
        base64: lastPrediction.audio_base64,
        format: lastPrediction.audio_format || 'mp3'
      });
    }
  }, [lastPrediction]);

  const handleLandmarksDetected = useCallback((sequence: LandmarkArray[][]) => {
    if (connectionState === 'connected') {
      sendLandmarks(sequence);
    }
  }, [connectionState, sendLandmarks]);

  const handleHandDetected = useCallback((detected: boolean) => {
    setHandDetected(detected);
  }, []);

  const handlePlayStart = useCallback(() => {
    setDetectionState('speaking');
  }, []);

  const handlePlayEnd = useCallback(() => {
    setDetectionState(handDetected ? 'detecting' : 'waiting');
  }, [handDetected]);

  // Auto-connect on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Iqro Gesture Recognition</h1>
        <p>Learn Arabic letters through hand gestures</p>
      </header>

      <main className="main-content">
        <CameraView
          onLandmarksDetected={handleLandmarksDetected}
          onHandDetected={handleHandDetected}
          connectionState={connectionState}
        />

        <GestureIndicator
          detectionState={detectionState}
          prediction={lastPrediction}
          handDetected={handDetected}
        />

        <AudioPlayer
          audioBase64={audioData.base64}
          audioFormat={audioData.format}
          onPlayStart={handlePlayStart}
          onPlayEnd={handlePlayEnd}
        />

        <div className="connection-controls">
          {connectionState === 'connected' ? (
            <button
              className="control-button disconnect"
              onClick={disconnect}
            >
              Disconnect
            </button>
          ) : (
            <button
              className="control-button connect"
              onClick={connect}
              disabled={connectionState === 'connecting'}
            >
              {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '10px' }}>
          Session: {sessionId}
        </div>
      </main>
    </div>
  );
};

export default App;