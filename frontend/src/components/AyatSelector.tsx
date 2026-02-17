import React from 'react';
import { AYAT } from '../data/quranData';

interface AyatSelectorProps {
    currentAyat: number;
    onSelect: (index: number) => void;
    onReset: () => void;
}

const AyatSelector: React.FC<AyatSelectorProps> = ({ currentAyat, onSelect, onReset }) => {
    return (
        <div className="ayat-selector">
            <div className="selector-header">
                <span>Pilih Ayat</span>
                <button className="btn-ghost" onClick={onReset}>Reset</button>
            </div>
            <div className="selector-grid">
                {AYAT.map((ayat, i) => (
                    <button
                        key={i}
                        className={`selector-btn ${i === currentAyat ? 'selector-active' : ''}`}
                        onClick={() => onSelect(i)}
                    >
                        <span className="selector-num">{ayat.ayat_number}</span>
                        <span className="selector-preview" dir="rtl">
                            {ayat.text_arabic.substring(0, 20)}...
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AyatSelector;
