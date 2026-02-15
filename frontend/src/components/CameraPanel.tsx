import React from 'react';

interface CameraPanelProps {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    status: string;
    error: string | null;
    cameraReady: boolean;
    mediapipeReady: boolean;
}

const CameraPanel: React.FC<CameraPanelProps> = ({
    videoRef, canvasRef, status, error, cameraReady, mediapipeReady
}) => {
    if (error) {
        return (
            <div className="camera-panel camera-error">
                <div className="error-content">
                    <div className="error-icon">❌</div>
                    <p>{error}</p>
                    <button className="btn-primary" onClick={() => window.location.reload()}>
                        Muat Ulang
                    </button>
                </div>
            </div>
        );
    }

    const mirrorStyle: React.CSSProperties = {
        transform: 'scaleX(-1)',
        width: '100%',
        height: '100%',
        objectFit: 'cover',
    };

    return (
        <div className="camera-panel">
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                    ...mirrorStyle,
                    display: cameraReady ? 'block' : 'none',
                }}
            />
            <canvas
                ref={canvasRef}
                style={{
                    ...mirrorStyle,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    display: mediapipeReady ? 'block' : 'none',
                }}
            />

            {/* Loading overlay */}
            {status && (
                <div className="camera-loading">
                    <div className="loading-spinner"></div>
                    <p className="loading-text">{status}</p>
                    {cameraReady && (
                        <p className="loading-hint">Kamera berfungsi, memuat model AI...</p>
                    )}
                </div>
            )}

            {/* Two-hand instruction overlay */}
            {mediapipeReady && (
                <div className="camera-overlay-badges">
                    <div className="cam-badge right-badge">🤚 Kanan = Zona</div>
                    <div className="cam-badge left-badge">✋ Kiri = Harakat</div>
                </div>
            )}
        </div>
    );
};

export default CameraPanel;
