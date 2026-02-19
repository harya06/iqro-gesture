// ============================================================
// PHONETIC CHUNK AUDIO PLAYER
// Generates and plays audio for phonetic chunks using Web Audio API
// with Arabic-style pronunciation synthesis
// ============================================================

export class PhoneticPlayer {
    private audioContext: AudioContext | null = null;

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
            const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
            this.audioContext = new AudioContextClass();
            console.log(`[PhoneticPlayer] New AudioContext created: ${this.audioContext.state}`);
        }
        return this.audioContext;
    }

    private currentAudioElement: HTMLAudioElement | null = null;
    private currentSource: AudioBufferSourceNode | null = null;
    private currentOscillators: OscillatorNode[] = [];

    // Play a single phonetic chunk (File -> Synthesis Fallback)
    async playChunk(chunk: string): Promise<void> {
        console.log(`[PhoneticPlayer] Attempting to play chunk: "${chunk}"`);
        this.stopCurrentAudio();

        try {
            const safeChunk = chunk.replace(/[^a-zA-Z0-9-_]/g, '').toLowerCase();
            const url = `/audio/${safeChunk}.mp3?t=${Date.now()}`;
            console.log(`[PhoneticPlayer] Fetching (Blob): ${url}`);

            return new Promise(async (resolve) => {
                let objectUrl: string | null = null;
                try {
                    // Fetch as blob to avoid streaming/206 issues on Linux
                    const response = await fetch(url);
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);

                    const blob = await response.blob();
                    if (blob.size < 100) throw new Error("File too small, possibly empty");

                    objectUrl = URL.createObjectURL(blob);

                    const audio = new Audio();
                    this.currentAudioElement = audio;
                    audio.src = objectUrl;

                    audio.oncanplaythrough = () => {
                        audio.play().catch(e => {
                            console.warn("[PhoneticPlayer] Play rejected:", e);
                            this.synthesizeChunk(chunk).then(resolve);
                        });
                    };

                    audio.onended = () => {
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        this.currentAudioElement = null;
                        resolve();
                    };

                    audio.onerror = () => {
                        console.error(`[PhoneticPlayer] Blob decoder error for: ${url}`);
                        if (objectUrl) URL.revokeObjectURL(objectUrl);
                        this.currentAudioElement = null;
                        this.synthesizeChunk(chunk).then(resolve);
                    };

                    // Add safety timeout
                    setTimeout(() => {
                        if (this.currentAudioElement === audio && audio.readyState < 2) {
                            console.warn("[PhoneticPlayer] Blob load timeout.");
                            if (objectUrl) URL.revokeObjectURL(objectUrl);
                            this.currentAudioElement = null;
                            this.synthesizeChunk(chunk).then(resolve);
                        }
                    }, 2500);

                } catch (e) {
                    console.error("[PhoneticPlayer] Fetch/Blob failed:", e);
                    if (objectUrl) URL.revokeObjectURL(objectUrl);
                    this.synthesizeChunk(chunk).then(resolve);
                }
            });

        } catch (e) {
            console.error('[PhoneticPlayer] Fatal error:', e);
            await this.synthesizeChunk(chunk);
        }
    }

    private stopCurrentAudio() {
        if (this.currentAudioElement) {
            try {
                this.currentAudioElement.pause();
                this.currentAudioElement.src = ""; // Force disconnect
                this.currentAudioElement.load();
            } catch (e) { }
            this.currentAudioElement = null;
        }

        if (this.currentSource) {
            try { this.currentSource.stop(); } catch (e) { }
            this.currentSource = null;
        }

        this.currentOscillators.forEach(osc => {
            try { osc.stop(); } catch (e) { }
        });
        this.currentOscillators = [];
    }

    // Fallback synthesis logic
    private async synthesizeChunk(chunk: string): Promise<void> {
        console.log(`[PhoneticPlayer] Falling back to synthesis for: "${chunk}"`);
        try {
            const ctx = this.ensureContext();
            const duration = this.getDuration(chunk);
            const freq = this.getBaseFrequency(chunk);
            console.log(`[PhoneticPlayer] Synthesis parameters: freq=${freq}, duration=${duration}`);

            // Create oscillator for the consonant
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            // Store for cleanup
            this.currentOscillators.push(osc);

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

            osc.onended = () => {
                this.currentOscillators = this.currentOscillators.filter(o => o !== osc);
            };

            // Add a subtle click for consonants
            if (this.isConsonantHeavy(chunk)) {
                const clickOsc = ctx.createOscillator();
                const clickGain = ctx.createGain();
                clickOsc.connect(clickGain);
                clickGain.connect(ctx.destination);

                this.currentOscillators.push(clickOsc);

                clickOsc.type = 'square';
                clickOsc.frequency.setValueAtTime(2000, ctx.currentTime);
                clickGain.gain.setValueAtTime(0.1, ctx.currentTime);
                clickGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.03);
                clickOsc.start(ctx.currentTime);
                clickOsc.stop(ctx.currentTime + 0.03);
            }

        } catch (e) {
            console.error('Synthesis error:', e);
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
        // Increase durations so it's not just a "click"
        if (chunk.length >= 4) return 0.8;
        if (chunk.includes('aa') || chunk.includes('ii') || chunk.includes('uu') || chunk.includes('oo')) return 0.7;
        return 0.5;
    }

    private getBaseFrequency(chunk: string): number {
        // Map different sounds to different frequency ranges
        const firstChar = chunk[0]?.toLowerCase() || 'a';
        const freqMap: Record<string, number> = {
            'a': 220, 'b': 200, 'd': 190, 'g': 180, 'h': 240,
            'i': 300, 'k': 210, 'l': 260, 'm': 200, 'n': 280,
            'q': 170, 'r': 230, 's': 330, 't': 270, 'w': 210,
            'y': 300, 'u': 260, 'o': 240
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

    getContextState(): string {
        return this.audioContext?.state || 'closed';
    }

    destroy(): void {
        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
    }
}
