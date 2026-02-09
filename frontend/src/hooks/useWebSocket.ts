import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ConnectionState, 
  WSResponse, 
  PredictionResponse,
  LandmarkArray,
  DEFAULT_CONFIG 
} from '../types';
import websocketService from '../services/websocketService';

interface UseWebSocketReturn {
  connectionState: ConnectionState;
  lastPrediction: PredictionResponse['data'] | null;
  connect: () => void;
  disconnect: () => void;
  sendLandmarks: (sequence: LandmarkArray[][]) => void;
  sessionId: string;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [lastPrediction, setLastPrediction] = useState<PredictionResponse['data'] | null>(null);
  const lastSendTime = useRef<number>(0);

  useEffect(() => {
    // Handle connection state changes
    const unsubConnection = websocketService.onConnectionChange((connected) => {
      setConnectionState(connected ? 'connected' : 'disconnected');
    });

    // Handle incoming messages
    const unsubMessage = websocketService.onMessage((response: WSResponse) => {
      switch (response.type) {
        case 'connected':
          console.log('Connected:', response.data);
          break;
          
        case 'prediction':
          const predictionData = (response as PredictionResponse).data;
          setLastPrediction(predictionData);
          break;
          
        case 'error':
          console.error('Server error:', response.data);
          break;
          
        case 'pong':
          console.log('Pong received');
          break;
          
        default:
          console.log('Unknown message type:', response.type);
      }
    });

    return () => {
      unsubConnection();
      unsubMessage();
    };
  }, []);

  const connect = useCallback(() => {
    setConnectionState('connecting');
    websocketService.connect();
  }, []);

  const disconnect = useCallback(() => {
    websocketService.disconnect();
    setConnectionState('disconnected');
    setLastPrediction(null);
  }, []);

  const sendLandmarks = useCallback((sequence: LandmarkArray[][]) => {
    const now = Date.now();
    
    // Throttle sending to avoid overwhelming the server
    if (now - lastSendTime.current < DEFAULT_CONFIG.sendInterval) {
      return;
    }
    
    if (sequence.length >= DEFAULT_CONFIG.sequenceLength) {
      websocketService.sendLandmarks(sequence);
      lastSendTime.current = now;
    }
  }, []);

  return {
    connectionState,
    lastPrediction,
    connect,
    disconnect,
    sendLandmarks,
    sessionId: websocketService.getSessionId()
  };
}

export default useWebSocket;