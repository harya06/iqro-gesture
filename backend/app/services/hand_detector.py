"""
Enhanced hand detection service untuk deteksi akurat tangan kiri, kanan, atau kedua tangan
"""
import numpy as np
from typing import List, Tuple, Optional, Dict
from ..utils.logger import logger


class HandDetector:
    """
    Improved hand detector dengan support untuk:
    - Deteksi tangan kiri saja
    - Deteksi tangan kanan saja
    - Deteksi kedua tangan bersamaan
    """
    
    def __init__(self):
        self.finger_tips = [4, 8, 12, 16, 20]  # Thumb, Index, Middle, Ring, Pinky
        self.finger_mcp = [2, 5, 9, 13, 17]
        self.finger_pip = [3, 6, 10, 14, 18]
        
    def count_fingers_up(self, landmarks: List[List[float]]) -> int:
        """
        Hitung jumlah jari yang terangkat dengan akurasi tinggi
        
        Args:
            landmarks: 21 hand landmarks dengan format [x, y, z]
            
        Returns:
            Jumlah jari yang terangkat (0-5)
        """
        if not landmarks or len(landmarks) != 21:
            return 0
            
        fingers_up = 0
        
        # Konversi ke numpy array untuk perhitungan lebih cepat
        lm = np.array(landmarks)
        
        # Deteksi jempol (thumb) - berbeda karena bergerak horizontal
        # Thumb tip (4) vs Thumb IP (3)
        if lm[4][0] < lm[3][0]:  # Untuk tangan kanan
            fingers_up += 1
        elif lm[4][0] > lm[17][0]:  # Untuk tangan kiri
            if lm[4][0] > lm[3][0]:
                fingers_up += 1
        
        # Deteksi 4 jari lainnya (index, middle, ring, pinky)
        # Jari dianggap terangkat jika tip-nya lebih tinggi dari PIP joint
        for tip_idx, pip_idx in zip([8, 12, 16, 20], [6, 10, 14, 18]):
            if lm[tip_idx][1] < lm[pip_idx][1]:  # Y coordinate lebih kecil = lebih tinggi
                fingers_up += 1
                
        return fingers_up
    
    def detect_hand_type(self, landmarks: List[List[float]], handedness: str = "") -> str:
        """
        Deteksi apakah tangan kiri atau kanan
        
        Args:
            landmarks: 21 hand landmarks
            handedness: Label dari MediaPipe ('Left' atau 'Right')
            
        Returns:
            'left', 'right', atau 'unknown'
        """
        if handedness:
            return handedness.lower()
        
        # Heuristic: deteksi berdasarkan posisi thumb
        if len(landmarks) < 21:
            return 'unknown'
            
        lm = np.array(landmarks)
        # Jika thumb (4) di kiri dari index finger base (5), kemungkinan besar tangan kanan
        if lm[4][0] < lm[5][0]:
            return 'right'
        else:
            return 'left'
    
    def detect_alif_gesture(self, landmarks: List[List[float]]) -> Tuple[bool, float]:
        """
        Deteksi gesture Alif (1 jari terangkat - telunjuk)
        
        Returns:
            (is_alif, confidence_score)
        """
        if not landmarks or len(landmarks) != 21:
            return False, 0.0
        
        lm = np.array(landmarks)
        
        # Cek jari telunjuk (index finger) terangkat
        index_up = lm[8][1] < lm[6][1]
        
        # Cek jari lain tertutup
        middle_down = lm[12][1] > lm[10][1]
        ring_down = lm[16][1] > lm[14][1]
        pinky_down = lm[20][1] > lm[18][1]
        thumb_down = lm[4][1] > lm[2][1]
        
        # Hitung confidence
        confidence = 0.0
        if index_up:
            confidence += 0.5
        if middle_down:
            confidence += 0.15
        if ring_down:
            confidence += 0.15
        if pinky_down:
            confidence += 0.1
        if thumb_down:
            confidence += 0.1
            
        is_alif = index_up and middle_down and ring_down and pinky_down
        
        return is_alif, confidence
    
    def analyze_gesture(
        self, 
        landmarks: List[List[float]], 
        handedness: str = ""
    ) -> Dict[str, any]:
        """
        Analisa gesture lengkap
        
        Returns:
            Dict dengan informasi:
            - fingers_up: jumlah jari terangkat
            - hand_type: 'left', 'right', 'unknown'
            - is_alif: boolean
            - alif_confidence: float
        """
        fingers = self.count_fingers_up(landmarks)
        hand_type = self.detect_hand_type(landmarks, handedness)
        is_alif, alif_conf = self.detect_alif_gesture(landmarks)
        
        return {
            'fingers_up': fingers,
            'hand_type': hand_type,
            'is_alif': is_alif,
            'alif_confidence': alif_conf
        }
    
    def merge_two_hands(
        self, 
        left_landmarks: List[List[float]], 
        right_landmarks: List[List[float]]
    ) -> Dict[str, any]:
        """
        Gabungkan informasi dari kedua tangan untuk deteksi gesture kombinasi
        
        Returns:
            Dict dengan informasi gabungan dari kedua tangan
        """
        left_analysis = self.analyze_gesture(left_landmarks, 'left')
        right_analysis = self.analyze_gesture(right_landmarks, 'right')
        
        return {
            'left_hand': left_analysis,
            'right_hand': right_analysis,
            'total_fingers': left_analysis['fingers_up'] + right_analysis['fingers_up'],
            'both_hands_detected': True
        }


# Singleton instance
hand_detector = HandDetector()
