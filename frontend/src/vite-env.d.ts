/// <reference types="vite/client" />

declare module '@mediapipe/hands' {
  export interface NormalizedLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }

  export interface Results {
    multiHandLandmarks?: NormalizedLandmark[][];
    multiHandedness?: Array<{ label: string; score: number }>;
    image: HTMLCanvasElement;
  }

  export interface HandsConfig {
    locateFile: (file: string) => string;
  }

  export interface HandsOptions {
    maxNumHands: number;
    modelComplexity: number;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
  }

  export const HAND_CONNECTIONS: Array<[number, number]>;

  export class Hands {
    constructor(config: HandsConfig);
    setOptions(options: HandsOptions): void;
    onResults(callback: (results: Results) => void): void;
    send(input: { image: HTMLVideoElement | HTMLImageElement }): Promise<void>;
    close(): void;
  }
}

declare module '@mediapipe/camera_utils' {
  export interface CameraConfig {
    onFrame: () => Promise<void>;
    width?: number;
    height?: number;
    facingMode?: string;
  }

  export class Camera {
    constructor(video: HTMLVideoElement, config: CameraConfig);
    start(): Promise<void>;
    stop(): void;
  }
}

declare module '@mediapipe/drawing_utils' {
  import { NormalizedLandmark } from '@mediapipe/hands';

  export interface DrawingOptions {
    color?: string;
    lineWidth?: number;
    radius?: number;
  }

  export function drawConnectors(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    connections: Array<[number, number]>,
    options?: DrawingOptions
  ): void;

  export function drawLandmarks(
    ctx: CanvasRenderingContext2D,
    landmarks: NormalizedLandmark[],
    options?: DrawingOptions
  ): void;
}