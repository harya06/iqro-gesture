import React from 'react';
import { ZONA_MAKHRAJ, HARAKAT as HARAKAT_DATA } from '../data/quranData';
import { EngineState } from '../engine/surahEngine';

interface HintPanelProps {
    engineState: EngineState;
    onDismiss: () => void;
}

const HintPanel: React.FC<HintPanelProps> = ({ engineState, onDismiss }) => {
    const zona = ZONA_MAKHRAJ[engineState.expectedZona];
    const harakat = HARAKAT_DATA[engineState.expectedHarakat];

    return (
        <div className="hint-panel">
            <div className="hint-header">
                <span>Petunjuk</span>
                <button className="hint-dismiss" onClick={onDismiss}>✕</button>
            </div>
            <div className="hint-content">
                <p className="hint-chunk-name">Chunk: <strong>"{engineState.expectedChunk}"</strong></p>

                <div className="hint-gesture-guide">
                    <div className="hint-gesture-item">
                        <div className="hint-hand-icon">🤚</div>
                        <div className="hint-detail">
                            <strong>Tangan Kanan: {engineState.expectedZona} jari</strong>
                            <p>Zona: {zona?.name} ({zona?.description})</p>
                            {zona?.letters.length > 0 && (
                                <p className="hint-letters">Huruf: {zona.letters.join(' ')}</p>
                            )}
                        </div>
                    </div>
                    <div className="hint-gesture-item">
                        <div className="hint-hand-icon">✋</div>
                        <div className="hint-detail">
                            <strong>Tangan Kiri: {engineState.expectedHarakat} jari</strong>
                            <p>Harakat: {harakat?.name} ({harakat?.symbol})</p>
                        </div>
                    </div>
                </div>

                <p className="hint-instruction">
                    Tahan kedua tangan stabil selama 200ms setelah menunjukkan jari yang benar.
                </p>
            </div>
        </div>
    );
};

export default HintPanel;
