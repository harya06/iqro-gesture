# 🚀 Quick Start Guide - Iqro Gesture Recognition

## ⚡ Instalasi Cepat

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Catatan**: Installation PyTorch membutuhkan waktu karena ukuran file besar (~2-3 GB).Tunggu sampai selesai.

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Buat Admin Account

```bash
cd backend
python create_admin.py
```

**Output:**
```
✅ Admin user created successfully!

================================================
📋 Admin Account Details:
================================================
   Username    : admin
   Password    : admin123
   Email       : admin@iqrogesture.com
   Full Name   : Administrator
================================================
```

### 4. Jalankan Backend

```bash
cd backend
python run.py
```

**Backend akan berjalan di:** `http://localhost:8000`

### 5. Jalankan Frontend

```bash
cd frontend
npm run dev
```

**Frontend akan berjalan di:** `http://localhost:5173`

### 6. Login ke Aplikasi

1. Buka browser: `http://localhost:5173`
2. Masukkan kredensial admin:
   - **Username**: `admin`
   - **Password**: `admin123`
3. Klik **"Masuk"**

## 🎯 Testing Fitur

### ✅ Authentication
- Login dengan admin account
- Coba logout dan login lagi
- Coba buat user baru via register

### ✅ Hand Gesture Detection
1. Izinkan akses kamera
2. Tunggu status "Connected"
3. Tunjukkan tangan di depan kamera:
   - **1 jari** (telunjuk) = Huruf **Alif** (أَلِف)
   - Gesture lainnya akan terdeteksi sesuai model

### ✅ Audio Playback
- Dengarkan pronunciation otomatis saat huruf terdeteksi
- Suara bahasa Arab yang jelas

## 🔧 Troubleshooting

### Port sudah digunakan

**Backend (port 8000):**
```bash
# Cari process di port 8000
lsof -i :8000

# Kill process jika ada
kill -9 <PID>
```

**Frontend (port 5173):**
```bash
# Cari process di port 5173
lsof -i :5173

# Kill process jika ada
kill -9 <PID>
```

### Camera tidak terdeteksi
- Pastikan browser punya permission untuk akses camera
- Gunakan HTTPS atau localhost
- Cek browser settings

### Error "Module not found"

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Database error
```bash
cd backend
rm iqro_gesture.db  # Hapus database lama
python create_admin.py  # Buat ulang dengan admin
```

## 📚 API Documentation

Buka Swagger UI untuk melihat semua API endpoints:
```
http://localhost:8000/docs
```

### Main Endpoints:

**Authentication:**
- `POST /api/auth/register` - Register user baru
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get user profile

**Gesture Recognition:**
- `GET /api/labels` - Get available labels
- `GET /api/health` - Health check
- `WS /ws/{session_id}` - WebSocket connection

## 🎨 Fitur UI

### Login Page
- ✅ Modern glassmorphism design
- ✅ Floating animated blobs
- ✅ Toggle Login/Register
- ✅ Form validation & error handling

### Main Application
- ✅ Modern navbar dengan user menu
- ✅ Real-time connection status
- ✅ Camera view dengan hand tracking overlay
- ✅ Gesture result display
- ✅ Smooth animations & transitions

## 🔐 Default Credentials

```
Username: admin
Password: admin123
Email: admin@iqrogesture.com
```

**⚠️ PENTING:** Ganti password setelah login pertama!

## 📞 Support

Jika ada masalah, cek:
1. README.md - Dokumentasi lengkap
2. ADMIN_SETUP.md - Setup admin account
3. Backend logs - `backend/logs/`
4. Browser console - F12 di browser

---

**Happy Learning! 🎉**

Belajar huruf Hijaiyah dengan cara yang menyenangkan dan interaktif! 🤲
