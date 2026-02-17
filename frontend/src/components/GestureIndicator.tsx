import React from 'react';
import { DetectionState, PredictionResponse } from '../types';

interface GestureIndicatorProps {
  detectionState: DetectionState;
  prediction: PredictionResponse['data'] | null;
  handDetected: boolean;
}

const GestureIndicator: React.FC<GestureIndicatorProps> = ({
  detectionState,
  prediction,
  handDetected
}) => {
  const getStateText = (): string => {
    switch (detectionState) {
      case 'detecting': return 'Detecting...';
      case 'speaking': return 'Speaking...';
      case 'waiting': return 'Show your hand';
      default: return 'Idle...';
    }
  };

  const getStateClass = (): string => {
    switch (detectionState) {
      case 'detecting': return 'detecting';
      case 'speaking': return 'speaking';
      default: return '';
    }
  };

  return (
    <div className="gesture-indicator">
      <div className={`detection-state ${getStateClass()}`}>
        {getStateText()}
      </div>

      {prediction ? (
        <div className="prediction-display">
          <div className="arabic-letter">
            {prediction.arabic}
          </div>

          <div className="latin-label">
            {prediction.label}
          </div>

          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${prediction.confidence * 100}%` }}
            />
          </div>

          <div className="confidence-text">
            Confidence: {(prediction.confidence * 100).toFixed(1)}%
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon">✋</div>
          <p>Position your hand in front of the camera</p>
          <p>Make a gesture to see the prediction</p>
        </div>
      )}
    </div>
  );
};

export default GestureIndicator;