import ReactDOM from 'react-dom/client';
import AlFatihahApp from './AlFatihahApp';

// Note: StrictMode removed intentionally — double-mount breaks camera/MediaPipe lifecycle
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AlFatihahApp />
);