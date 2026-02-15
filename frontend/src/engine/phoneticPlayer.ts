// ============================================================
// PHONETIC CHUNK AUDIO PLAYER
// Generates and plays audio for phonetic chunks using Web Audio API
// with Arabic-style pronunciation synthesis
// ============================================================

export class PhoneticPlayer {
    private audioContext: AudioContext | null = null;
    private isPlaying: boolean = false;

    constructor() {
        this.initContext();
    }

    private initContext(): void {
        try {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not available:', e);
        }
    }

    public async start(): Promise<void> {
        this.ensureContext();
        if (this.audioContext?.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    private ensureContext(): AudioContext {
        if (!this.audioContext || this.audioContext.state === 'closed') {
            this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        return this.audioContext;
    }

    // Play a single phonetic chunk (File -> Synthesis Fallback)
    async playChunk(chunk: string): Promise<void> {
        if (this.isPlaying) return;
        this.isPlaying = true;

        try {
            const ctx = this.ensureContext();

            if (ctx.state === 'suspended') {
                console.log("AudioContext suspended, attempting resume...");
                await ctx.resume();
            }

            // Sanitization
            const safeChunk = chunk.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
            const url = `/audio/${safeChunk}.mp3`;

            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Status ${response.status}`);

                const arrayBuffer = await response.arrayBuffer();
                console.log(`[Audio] Fetch success: ${url} (${arrayBuffer.byteLength} bytes)`);

                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                console.log(`[Audio] Decoded ${url}: ${audioBuffer.duration.toFixed(2)}s`);

                const source = ctx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(ctx.destination);
                source.start(0);

                await new Promise(resolve => {
                    source.onended = resolve;
                    setTimeout(resolve, (audioBuffer.duration * 1000) + 100);
                });
            } catch (err) {
                console.warn(`[Audio] File playback failed for ${chunk}, using synthesis. Reason:`, err);
                this.isPlaying = false;
                await this.synthesizeChunk(chunk);
            }
        } catch (e) {
            console.error('[Audio] Fatal error:', e);
        } finally {
            this.isPlaying = false;
        }
    }

    // Fallback synthesis logic (original implementation)
    private async synthesizeChunk(chunk: string): Promise<void> {
        if (this.isPlaying) return;
        this.isPlaying = true;

        try {
            const ctx = this.ensureContext();
            const duration = this.getDuration(chunk);
            const freq = this.getBaseFrequency(chunk);

            // Create oscillator for the consonant
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Set up audio chain
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(ctx.destination);

            // Configure based on chunk
            osc.type = this.getWaveform(chunk);
            osc.frequency.setValueAtTime(freq, ctx.currentTime);

            // Add vowel formant filter
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(this.getFormant(chunk), ctx.currentTime);
            filter.Q.setValueAtTime(5, ctx.currentTime);

            // Envelope
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.02);
            gainNode.gain.setValueAtTime(0.3, ctx.currentTime + duration - 0.05);
            gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

            // Add frequency sweep for natural sound
            if (chunk.includes('aa') || chunk.includes('ii') || chunk.includes('uu')) {
                osc.frequency.linearRampToValueAtTime(freq * 1.02, ctx.currentTime + duration);
            }

            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + duration);

            // Add a subtle click for consonants
            if (this.isConsonantHeavy(chunk)) {
                const clickOsc = ctx.createOscillator();
                const clickGain = ctx.createGain();
                clickOsc.connect(clickGain);
                clickGain.connect(ctx.destination);
                clickOsc.type = 'square';
                clickOsc.frequency.setValueAtTime(2000, ctx.currentTime);
                clickGain.gain.setValueAtTime(0.1, ctx.currentTime);
                clickGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
                clickOsc.start(ctx.currentTime);
                clickOsc.stop(ctx.currentTime + 0.03);
            }

            await new Promise(resolve => setTimeout(resolve, duration * 1000 + 50));
        } finally {
            this.isPlaying = false;
        }
    }

    // Play success sound
    async playSuccess(): Promise<void> {
        try {
            const ctx = this.ensureContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
            osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
            osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.4);
            await new Promise(r => setTimeout(r, 450));
        } catch (e) {
            console.error('Success sound error:', e);
        }
    }

    // Play error sound  
    async playError(): Promise<void> {
        try {
            const ctx = this.ensureContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.linearRampToValueAtTime(150, ctx.currentTime + 0.2);
            gain.gain.setValueAtTime(0.15, ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.2);
            await new Promise(r => setTimeout(r, 250));
        } catch (e) {
            console.error('Error sound error:', e);
        }
    }

    // Play ayat completion fanfare
    async playAyatComplete(): Promise<void> {
        try {
            const ctx = this.ensureContext();
            const notes = [523.25, 587.33, 659.25, 783.99, 1046.5];
            for (let i = 0; i < notes.length; i++) {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(notes[i], ctx.currentTime + i * 0.12);
                gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12);
                gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + i * 0.12 + 0.02);
                gain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.12 + 0.2);
                osc.start(ctx.currentTime + i * 0.12);
                osc.stop(ctx.currentTime + i * 0.12 + 0.2);
            }
            await new Promise(r => setTimeout(r, 800));
        } catch (e) {
            console.error('Fanfare error:', e);
        }
    }

    private getDuration(chunk: string): number {
        if (chunk.length >= 4) return 0.5;
        if (chunk.includes('aa') || chunk.includes('ii') || chunk.includes('uu') || chunk.includes('oo')) return 0.4;
        return 0.25;
    }

    private getBaseFrequency(chunk: string): number {
        // Map different sounds to different frequency ranges
        const firstChar = chunk[0]?.toLowerCase() || 'a';
        const freqMap: Record<string, number> = {
            'a': 220, 'b': 196, 'd': 185, 'g': 175, 'h': 247,
            'i': 330, 'k': 200, 'l': 262, 'm': 196, 'n': 294,
            'q': 165, 'r': 233, 's': 350, 't': 277, 'w': 208,
            'y': 311, 'u': 261, 'o': 240
        };
        return freqMap[firstChar] || 220;
    }

    private getWaveform(chunk: string): OscillatorType {
        // Harsh consonants get sawtooth, soft get sine
        if (['sh', 'gh', 'kh', 'dh'].some(c => chunk.startsWith(c))) return 'sawtooth';
        if (['s', 'z', 'sh'].some(c => chunk.startsWith(c))) return 'square';
        if (['m', 'n', 'l', 'r', 'w', 'y'].some(c => chunk.startsWith(c))) return 'triangle';
        return 'sine';
    }

    private getFormant(chunk: string): number {
        // Vowel formant frequencies
        if (chunk.includes('aa') || chunk.includes('a')) return 800;
        if (chunk.includes('ii') || chunk.includes('i')) return 2300;
        if (chunk.includes('uu') || chunk.includes('u')) return 900;
        return 1200;
    }

    private isConsonantHeavy(chunk: string): boolean {
        return ['b', 'd', 't', 'k', 'q', 'g'].some(c => chunk.startsWith(c));
    }

    destroy(): void {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}
