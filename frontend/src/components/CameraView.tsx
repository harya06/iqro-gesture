import React, { useEffect, useRef, useState, useCallback } from "react";
import { LandmarkArray, ConnectionState, DEFAULT_CONFIG } from "../types";

interface CameraViewProps {
  onLandmarksDetected: (sequence: LandmarkArray[][]) => void;
  onHandDetected: (detected: boolean) => void;
  connectionState: ConnectionState;
}

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

const CameraView: React.FC<CameraViewProps> = ({
  onLandmarksDetected,
  onHandDetected,
  connectionState,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<any>(null);
  const animationRef = useRef<number>(0);
  const sequenceBufferRef = useRef<LandmarkArray[][]>([]);

  const [status, setStatus] = useState("Starting camera...");
  const [cameraReady, setCameraReady] = useState(false);
  const [mediapipeReady, setMediapipeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handDetected, setHandDetected] = useState(false);
  const [fps, setFps] = useState(0);

  const frameCountRef = useRef(0);
  const lastFpsTimeRef = useRef(Date.now());

  // Draw landmarks
  const drawHand = useCallback((ctx: CanvasRenderingContext2D, landmarks: any[], width: number, height: number) => {
    ctx.strokeStyle = "#00FF88";
    ctx.lineWidth = 3;

    for (const [i, j] of HAND_CONNECTIONS) {
      const start = landmarks[i];
      const end = landmarks[j];
      ctx.beginPath();
      ctx.moveTo(start.x * width, start.y * height);
      ctx.lineTo(end.x * width, end.y * height);
      ctx.stroke();
    }

    ctx.fillStyle = "#00D9FF";
    for (const lm of landmarks) {
      ctx.beginPath();
      ctx.arc(lm.x * width, lm.y * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }, []);

  // Process results
  const onResults = useCallback((results: any) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // FPS
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTimeRef.current = now;
    }

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      setHandDetected(true);
      onHandDetected(true);

      for (const landmarks of results.multiHandLandmarks) {
        drawHand(ctx, landmarks, canvas.width, canvas.height);

        const landmarkData: LandmarkArray[] = landmarks.map(
          (lm: any) => [lm.x, lm.y, lm.z] as LandmarkArray
        );

        sequenceBufferRef.current.push(landmarkData);

        if (sequenceBufferRef.current.length > DEFAULT_CONFIG.sequenceLength) {
          sequenceBufferRef.current = sequenceBufferRef.current.slice(-DEFAULT_CONFIG.sequenceLength);
        }

        if (sequenceBufferRef.current.length >= DEFAULT_CONFIG.sequenceLength) {
          onLandmarksDetected([...sequenceBufferRef.current]);
        }
      }
    } else {
      setHandDetected(false);
      onHandDetected(false);
    }
  }, [onLandmarksDetected, onHandDetected, drawHand]);

  // Step 1: Start camera
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startCamera = async () => {
      try {
        setStatus("Requesting camera access...");
        console.log("Requesting camera...");

        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          console.log("Camera started!");
          setStatus("Camera ready. Loading hand detection...");
          setCameraReady(true);
        }
      } catch (err: any) {
        console.error("Camera error:", err);
        setError("Camera error: " + err.message);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  // Step 2: Load MediaPipe after camera is ready
  useEffect(() => {
    if (!cameraReady) return;

    let isMounted = true;

    const loadMediaPipe = async () => {
      try {
        setStatus("Loading MediaPipe library...");
        console.log("Loading MediaPipe...");

        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js";
          script.crossOrigin = "anonymous";
          script.onload = () => {
            console.log("MediaPipe script loaded");
            resolve();
          };
          script.onerror = (e) => {
            console.error("Script load error:", e);
            reject(new Error("Failed to load MediaPipe script"));
          };
          document.head.appendChild(script);
        });

        await new Promise((r) => setTimeout(r, 1000));

        // @ts-ignore
        if (!window.Hands) {
          throw new Error("Hands class not found");
        }

        setStatus("Initializing hand detection model...");
        console.log("Creating Hands instance...");

        // @ts-ignore
        const hands = new window.Hands({
          locateFile: (file: string) => {
            console.log("Loading file:", file);
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 1,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.5,
        });

        hands.onResults(onResults);

        setStatus("Loading AI model...");
        console.log("Sending first frame to initialize model...");

        if (videoRef.current) {
          await hands.send({ image: videoRef.current });
        }

        handsRef.current = hands;

        if (isMounted) {
          console.log("MediaPipe ready!");
          setStatus("");
          setMediapipeReady(true);
        }

      } catch (err: any) {
        console.error("MediaPipe error:", err);
        if (isMounted) {
          setError("MediaPipe error: " + err.message);
        }
      }
    };

    loadMediaPipe();

    return () => {
      isMounted = false;
    };
  }, [cameraReady, onResults]);

  // Step 3: Run detection loop
  useEffect(() => {
    if (!mediapipeReady || !handsRef.current) return;

    let isMounted = true;

    const detect = async () => {
      if (!isMounted || !handsRef.current || !videoRef.current) return;

      try {
        if (videoRef.current.readyState >= 2) {
          await handsRef.current.send({ image: videoRef.current });
        }
      } catch (e) {
        console.error("Detection error:", e);
      }

      if (isMounted) {
        animationRef.current = requestAnimationFrame(detect);
      }
    };

    detect();

    return () => {
      isMounted = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [mediapipeReady]);

  useEffect(() => {
    return () => {
      if (handsRef.current) {
        handsRef.current.close();
      }
    };
  }, []);

  const getStatusColor = () => {
    switch (connectionState) {
      case "connected": return "connected";
      case "connecting": return "connecting";
      default: return "disconnected";
    }
  };

  const getStatusText = () => {
    switch (connectionState) {
      case "connected": return "Connected";
      case "connecting": return "Connecting...";
      default: return "Disconnected";
    }
  };

  if (error) {
    return (
      <div className="camera-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "15px" }}>
        <div style={{ fontSize: "3rem" }}>❌</div>
        <p style={{ color: "#ff4444" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: "10px 20px", background: "#00d9ff", border: "none", borderRadius: "5px", cursor: "pointer" }}
        >
          Reload
        </button>
      </div>
    );
  }

  // Shared mirror style for video and canvas
  const mirrorStyle: React.CSSProperties = {
    transform: "scaleX(-1)",
    width: "100%",
    height: "100%",
    objectFit: "cover" as const,
  };

  return (
    <div className={`camera-container ${handDetected ? "hand-detected" : ""}`}>
      {/* Video - mirrored */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{
          ...mirrorStyle,
          display: cameraReady ? "block" : "none",
        }}
      />

      {/* Canvas overlay - also mirrored to match video */}
      <canvas
        ref={canvasRef}
        style={{
          ...mirrorStyle,
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          display: mediapipeReady ? "block" : "none",
        }}
      />

      {/* Loading overlay */}
      {status && (
        <div style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: cameraReady ? "rgba(0,0,0,0.7)" : "#0a0a0a",
          flexDirection: "column",
          gap: "15px"
        }}>
          <div style={{ fontSize: "2rem" }}>⏳</div>
          <p style={{ textAlign: "center", padding: "0 20px" }}>{status}</p>
          {cameraReady && (
            <p style={{ fontSize: "0.8rem", color: "#888" }}>
              Camera is working, loading AI model...
            </p>
          )}
        </div>
      )}

      {/* Status badges */}
      {mediapipeReady && (
        <>
          <div className="status-overlay">
            <div className="status-badge">
              <div className={`status-dot ${getStatusColor()}`} />
              <span>{getStatusText()}</span>
            </div>
            <div className="status-badge">
              <span>{handDetected ? "Hand Detected" : "No Hand"}</span>
            </div>
          </div>
          <div className="fps-counter">{fps} FPS</div>
        </>
      )}
    </div>
  );
};

export default CameraView;
