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
    private lastConfirmedSignature: string = '';

    private waitingForRelease: boolean = false;

    reset(): void {
        this.currentAyat = 0;
        this.currentChunk = 0;
        this.lastResult = 'idle';
        this.lastConfirmTime = 0;
        this.waitingForRelease = false;
    }

    goToAyat(ayatIndex: number): void {
        if (ayatIndex >= 0 && ayatIndex < AYAT.length) {
            this.currentAyat = ayatIndex;
            this.currentChunk = 0;
            this.lastResult = 'idle';
            this.waitingForRelease = false;
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

        let hint = `Zona: ${mapping.zona} (${zonaInfo?.name || '?'}) + Harakat: ${mapping.harakat} (${harakatInfo?.name || '?'})`;
        if (this.waitingForRelease) {
            hint = "Lepaskan gesture / Ganti gerakan...";
        }

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

        // If waiting for release, we check if the gesture is *different* from expectation or unstable (stableZone is null handled by caller, but here stableZone is passed if stable)
        // If we receive a stableZone here, it means the user is HOLDING a stable gesture.
        // We need to check if it's the SAME as the one we just confirmed?
        // Actually, simplest is: if waitingForRelease, we reject *everything* until the user does something else?
        // But "stableZone" is only valid if stable.
        // If the user maintains the SAME stable gesture, this function keeps getting called with the SAME data.
        // So we must reject if waitingForRelease.
        if (this.waitingForRelease) {
            // We only clear the flag if the gesture changes significantly or becomes unstable. 
            // Since this evaluate() is only called when STABLE, we might need a way to detect "unstable".
            // However, the caller (AlFatihahApp) only calls evaluate() when stableZone is present.
            // So if we are here, the user is still holding a stable gesture.

            // If the current stable gesture is DIFFERENT from the target, maybe they are transitioning? 
            // But to be safe: we require the user to BREAK the stability (i.e. caller won't call evaluate) OR match a *different* gesture.

            // Wait, if the caller only calls evaluate when stable, then we can't detect "unstable" here easily unless we track time.
            // BUT, if the user moves hands, stability is lost, and the caller STOPS calling evaluate().
            // So, if evaluate() IS called, it means user is holding something stable.
            // We should only proceed if the gesture does NOT match the *previous* success?
            // No, because the next step might require the *same* gesture.
            // So we strictly require a GAP in stability. 
            // But we can't detect the gap here because this function isn't called during the gap.

            // SOLUTION: The Engine expects the Caller to handle the "reset" of stability?
            // No, the engine manages logic. 
            // We can check: Is the detected gesture DIFFERENT from the one required for the *current* step?
            // If we are waiting for release, and the user is holding the *correct* gesture for the *next* step (which happens to be the same as prev),
            // we MUST ignore it until they break it.

            // How do we know if they broke it? 
            // We can use a timestamp. If `now` is close to `lastConfirmTime`, assume IT IS THE SAME HOLD.
            // If `now - lastConfirmTime > 2000` (2 seconds), maybe we accept it again? No, that's annoying.

            // Better: We track `lastStableZoneSignature`.
            // If `waitingForRelease` is true:
            //    If `currentSignature` != `lastSignature`, then Release is Done -> set waitingForRelease = false -> proceed to check.
            //    Else (signature same), return false.

            // Issue: StableZone doesn't have a unique ID, but has zona/harakat.
            const currentSig = `${stableZone.zona}-${stableZone.harakat}`;
            // We need to store last confirmed signature.
            if (this.lastConfirmedSignature === currentSig) {
                return {
                    correct: false,
                    chunkIndex: this.currentChunk,
                    ayatIndex: this.currentAyat,
                    chunk: '',
                    shouldPlayAudio: false,
                    ayatComplete: false,
                    surahComplete: false
                };
            } else {
                // User changed gesture to something else stable. 
                // We consider release done.
                this.waitingForRelease = false;
            }
        }

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
            this.waitingForRelease = true;
            this.lastConfirmedSignature = `${stableZone.zona}-${stableZone.harakat}`;

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

    // Called when the tracker loses stability (hands moved/lost)
    notifyUnstable(): void {
        this.waitingForRelease = false;
        this.lastConfirmedSignature = '';
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
