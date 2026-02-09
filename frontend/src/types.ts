// Landmark types
export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export type LandmarkArray = [number, number, number];

export interface HandLandmarks {
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
}

// WebSocket message types
export interface WSMessage {
  type: string;
  data: Record<string, unknown>;
}

export interface LandmarkMessage {
  type: 'landmarks';
  data: {
    sequence: LandmarkArray[][];
    timestamp: number;
  };
}

export interface PredictionResponse {
  type: 'prediction';
  data: {
    label: string;
    arabic: string;
    confidence: number;
    class_index: number;
    timestamp: string;
    audio_base64?: string;
    audio_format?: string;
  };
}

export interface ErrorResponse {
  type: 'error';
  data: {
    message: string;
  };
}

export interface ConnectedResponse {
  type: 'connected';
  data: {
    session_id: string;
    message: string;
    labels: string[];
  };
}

export type WSResponse = PredictionResponse | ErrorResponse | ConnectedResponse | WSMessage;

// Application state types
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type DetectionState = 'waiting' | 'detecting' | 'speaking' | 'idle';

export interface AppState {
  connectionState: ConnectionState;
  detectionState: DetectionState;
  currentPrediction: PredictionResponse['data'] | null;
  handDetected: boolean;
  fps: number;
}

// Configuration
export interface AppConfig {
  wsUrl: string;
  sequenceLength: number;
  sendInterval: number;
  minConfidence: number;
}

export const DEFAULT_CONFIG: AppConfig = {
  wsUrl: `ws://${window.location.hostname}:8000/ws`,
  sequenceLength: 30,
  sendInterval: 500,  // ms between sends
  minConfidence: 0.5
};