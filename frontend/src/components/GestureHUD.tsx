import React from 'react';
import { DecodedGesture } from '../engine/gestureDecoder';
import { ZONA_MAKHRAJ, HARAKAT as HARAKAT_DATA } from '../data/quranData';
import { EngineState } from '../engine/surahEngine';

interface GestureHUDProps {
    decoded: DecodedGesture | null;
    stabilityProgress: { zonaProgress: number; harakatProgress: number };
    engineState: EngineState;
}

const GestureHUD: React.FC<GestureHUDProps> = ({ decoded, stabilityProgress, engineState }) => {
    const rightFingers = decoded?.rightHand?.fingerCount ?? 0;
    const leftFingers = decoded?.leftHand?.fingerCount ?? 0;
    const rightOrientation = decoded?.rightHand?.orientation ?? '—';
    const leftIsFist = decoded?.leftHand?.isFist ?? false;
    const rightConf = decoded?.rightHand?.confidence ?? 0;
    const leftConf = decoded?.leftHand?.confidence ?? 0;

    const zonaName = ZONA_MAKHRAJ[rightFingers]?.name || '—';
    const harakatName = HARAKAT_DATA[leftFingers]?.name || '—';

    const zonaMatch = rightFingers === engineState.expectedZona;
    const harakatMatch = leftFingers === engineState.expectedHarakat;

    return (
        <div className="gesture-hud">
            {/* Right Hand */}
            <div className="hud-hand">
                <div className="hud-hand-header">
                    <span className="hud-hand-icon">🤚</span>
                    <span className="hud-hand-label">Tangan Kanan</span>
                    <span className={`hud-conf ${rightConf >= 0.85 ? 'conf-good' : 'conf-low'}`}>
                        {(rightConf * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="hud-values">
                    <div className="hud-value-row">
                        <span className="hud-key">Jari:</span>
                        <span className={`hud-val finger-count ${zonaMatch ? 'match' : rightFingers > 0 ? 'mismatch' : ''}`}>
                            {rightFingers > 0 ? `${rightFingers} → ${zonaName}` : '—'}
                        </span>
                    </div>
                    <div className="hud-value-row">
                        <span className="hud-key">Orientasi:</span>
                        <span className="hud-val">{rightOrientation}</span>
                    </div>
                    <div className="hud-stability-bar">
                        <div
                            className="hud-stability-fill zona-fill"
                            style={{ width: `${stabilityProgress.zonaProgress * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* Left Hand */}
            <div className="hud-hand">
                <div className="hud-hand-header">
                    <span className="hud-hand-icon">✋</span>
                    <span className="hud-hand-label">Tangan Kiri</span>
                    <span className={`hud-conf ${leftConf >= 0.85 ? 'conf-good' : 'conf-low'}`}>
                        {(leftConf * 100).toFixed(0)}%
                    </span>
                </div>
                <div className="hud-values">
                    <div className="hud-value-row">
                        <span className="hud-key">Jari:</span>
                        <span className={`hud-val finger-count ${harakatMatch ? 'match' : leftFingers > 0 ? 'mismatch' : ''}`}>
                            {leftFingers > 0 ? `${leftFingers} → ${harakatName}` : '—'}
                        </span>
                    </div>
                    <div className="hud-value-row">
                        <span className="hud-key">Syaddah:</span>
                        <span className={`hud-val ${leftIsFist ? 'syaddah-active' : ''}`}>
                            {leftIsFist ? '✿ Genggam (Syaddah)' : '—'}
                        </span>
                    </div>
                    <div className="hud-stability-bar">
                        <div
                            className="hud-stability-fill harakat-fill"
                            style={{ width: `${stabilityProgress.harakatProgress * 100}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* No hands detected */}
            {!decoded?.rightHand && !decoded?.leftHand && (
                <div className="hud-no-hand">
                    <p>Angkat kedua tangan di depan kamera</p>
                </div>
            )}
        </div>
    );
};

export default GestureHUD;
