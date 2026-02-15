import React from 'react';
import { AYAT } from '../data/quranData';
import { EngineState } from '../engine/surahEngine';

interface ProgressBarProps {
    engineState: EngineState;
    surahComplete: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ engineState, surahComplete }) => {
    return (
        <div className="progress-section">
            <div className="progress-header">
                <span className="progress-title">📿 Progres Al-Fatihah</span>
                <span className="progress-percent">{(engineState.progress * 100).toFixed(0)}%</span>
            </div>
            <div className="progress-track">
                <div
                    className="progress-fill"
                    style={{ width: `${engineState.progress * 100}%` }}
                />
            </div>
            <div className="progress-ayat-dots">
                {AYAT.map((ayat, i) => (
                    <div
                        key={i}
                        className={`ayat-dot ${i < engineState.currentAyat ? 'dot-done' :
                                i === engineState.currentAyat ? 'dot-active' : 'dot-pending'
                            }`}
                        title={`Ayat ${ayat.ayat_number}`}
                    >
                        {ayat.ayat_number}
                    </div>
                ))}
            </div>
            {/* Chunk progress within current ayat */}
            <div className="chunk-progress-text">
                Chunk {engineState.currentChunk + 1} / {engineState.totalChunks} — Ayat {engineState.currentAyat + 1}
            </div>
        </div>
    );
};

export default ProgressBar;
