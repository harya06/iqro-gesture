// ============================================================
// GESTURE DECODER ENGINE
// Decodes MediaPipe hand landmarks into zona / harakat signals
// Fixed: robust handedness parsing, position-based fallback
// ============================================================

import { ENGINE_CONFIG } from '../data/quranData';

// ── TYPES ─────────────────────────────────────────────────────
export interface HandLandmark {
    x: number;
    y: number;
    z: number;
}

export interface DecodedGesture {
    rightHand: {
        fingerCount: number;
        orientation: string;  // palm_up | palm_down | palm_left | palm_right | fist
        confidence: number;
        landmarks: HandLandmark[] | null;
    } | null;
    leftHand: {
        fingerCount: number;
        isFist: boolean;
        confidence: number;
        landmarks: HandLandmark[] | null;
    } | null;
    timestamp: number;
}

export interface StableZone {
    zona: number;
    harakat: number;
    orientation: string;
    stableAt: number;
    isSyaddah: boolean;
}

// ── FINGER COUNTING ───────────────────────────────────────────
// Landmark indices:
// 0=wrist, 4=thumb_tip, 8=index_tip, 12=middle_tip, 16=ring_tip, 20=pinky_tip
// MCP joints: 5(index), 9(middle), 13(ring), 17(pinky)
// PIP joints: 6(index), 10(middle), 14(ring), 18(pinky)
// Thumb: 2=thumb_mcp, 3=thumb_ip, 4=thumb_tip

export function countFingers(landmarks: HandLandmark[], handedness: string): number {
    if (!landmarks || landmarks.length < 21) return 0;

    let count = 0;

    // Thumb: Compare x-position of tip vs IP joint
    const thumbTip = landmarks[4];
    const thumbIP = landmarks[3];

    if (handedness === 'Right') {
        // Invert based on user feedback (likely back-of-hand or coordinate flip)
        // Right Hand: Thumb extends to RIGHT (higher x) relative to IP
        if (thumbTip.x > thumbIP.x) count++;
    } else {
        // Left Hand: Thumb extends to LEFT (lower x) relative to IP
        if (thumbTip.x < thumbIP.x) count++;
    }

    // Other fingers: tip y < pip y means extended (y goes down in image)
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];

    for (let i = 0; i < 4; i++) {
        if (landmarks[fingerTips[i]].y < landmarks[fingerPIPs[i]].y) {
            count++;
        }
    }

    return count;
}

// ── PALM ORIENTATION DETECTION ────────────────────────────────
export function detectOrientation(landmarks: HandLandmark[]): string {
    if (!landmarks || landmarks.length < 21) return 'unknown';

    const wrist = landmarks[0];
    const middleMCP = landmarks[9];
    const indexMCP = landmarks[5];
    const pinkyMCP = landmarks[17];

    // Check if fist (all fingers curled)
    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];
    let curledCount = 0;
    for (let i = 0; i < 4; i++) {
        if (landmarks[fingerTips[i]].y > landmarks[fingerPIPs[i]].y) {
            curledCount++;
        }
    }
    if (Math.abs(landmarks[4].x - landmarks[3].x) < 0.03) {
        curledCount++;
    }
    if (curledCount >= 4) return 'fist';

    // Palm direction based on normal vector
    const v1 = {
        x: middleMCP.x - wrist.x,
        y: middleMCP.y - wrist.y,
        z: middleMCP.z - wrist.z
    };
    const v2 = {
        x: pinkyMCP.x - indexMCP.x,
        y: pinkyMCP.y - indexMCP.y,
        z: pinkyMCP.z - indexMCP.z
    };

    const normal = {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x
    };

    const absX = Math.abs(normal.x);
    const absY = Math.abs(normal.y);
    const absZ = Math.abs(normal.z);

    if (absZ > absX && absZ > absY) {
        if (v1.y < 0) return 'palm_up';
        return 'palm_down';
    }

    if (absX > absY) {
        return normal.x > 0 ? 'palm_right' : 'palm_left';
    }

    return normal.y > 0 ? 'palm_down' : 'palm_up';
}

// ── FIST DETECTION (for syaddah) ──────────────────────────────
export function isFist(landmarks: HandLandmark[]): boolean {
    if (!landmarks || landmarks.length < 21) return false;

    const fingerTips = [8, 12, 16, 20];
    const fingerPIPs = [6, 10, 14, 18];
    let curledCount = 0;

    for (let i = 0; i < 4; i++) {
        if (landmarks[fingerTips[i]].y > landmarks[fingerPIPs[i]].y) {
            curledCount++;
        }
    }

    return curledCount >= 3;
}

// ── CONFIDENCE CALCULATION ────────────────────────────────────
export function calculateConfidence(landmarks: HandLandmark[]): number {
    if (!landmarks || landmarks.length < 21) return 0;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const lm of landmarks) {
        minX = Math.min(minX, lm.x);
        maxX = Math.max(maxX, lm.x);
        minY = Math.min(minY, lm.y);
        maxY = Math.max(maxY, lm.y);
    }

    const spreadX = maxX - minX;
    const spreadY = maxY - minY;

    if (spreadX < 0.02 || spreadY < 0.02) return 0.3;
    if (spreadX > 0.5 || spreadY > 0.5) return 0.5;

    let zVariance = 0;
    const avgZ = landmarks.reduce((s, l) => s + l.z, 0) / landmarks.length;
    for (const lm of landmarks) {
        zVariance += (lm.z - avgZ) ** 2;
    }
    zVariance /= landmarks.length;

    const zScore = Math.max(0, 1 - zVariance * 100);

    return Math.min(1, 0.7 + spreadX * 0.5 + spreadY * 0.3) * (0.5 + zScore * 0.5);
}

// ── EXTRACT HANDEDNESS LABEL ──────────────────────────────────
// MediaPipe can return handedness in multiple formats:
//   - Array format: [{label: "Right", score: 0.99}]
//   - Object format: {label: "Right", score: 0.99}
//   - Classification: {categoryName: "Right", score: 0.99}
function extractHandInfo(handedness: any): { label: string; score: number } | null {
    if (!handedness) return null;

    // Format 1: Array of classification objects
    if (Array.isArray(handedness) && handedness.length > 0) {
        const h = handedness[0];
        return {
            label: h.label || h.categoryName || 'Unknown',
            score: h.score ?? 0.5
        };
    }

    // Format 2: Direct object
    if (typeof handedness === 'object' && !Array.isArray(handedness)) {
        return {
            label: handedness.label || handedness.categoryName || 'Unknown',
            score: handedness.score ?? 0.5
        };
    }

    return null;
}

// ── STABILITY TRACKER ─────────────────────────────────────────
export class StabilityTracker {
    private lastZona: number = -1;
    private lastHarakat: number = -1;
    private zonaStartTime: number = 0;
    private harakatStartTime: number = 0;
    private lastOrientation: string = '';
    private fistStartTime: number = 0;

    reset(): void {
        this.lastZona = -1;
        this.lastHarakat = -1;
        this.zonaStartTime = 0;
        this.harakatStartTime = 0;
        this.lastOrientation = '';
        this.fistStartTime = 0;
    }

    update(decoded: DecodedGesture): StableZone | null {
        const now = decoded.timestamp;

        // Process right hand (zona)
        let currentZona = -1;
        let currentOrientation = '';
        if (decoded.rightHand && decoded.rightHand.confidence >= ENGINE_CONFIG.MIN_CONFIDENCE) {
            currentZona = decoded.rightHand.fingerCount;
            currentOrientation = decoded.rightHand.orientation;
        }

        // Process left hand (harakat)
        let currentHarakat = -1;
        let currentIsFist = false;
        if (decoded.leftHand && decoded.leftHand.confidence >= ENGINE_CONFIG.MIN_CONFIDENCE) {
            currentHarakat = decoded.leftHand.fingerCount;
            currentIsFist = decoded.leftHand.isFist;
        }

        // Check zona stability
        if (currentZona !== this.lastZona) {
            this.lastZona = currentZona;
            this.zonaStartTime = now;
        }

        // Check harakat stability
        if (currentHarakat !== this.lastHarakat) {
            this.lastHarakat = currentHarakat;
            this.harakatStartTime = now;
        }

        // Check orientation
        if (currentOrientation !== this.lastOrientation) {
            this.lastOrientation = currentOrientation;
        }

        // Check fist hold for syaddah
        let isSyaddah = false;
        if (currentIsFist) {
            if (this.fistStartTime === 0) this.fistStartTime = now;
            if (now - this.fistStartTime >= ENGINE_CONFIG.SYADDAH_HOLD_MS) {
                isSyaddah = true;
            }
        } else {
            this.fistStartTime = 0;
        }

        // Both zona and harakat must be stable for ZONE_STABILITY_MS
        const zonaStable = currentZona > 0 && (now - this.zonaStartTime >= ENGINE_CONFIG.ZONE_STABILITY_MS);
        const harakatStable = currentHarakat > 0 && (now - this.harakatStartTime >= ENGINE_CONFIG.ZONE_STABILITY_MS);

        if (zonaStable && harakatStable) {
            return {
                zona: currentZona,
                harakat: currentHarakat,
                orientation: currentOrientation,
                stableAt: now,
                isSyaddah
            };
        }

        return null;
    }

    getProgress(): { zonaProgress: number; harakatProgress: number } {
        const now = Date.now();
        const zonaDuration = this.lastZona > 0 ? now - this.zonaStartTime : 0;
        const harakatDuration = this.lastHarakat > 0 ? now - this.harakatStartTime : 0;

        return {
            zonaProgress: Math.min(1, zonaDuration / ENGINE_CONFIG.ZONE_STABILITY_MS),
            harakatProgress: Math.min(1, harakatDuration / ENGINE_CONFIG.ZONE_STABILITY_MS)
        };
    }

    getCurrentState(): { zona: number; harakat: number; orientation: string } {
        return {
            zona: this.lastZona,
            harakat: this.lastHarakat,
            orientation: this.lastOrientation
        };
    }
}

// ── FULL DECODE PIPELINE ──────────────────────────────────────
export function decodeFrame(
    multiHandLandmarks: HandLandmark[][],
    multiHandedness: any[]
): DecodedGesture {
    const result: DecodedGesture = {
        rightHand: null,
        leftHand: null,
        timestamp: Date.now()
    };

    if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
        return result;
    }

    // Step 1: Parse all hands with their labels
    interface ParsedHand {
        landmarks: HandLandmark[];
        label: string;
        score: number;
        wristX: number;
    }
    const hands: ParsedHand[] = [];

    for (let i = 0; i < multiHandLandmarks.length; i++) {
        const landmarks = multiHandLandmarks[i];
        if (!landmarks || landmarks.length < 21) continue;

        const info = extractHandInfo(multiHandedness?.[i]);
        const label = info?.label || 'Unknown';
        const score = info?.score || 0.5;
        const wristX = landmarks[0].x;

        hands.push({ landmarks, label, score, wristX });
    }

    if (hands.length === 0) return result;

    // Step 2: Force position-based handedness (MediaPipe is unreliable for mirror view)
    if (hands.length >= 2) {
        // Sort by X position
        hands.sort((a, b) => a.wristX - b.wristX);

        // Low X (Left of raw frame) -> RIGHT Hand
        hands[0].label = 'Right';

        // High X (Right of raw frame) -> LEFT Hand
        hands[1].label = 'Left';
    } else if (hands.length === 1) {
        // Single hand: Force assign based on side of screen (0.5 split)
        // x < 0.5 -> Right Hand
        // x > 0.5 -> Left Hand
        hands[0].label = hands[0].wristX < 0.5 ? 'Right' : 'Left';
    }

    // Step 3: Assign to result
    for (const hand of hands) {
        const confidence = calculateConfidence(hand.landmarks);
        const combinedConfidence = Math.min(hand.score, confidence);

        if (hand.label === 'Right' && !result.rightHand) {
            result.rightHand = {
                fingerCount: countFingers(hand.landmarks, 'Right'),
                orientation: detectOrientation(hand.landmarks),
                confidence: combinedConfidence,
                landmarks: hand.landmarks
            };
        } else if (hand.label === 'Left' && !result.leftHand) {
            result.leftHand = {
                fingerCount: countFingers(hand.landmarks, 'Left'),
                isFist: isFist(hand.landmarks),
                confidence: combinedConfidence,
                landmarks: hand.landmarks
            };
        }
    }

    return result;
}
