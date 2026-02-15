// ============================================================
// CONSTRAINED SURAH ENGINE
// Manages progression through Al-Fatihah in training mode
// ============================================================

import { AYAT, CHUNK_GESTURE_MAP, ZONA_MAKHRAJ, HARAKAT as HARAKAT_DATA } from '../data/quranData';
import { StableZone } from './gestureDecoder';

export interface EngineState {
    currentAyat: number;       // 0-indexed ayat
    currentChunk: number;      // 0-indexed chunk within ayat
    totalChunks: number;       // total chunks in current ayat
    isComplete: boolean;       // surah completed
    ayatComplete: boolean;     // current ayat completed
    lastResult: 'idle' | 'correct' | 'wrong' | 'waiting';
    expectedZona: number;
    expectedHarakat: number;
    expectedChunk: string;
    hint: string;
    progress: number;          // 0-1 overall progress
}

export class ConstrainedSurahEngine {
    private currentAyat: number = 0;
    private currentChunk: number = 0;
    private lastResult: 'idle' | 'correct' | 'wrong' | 'waiting' = 'idle';
    private lastConfirmTime: number = 0;
    private cooldownMs: number = 500; // prevent rapid-fire confirmations

    reset(): void {
        this.currentAyat = 0;
        this.currentChunk = 0;
        this.lastResult = 'idle';
        this.lastConfirmTime = 0;
    }

    goToAyat(ayatIndex: number): void {
        if (ayatIndex >= 0 && ayatIndex < AYAT.length) {
            this.currentAyat = ayatIndex;
            this.currentChunk = 0;
            this.lastResult = 'idle';
        }
    }

    getState(): EngineState {
        const ayat = AYAT[this.currentAyat];
        if (!ayat) {
            return {
                currentAyat: this.currentAyat,
                currentChunk: this.currentChunk,
                totalChunks: 0,
                isComplete: true,
                ayatComplete: true,
                lastResult: this.lastResult,
                expectedZona: 0,
                expectedHarakat: 0,
                expectedChunk: '',
                hint: 'Selesai!',
                progress: 1
            };
        }

        const chunk = ayat.phonetic_chunks[this.currentChunk] || '';
        const mapping = CHUNK_GESTURE_MAP[chunk] || { zona: 1, harakat: 1 };
        const ayatComplete = this.currentChunk >= ayat.phonetic_chunks.length;

        // Calculate overall progress
        let totalChunksBefore = 0;
        let totalChunksAll = 0;
        for (let i = 0; i < AYAT.length; i++) {
            if (i < this.currentAyat) totalChunksBefore += AYAT[i].phonetic_chunks.length;
            totalChunksAll += AYAT[i].phonetic_chunks.length;
        }
        totalChunksBefore += this.currentChunk;
        const progress = totalChunksAll > 0 ? totalChunksBefore / totalChunksAll : 0;

        const zonaInfo = ZONA_MAKHRAJ[mapping.zona];
        const harakatInfo = HARAKAT_DATA[mapping.harakat];

        const hint = `Zona: ${mapping.zona} (${zonaInfo?.name || '?'}) + Harakat: ${mapping.harakat} (${harakatInfo?.name || '?'})`;

        return {
            currentAyat: this.currentAyat,
            currentChunk: this.currentChunk,
            totalChunks: ayat.phonetic_chunks.length,
            isComplete: this.currentAyat >= AYAT.length,
            ayatComplete,
            lastResult: this.lastResult,
            expectedZona: mapping.zona,
            expectedHarakat: mapping.harakat,
            expectedChunk: chunk,
            hint,
            progress
        };
    }

    // Evaluate a stable gesture against the current expected chunk
    evaluate(stableZone: StableZone): {
        correct: boolean;
        chunkIndex: number;
        ayatIndex: number;
        chunk: string;
        shouldPlayAudio: boolean;
        ayatComplete: boolean;
        surahComplete: boolean;
    } {
        const now = Date.now();

        // Cooldown check
        if (now - this.lastConfirmTime < this.cooldownMs) {
            return {
                correct: false,
                chunkIndex: this.currentChunk,
                ayatIndex: this.currentAyat,
                chunk: '',
                shouldPlayAudio: false,
                ayatComplete: false,
                surahComplete: false
            };
        }

        const ayat = AYAT[this.currentAyat];
        if (!ayat || this.currentChunk >= ayat.phonetic_chunks.length) {
            return {
                correct: false,
                chunkIndex: this.currentChunk,
                ayatIndex: this.currentAyat,
                chunk: '',
                shouldPlayAudio: false,
                ayatComplete: this.currentChunk >= (ayat?.phonetic_chunks.length || 0),
                surahComplete: this.currentAyat >= AYAT.length
            };
        }

        const expectedChunk = ayat.phonetic_chunks[this.currentChunk];
        const mapping = CHUNK_GESTURE_MAP[expectedChunk] || { zona: 1, harakat: 1 };

        const zonaCorrect = stableZone.zona === mapping.zona;
        const harakatCorrect = stableZone.harakat === mapping.harakat;
        const correct = zonaCorrect && harakatCorrect;

        if (correct) {
            this.lastResult = 'correct';
            this.lastConfirmTime = now;
            const chunkIndex = this.currentChunk;
            const ayatIndex = this.currentAyat;

            // Advance
            this.currentChunk++;
            let ayatComplete = false;
            let surahComplete = false;

            if (this.currentChunk >= ayat.phonetic_chunks.length) {
                ayatComplete = true;
                this.currentAyat++;
                this.currentChunk = 0;

                if (this.currentAyat >= AYAT.length) {
                    surahComplete = true;
                }
            }

            return {
                correct: true,
                chunkIndex,
                ayatIndex,
                chunk: expectedChunk,
                shouldPlayAudio: true,
                ayatComplete,
                surahComplete
            };
        } else {
            this.lastResult = 'wrong';
            this.lastConfirmTime = now;
            return {
                correct: false,
                chunkIndex: this.currentChunk,
                ayatIndex: this.currentAyat,
                chunk: expectedChunk,
                shouldPlayAudio: false,
                ayatComplete: false,
                surahComplete: false
            };
        }
    }

    // Get all chunks for current ayat with completion status
    getAyatChunks(): Array<{ chunk: string; index: number; status: 'done' | 'current' | 'pending' }> {
        const ayat = AYAT[this.currentAyat];
        if (!ayat) return [];

        return ayat.phonetic_chunks.map((chunk, i) => ({
            chunk,
            index: i,
            status: i < this.currentChunk ? 'done' : i === this.currentChunk ? 'current' : 'pending'
        }));
    }
}
