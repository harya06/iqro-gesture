import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import CameraView from './CameraView';
import GestureIndicator from './GestureIndicator';
import AudioPlayer from './AudioPlayer';
import { useWebSocket } from '../hooks/useWebSocket';
import { LandmarkArray, DetectionState } from '../types';
import './MainApp.css';

const MainApp: React.FC = () => {
    const { user, logout } = useAuth();
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
    const [showMenu, setShowMenu] = useState(false);

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
        <div className="main-app">
            {/* Header dengan Navbar Modern */}
            <header className="app-navbar">
                <div className="navbar-content">
                    <div className="navbar-left">
                        <div className="app-logo">
                            <span className="logo-emoji">🤲</span>
                            <span className="logo-text">Iqro Gesture</span>
                        </div>
                    </div>

                    <div className="navbar-center">
                        <div className="status-pill">
                            <div className={`status-indicator ${connectionState}`}></div>
                            <span>{connectionState === 'connected' ? 'Online' : connectionState === 'connecting' ? 'Connecting...' : 'Offline'}</span>
                        </div>
                    </div>

                    <div className="navbar-right">
                        <div className="user-menu">
                            <button className="user-button" onClick={() => setShowMenu(!showMenu)}>
                                <div className="user-avatar">
                                    {user?.full_name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <span className="user-name">{user?.full_name || 'User'}</span>
                                <span className="dropdown-icon">{showMenu ? '▲' : '▼'}</span>
                            </button>

                            {showMenu && (
                                <div className="dropdown-menu">
                                    <div className="dropdown-header">
                                        <div className="dropdown-user-info">
                                            <strong>{user?.full_name}</strong>
                                            <span className="user-email">{user?.email}</span>
                                        </div>
                                    </div>
                                    <div className="dropdown-divider"></div>
                                    <button onClick={logout} className="dropdown-item logout">
                                        <span className="item-icon">🚪</span>
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="main-content-area">
                <div className="content-grid">
                    {/* Camera Section */}
                    <div className="camera-section">
                        <div className="section-card">
                            <div className="card-header">
                                <h2>📹 Live Detection</h2>
                                <p>Tunjukkan gerakan tangan Anda</p>
                            </div>
                            <CameraView
                                onLandmarksDetected={handleLandmarksDetected}
                                onHandDetected={handleHandDetected}
                                connectionState={connectionState}
                            />
                        </div>
                    </div>

                    {/* Results Section */}
                    <div className="results-section">
                        <div className="section-card">
                            <div className="card-header">
                                <h2>✨ Hasil Deteksi</h2>
                                <p>Huruf Hijaiyah yang terdeteksi</p>
                            </div>
                            <GestureIndicator
                                detectionState={detectionState}
                                prediction={lastPrediction}
                                handDetected={handDetected}
                            />
                        </div>

                        {/* Info Cards */}
                        <div className="info-cards">
                            <div className="info-card">
                                <div className="info-icon">🎯</div>
                                <div className="info-content">
                                    <h4>Deteksi Akurat</h4>
                                    <p>AI mendeteksi gerakan tangan dengan presisi tinggi</p>
                                </div>
                            </div>
                            <div className="info-card">
                                <div className="info-icon">👋</div>
                                <div className="info-content">
                                    <h4>Multi Hand</h4>
                                    <p>Support deteksi tangan kiri, kanan, atau keduanya</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <AudioPlayer
                    audioBase64={audioData.base64}
                    audioFormat={audioData.format}
                    onPlayStart={handlePlayStart}
                    onPlayEnd={handlePlayEnd}
                />

                {/* Connection Controls */}
                <div className="connection-panel">
                    <div className="session-info">
                        <span className="session-label">Session ID:</span>
                        <span className="session-id">{sessionId}</span>
                    </div>
                    {connectionState === 'connected' ? (
                        <button className="control-btn disconnect-btn" onClick={disconnect}>
                            <span className="btn-icon">⛔</span>
                            Disconnect
                        </button>
                    ) : (
                        <button
                            className="control-btn connect-btn"
                            onClick={connect}
                            disabled={connectionState === 'connecting'}
                        >
                            <span className="btn-icon">🔌</span>
                            {connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
                        </button>
                    )}
                </div>
            </main>

            {/* Footer */}
            <footer className="app-footer">
                <p>© 2026 Iqro Gesture Recognition - Belajar Huruf Hijaiyah dengan AI</p>
            </footer>
        </div>
    );
};

export default MainApp;
