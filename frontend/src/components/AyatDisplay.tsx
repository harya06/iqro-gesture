import React from 'react';
import { AYAT } from '../data/quranData';
import { EngineState } from '../engine/surahEngine';

interface AyatDisplayProps {
    engineState: EngineState;
    chunks: Array<{ chunk: string; index: number; status: 'done' | 'current' | 'pending' }>;
    flashResult: 'correct' | 'wrong' | null;
}

const AyatDisplay: React.FC<AyatDisplayProps> = ({ engineState, chunks, flashResult }) => {
    const ayat = AYAT[engineState.currentAyat];
    if (!ayat) return null;

    return (
        <div className="ayat-display">
            <div className="ayat-header">
                <span className="ayat-number-badge">{ayat.ayat_number}</span>
                <span className="ayat-label">Ayat {ayat.ayat_number} dari 7</span>
            </div>

            {/* Arabic text */}
            <div className="arabic-text" dir="rtl">
                {ayat.text_arabic}
            </div>

            {/* Phonetic chunks */}
            <div className="chunks-container">
                {chunks.map((c, i) => (
                    <span
                        key={`${engineState.currentAyat}-${i}`}
                        className={`chunk-pill ${c.status} ${c.status === 'current' && flashResult === 'correct' ? 'chunk-correct-flash' :
                                c.status === 'current' && flashResult === 'wrong' ? 'chunk-wrong-flash' : ''
                            }`}
                    >
                        {c.chunk}
                    </span>
                ))}
            </div>

            {/* Current target */}
            <div className="current-target">
                <div className="target-label">Target:</div>
                <div className={`target-chunk ${flashResult === 'correct' ? 'target-correct' : flashResult === 'wrong' ? 'target-wrong' : ''}`}>
                    {engineState.expectedChunk || '—'}
                </div>
                <div className="target-gesture">
                    <span className="gesture-tag zona-tag">
                        🤚 Zona {engineState.expectedZona}
                    </span>
                    <span className="gesture-tag harakat-tag">
                        ✋ Harakat {engineState.expectedHarakat}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AyatDisplay;
