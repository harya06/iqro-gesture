// ============================================================
// AL-FATIHAH GESTURE READER – Main Application
// Fixed: stable refs for callbacks, throttled state updates,
// decoupled detection loop from React render cycle
// ============================================================

import { useState, useEffect, useRef, useCallback } from 'react';
import { AYAT, ZONA_MAKHRAJ, HARAKAT as HARAKAT_DATA } from './data/quranData';
import { decodeFrame, StabilityTracker, DecodedGesture, HandLandmark } from './engine/gestureDecoder';
import { ConstrainedSurahEngine, EngineState } from './engine/surahEngine';
import { PhoneticPlayer } from './engine/phoneticPlayer';
import CameraPanel from './components/CameraPanel';
import AyatDisplay from './components/AyatDisplay';
import GestureHUD from './components/GestureHUD';
import ProgressBar from './components/ProgressBar';
import HintPanel from './components/HintPanel';
import AyatSelector from './components/AyatSelector';
import './AlFatihahApp.css';

declare global {
    interface Window {
        Hands: any;
    }
}

const HAND_CONNECTIONS = [
    [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12], [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20], [5, 9], [9, 13], [13, 17]
];

// State update throttle (ms) – UI refreshes at ~20fps, detection runs full speed
const UI_THROTTLE_MS = 50;

const AlFatihahApp = () => {
    // ── Refs (mutable, don't trigger re-renders) ─────────────────
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const handsRef = useRef<any>(null);
    const animationRef = useRef<number>(0);
    const stabilityRef = useRef(new StabilityTracker());
    const engineRef = useRef(new ConstrainedSurahEngine());
    const playerRef = useRef(new PhoneticPlayer());
    const lastEvalTime = useRef<number>(0);
    const lastUIUpdateTime = useRef<number>(0);
    const frameCountRef = useRef(0);
    const lastFpsTimeRef = useRef(Date.now());
    const isProcessingRef = useRef(false);

    // Mutable gesture data (updated every frame, flushed to state periodically)
    const latestDecodedRef = useRef<DecodedGesture | null>(null);
    const latestStabilityRef = useRef({ zonaProgress: 0, harakatProgress: 0 });

    // ── State (only updated at throttled intervals) ──────────────
    const [status, setStatus] = useState<string>('Memulai kamera...');
    const [cameraReady, setCameraReady] = useState(false);
    const [mediapipeReady, setMediapipeReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fps, setFps] = useState(0);
    const [engineState, setEngineState] = useState<EngineState>(engineRef.current.getState());
    const [decodedGesture, setDecodedGesture] = useState<DecodedGesture | null>(null);
    const [stabilityProgress, setStabilityProgress] = useState({ zonaProgress: 0, harakatProgress: 0 });
    const [flashResult, setFlashResult] = useState<'correct' | 'wrong' | null>(null);
    const [showHint, setShowHint] = useState(false);
    const [ayatChunks, setAyatChunks] = useState(engineRef.current.getAyatChunks());
    const [surahComplete, setSurahComplete] = useState(false);
    const [wrongCount, setWrongCount] = useState(0);

    // ── Draw hands directly on canvas (no React involvement) ─────
    // ── Draw hands using DECODED data for 100% consistency ─────
    const drawHands = (
        ctx: CanvasRenderingContext2D,
        decoded: DecodedGesture,
        w: number, h: number
    ) => {
        const hands = [
            { data: decoded.rightHand, label: 'Right', text: 'Kanan (Zona)' },
            { data: decoded.leftHand, label: 'Left', text: 'Kiri (Harakat)' }
        ];

        for (const hand of hands) {
            if (!hand.data || !hand.data.landmarks) continue;

            const lms = hand.data.landmarks;
            // No manual X-flip needed here

            const color = hand.label === 'Right' ? '#00FF88' : '#FF6B9D';
            const dotColor = hand.label === 'Right' ? '#00D9FF' : '#FFD93D';

            // Draw Skeleton
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.shadowColor = color;
            ctx.shadowBlur = 8;
            for (const [i, j] of HAND_CONNECTIONS) {
                ctx.beginPath();
                ctx.moveTo(lms[i].x * w, lms[i].y * h);
                ctx.lineTo(lms[j].x * w, lms[j].y * h);
                ctx.stroke();
            }
            ctx.shadowBlur = 0;

            // Draw Joints
            ctx.fillStyle = dotColor;
            for (const lm of lms) {
                ctx.beginPath();
                ctx.arc(lm.x * w, lm.y * h, 4, 0, Math.PI * 2);
                ctx.fill();
            }

            // Draw Label with Count
            // Un-mirror text horizontally
            const wrist = lms[0];
            const count = hand.data.fingerCount;
            const displayText = `${hand.text}: ${count}`;

            ctx.save();
            ctx.translate(wrist.x * w, wrist.y * h);
            ctx.scale(-1, 1);

            ctx.font = 'bold 24px Inter, sans-serif';
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(0,0,0,0.8)';
            ctx.lineWidth = 4;
            ctx.strokeText(displayText, -60, 40);
            ctx.fillText(displayText, -60, 40);

            ctx.restore();
        }
    };

    // ── onResults handler (stored in ref, never causes re-init) ──
    const onResultsRef = useRef<(results: any) => void>(() => { });

    useEffect(() => {
        // This effect just keeps the ref up to date with latest closure
        onResultsRef.current = (results: any) => {
            const canvas = canvasRef.current;
            const video = videoRef.current;
            if (!canvas || !video) return;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // FPS counter
            frameCountRef.current++;
            const now = Date.now();
            if (now - lastFpsTimeRef.current >= 1000) {
                setFps(frameCountRef.current);
                frameCountRef.current = 0;
                lastFpsTimeRef.current = now;
            }

            // 1) Decode gesture FIRST (pure computation)
            // This handles robust Left/Right assignment
            const decoded = decodeFrame(results.multiHandLandmarks, results.multiHandedness || []);
            latestDecodedRef.current = decoded;

            // 2) Draw hands using the DECODED result
            // This ensures visual labels/counts match exactly what the engine sees
            if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
                drawHands(ctx, decoded, canvas.width, canvas.height);
            }

            // 3) Stability tracking (pure computation)
            const stableZone = stabilityRef.current.update(decoded);
            latestStabilityRef.current = stabilityRef.current.getProgress();

            // 4) Evaluate if stable zone reached
            if (stableZone && now - lastEvalTime.current > 400) {
                lastEvalTime.current = now;
                const result = engineRef.current.evaluate(stableZone);

                if (result.correct) {
                    setFlashResult('correct');
                    playerRef.current.playChunk(result.chunk);
                    setTimeout(() => setFlashResult(null), 600);

                    if (result.ayatComplete) {
                        setTimeout(() => playerRef.current.playAyatComplete(), 300);
                    }
                    if (result.surahComplete) {
                        setSurahComplete(true);
                    }
                    setWrongCount(0);
                } else if (result.chunk) {
                    // Only flash wrong if we have a stable gesture but it doesn't match
                    setFlashResult('wrong');
                    playerRef.current.playError();
                    setTimeout(() => setFlashResult(null), 600);
                    setWrongCount(prev => {
                        const next = prev + 1;
                        if (next >= 3) setShowHint(true);
                        return next;
                    });
                }

                // Update engine state immediately on evaluation
                setEngineState(engineRef.current.getState());
                setAyatChunks(engineRef.current.getAyatChunks());
                stabilityRef.current.reset();
            }

            // 5) Throttled UI update (HUD)
            if (now - lastUIUpdateTime.current >= UI_THROTTLE_MS) {
                lastUIUpdateTime.current = now;
                setDecodedGesture({ ...decoded });
                setStabilityProgress({ ...latestStabilityRef.current });
            }
        };
    }); // No deps = runs every render to capture fresh closures

    // ── Camera initialization ──────────────────────────────────
    useEffect(() => {
        let stream: MediaStream | null = null;
        let isMounted = true;

        const startCamera = async () => {
            try {
                setStatus('Meminta akses kamera...');
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { width: 640, height: 480 },
                    audio: false
                });

                if (!isMounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                const video = videoRef.current;
                if (video) {
                    video.srcObject = stream;
                    await new Promise<void>((resolve) => {
                        video.onloadedmetadata = () => resolve();
                        if (video.readyState >= 1) resolve();
                    });

                    if (!isMounted) return;

                    try {
                        await video.play();
                    } catch (playErr: any) {
                        if (playErr.name === 'AbortError') {
                            console.warn('video.play() interrupted, retrying...');
                            await new Promise(r => setTimeout(r, 200));
                            if (isMounted && videoRef.current) {
                                await videoRef.current.play();
                            }
                        } else {
                            throw playErr;
                        }
                    }

                    if (isMounted) {
                        setStatus('Kamera siap. Memuat model tangan...');
                        setCameraReady(true);
                    }
                }
            } catch (err: any) {
                if (isMounted) {
                    setError('Gagal akses kamera: ' + err.message);
                }
            }
        };

        startCamera();
        return () => {
            isMounted = false;
            if (stream) stream.getTracks().forEach(t => t.stop());
        };
    }, []);

    // ── MediaPipe loading (NO onResults dependency!) ──────────────
    useEffect(() => {
        if (!cameraReady) return;
        let isMounted = true;

        const loadMediaPipe = async () => {
            try {
                setStatus('Memuat MediaPipe...');

                if (!window.Hands) {
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/hands.js';
                        script.crossOrigin = 'anonymous';
                        script.onload = () => resolve();
                        script.onerror = () => reject(new Error('Gagal memuat MediaPipe'));
                        document.head.appendChild(script);
                    });
                    await new Promise(r => setTimeout(r, 1000));
                }

                if (!window.Hands) throw new Error('Kelas Hands tidak ditemukan');

                setStatus('Inisialisasi model deteksi tangan...');

                const hands = new window.Hands({
                    locateFile: (file: string) =>
                        `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
                });

                hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 1,
                    minDetectionConfidence: 0.7,
                    minTrackingConfidence: 0.5
                });

                // STABLE callback wrapper — delegates to ref
                hands.onResults((results: any) => {
                    try {
                        onResultsRef.current(results);
                    } catch (e) {
                        console.error('onResults error:', e);
                    }
                });

                setStatus('Memuat model AI...');
                if (videoRef.current) {
                    await hands.send({ image: videoRef.current });
                }

                handsRef.current = hands;

                if (isMounted) {
                    setStatus('');
                    setMediapipeReady(true);
                }
            } catch (err: any) {
                if (isMounted) setError('MediaPipe error: ' + err.message);
            }
        };

        loadMediaPipe();
        return () => { isMounted = false; };
    }, [cameraReady]); // ← Only depends on cameraReady, NOT onResults

    // ── Detection loop (non-blocking) ────────────────────────────
    useEffect(() => {
        if (!mediapipeReady || !handsRef.current) return;
        let isMounted = true;

        const detect = async () => {
            if (!isMounted || !handsRef.current || !videoRef.current) return;

            // Prevent overlapping sends
            if (!isProcessingRef.current) {
                isProcessingRef.current = true;
                try {
                    if (videoRef.current.readyState >= 2) {
                        await handsRef.current.send({ image: videoRef.current });
                    }
                } catch (e) {
                    console.warn('Detection frame skip:', e);
                }
                isProcessingRef.current = false;
            }

            if (isMounted) {
                animationRef.current = requestAnimationFrame(detect);
            }
        };

        detect();
        return () => {
            isMounted = false;
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [mediapipeReady]);

    // ── Cleanup ────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            if (handsRef.current) handsRef.current.close();
            playerRef.current.destroy();
        };
    }, []);

    // ── Ayat selector ──────────────────────────────────────────
    const handleSelectAyat = useCallback((index: number) => {
        engineRef.current.goToAyat(index);
        stabilityRef.current.reset();
        setEngineState(engineRef.current.getState());
        setAyatChunks(engineRef.current.getAyatChunks());
        setShowHint(false);
        setWrongCount(0);
        setSurahComplete(false);
    }, []);

    const handleReset = useCallback(() => {
        engineRef.current.reset();
        stabilityRef.current.reset();
        setEngineState(engineRef.current.getState());
        setAyatChunks(engineRef.current.getAyatChunks());
        setShowHint(false);
        setWrongCount(0);
        setSurahComplete(false);
    }, []);

    // ── Render ─────────────────────────────────────────────────
    return (
        <div
            className={`app-container ${flashResult === 'correct' ? 'flash-correct' : flashResult === 'wrong' ? 'flash-wrong' : ''}`}
            onClick={() => {
                playerRef.current.start().catch(console.error);
            }}
        >
            {/* Header */}
            <header className="app-header">
                <div className="header-left">
                    <h1 className="app-title">
                        <span className="bismillah-icon">﷽</span>
                        <span>Al-Fatihah Gesture</span>
                    </h1>
                    <p className="app-subtitle">Baca Al-Fatihah dengan isyarat tangan</p>
                </div>
                <div className="header-right">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }}></span>
                        Audio Online
                    </div>
                    <div className="mode-badge">
                        <span className="mode-dot"></span>
                        Training Mode
                    </div>
                    {mediapipeReady && <div className="fps-badge">{fps} FPS</div>}
                </div>
            </header>

            <main className="main-layout">
                {/* Left Column: Camera + HUD */}
                <div className="left-column">
                    <CameraPanel
                        videoRef={videoRef}
                        canvasRef={canvasRef}
                        status={status}
                        error={error}
                        cameraReady={cameraReady}
                        mediapipeReady={mediapipeReady}
                    />

                    {mediapipeReady && (
                        <GestureHUD
                            decoded={decodedGesture}
                            stabilityProgress={stabilityProgress}
                            engineState={engineState}
                        />
                    )}
                </div>

                {/* Right Column: Ayat + Progress + Controls */}
                <div className="right-column">
                    <ProgressBar
                        engineState={engineState}
                        surahComplete={surahComplete}
                    />

                    <AyatDisplay
                        engineState={engineState}
                        chunks={ayatChunks}
                        flashResult={flashResult}
                    />

                    {showHint && (
                        <HintPanel
                            engineState={engineState}
                            onDismiss={() => { setShowHint(false); setWrongCount(0); }}
                        />
                    )}

                    <AyatSelector
                        currentAyat={engineState.currentAyat}
                        onSelect={handleSelectAyat}
                        onReset={handleReset}
                    />

                    {/* Legend */}
                    <div className="legend-panel">
                        <h3>Panduan Gesture</h3>
                        <div className="legend-grid">
                            <div className="legend-section">
                                <h4>Tangan Kanan – Zona Makhraj</h4>
                                <div className="legend-items">
                                    {Object.entries(ZONA_MAKHRAJ).map(([num, z]) => (
                                        <div key={num} className="legend-item">
                                            <span className="legend-num">{num}</span>
                                            <span className="legend-label">{z.name} ({z.description})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="legend-section">
                                <h4>Tangan Kiri – Harakat</h4>
                                <div className="legend-items">
                                    {Object.entries(HARAKAT_DATA).map(([num, h]) => (
                                        <div key={num} className="legend-item">
                                            <span className="legend-num">{num}</span>
                                            <span className="legend-label">{h.name} ({h.symbol})</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Surah Complete Modal */}
            {surahComplete && (
                <div className="modal-overlay">
                    <div className="modal-content completion-modal">
                        <div className="completion-icon">🎉</div>
                        <h2>ما شاء الله!</h2>
                        <p>Anda telah menyelesaikan Surah Al-Fatihah!</p>
                        <button className="btn-primary" onClick={handleReset}>
                            Ulangi dari Awal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AlFatihahApp;
