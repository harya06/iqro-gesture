# 🤲 Iqro Gesture Recognition

Aplikasi pembelajaran huruf Hijaiyah menggunakan AI gesture recognition dengan deteksi gerakan tangan real-time.

## ✨ Fitur Unggulan

### 🎯 Deteksi Akurat
- **AI Hand Detection** - Menggunakan MediaPipe untuk deteksi tangan dengan presisi tinggi
- **1 Jari = Alif** - Deteksi spesial untuk huruf Alif (telunjuk terangkat)
- **Multi-Hand Support** - Deteksi tangan kiri saja, kanan saja, atau kedua tangan sekaligus
- **Real-time Processing** - Respon instan untuk pengalaman belajar optimal

### 🔊 Audio Pronunciation
- Pengucapan huruf Hijaiyah yang jelas dan benar
- Text-to-Speech dengan suara bahasa Arab
- Audio otomatis diputar saat huruf terdeteksi

### 🔐 Authentication System
- Login & Register dengan JWT
- Session management yang aman
- User profile management

### 💎 UI/UX Premium
- **Glassmorphism Design** - Efek kaca modern dan elegan
- **Smooth Animations** - Transisi halus dan micro-interactions
- **Responsive Layout** - Optimal di semua ukuran layar
- **Dark Theme** - Tema gelap yang nyaman untuk mata

## 🚀 Setup & Installation

### Backend Setup

1. **Install Python Dependencies**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Run Backend Server**
   ```bash
   cd backend
   python run.py
   ```
   
   Backend akan berjalan di `http://localhost:8000`

### Frontend Setup

1. **Install Node Modules**
   ```bash
   cd frontend
   npm install
   ```

2. **Run Frontend Development Server**
   ```bash
   npm run dev
   ```
   
   Frontend akan berjalan di `http://localhost:5173`

## 📖 Cara Menggunakan

### 1. Login/Register
- Buka aplikasi di browser
- Klik **Register** untuk membuat akun baru
- Atau **Login** jika sudah punya akun

### 2. Mulai Deteksi
- Izinkan akses kamera saat diminta
- Tunggu sampai status menunjukkan **"Connected"**
- Tampilkan gesture tangan Anda di depan kamera

### 3. Gesture untuk Huruf Hijaiyah

#### Alif (أَلِف)
- **Gestur**: Telunjuk terangkat, jari lain tertutup
- **Tangan**: Bisa kiri, kanan, atau keduanya

#### Huruf Lainnya
- Ba, Ta, Tsa, Jim - sesuai dataset training

## 🛠️ Teknologi yang Digunakan

### Backend
- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - ORM untuk database
- **PyTorch** - Deep learning framework
- **MediaPipe** - Hand tracking
- **gTTS** - Google Text-to-Speech
- **JWT** - Authentication

### Frontend
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Axios** - HTTP client
- **WebSocket** - Real-time communication

## 📁 Struktur Project

```
iqro-gesture/
├── backend/
│   ├── app/
│   │   ├── api/           # API endpoints
│   │   │   ├── auth.py    # Authentication routes
│   │   │   ├── routes.py  # Main routes
│   │   │   └── websocket.py
│   │   ├── database/      # Database models
│   │   ├── services/      # Business logic
│   │   │   ├── hand_detector.py  # ⭐ Improved hand detection
│   │   │   ├── inference.py
│   │   │   └── tts_service.py
│   │   └── utils/         # Utilities
│   │       └── auth.py    # ⭐ JWT authentication
│   ├── ml_training/       # ML models
│   └── requirements.txt
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── LoginPage.tsx      # ⭐ Modern login UI
    │   │   ├── MainApp.tsx        # ⭐ Main application
    │   │   ├── CameraView.tsx
    │   │   ├── GestureIndicator.tsx
    │   │   └── AudioPlayer.tsx
    │   ├── context/
    │   │   └── AuthContext.tsx    # ⭐ Auth state management
    │   ├── hooks/
    │   └── services/
    └── package.json
```

## 🎨 Fitur UI Baru

### Login Page
- Animated floating blobs background
- Toggle smooth antara Login/Register
- Form validation dengan error messages
- Feature showcase section
- Fully responsive design

### Main Application
- Modern navbar dengan user menu
- Real-time connection status indicator
- Grid layout untuk camera & results
- Info cards dengan hover effects
- Smooth transitions & animations

## 🔧 Konfigurasi

### Backend Config (`backend/app/config.py`)
```python
# Authentication
SECRET_KEY = "your-secret-key-here"  # Ganti di production!

# Labels Huruf Hijaiyah
LABELS = ["Alif", "Ba", "Ta", "Tsa", "Jim"]

# Hand Detection
SEQUENCE_LENGTH = 30  # Frame buffer size
```

### Frontend Config
API endpoint ada di `frontend/src/context/AuthContext.tsx`:
```typescript
const API_BASE_URL = 'http://localhost:8000/api';
```

## 🐛 Troubleshooting

### Backend tidak bisa start
```bash
# Pastikan semua dependencies terinstall
pip install -r requirements.txt

# Cek apakah port 8000 sudah digunakan
lsof -i :8000
```

### Frontend error axios
```bash
# Install ulang dependencies
rm -rf node_modules package-lock.json
npm install
```

### Camera tidak terdeteksi
- Pastikan browser punya permission untuk akses camera
- Gunakan HTTPS atau localhost
- Cek device settings

## 📝 API Endpoints

### Authentication
- `POST /api/auth/register` - Register user baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info

### Gesture Recognition
- `GET /api/labels` - Get available labels
- `GET /api/stats` - Get statistics
- `WS /ws/{session_id}` - WebSocket untuk real-time detection

## 🎯 Roadmap

- [ ] Tambah lebih banyak huruf Hijaiyah  
- [ ] Training model untuk gesture baru
- [ ] Dashboard statistik pembelajaran
- [ ] Leaderboard & gamification
- [ ] Mobile app support
- [ ] Multi-language support

## 👥 Kontribusi

Kontribusi sangat diterima! Silakan buat pull request atau issue.

## 📄 License

MIT License - feel free to use for learning purposes.

## 🙏 Acknowledgments

- MediaPipe for hand tracking
- FastAPI for amazing backend framework
- React community for excellent tools

---

Dibuat dengan ❤️ untuk pembelajaran huruf Hijaiyah yang interaktif dan menyenangkan.
