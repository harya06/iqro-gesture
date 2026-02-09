# 🔐 Admin Account Setup

## Cara Membuat Akun Admin

### Metode 1: Menggunakan Script (Recommended)

1. **Jalankan script create_admin.py:**
   ```bash
   cd backend
   python create_admin.py
   ```

2. **Akun admin akan dibuat dengan kredensial:**
   - **Username**: `admin`
   - **Password**: `admin123`
   - **Email**: `admin@iqrogesture.com`
   - **Full Name**: `Administrator`

### Metode 2: Manual menggunakan FastAPI Docs

1. **Jalankan backend server:**
   ```bash
   cd backend
   python run.py
   ```

2. **Buka Swagger UI:**
   ```
   http://localhost:8000/docs
   ```

3. **Gunakan endpoint POST /api/auth/register:**
   ```json
   {
     "username": "admin",
     "email": "admin@iqrogesture.com",
     "password": "admin123",
     "full_name": "Administrator"
   }
   ```

## Login dengan Akun Admin

### Di Web Application:

1. **Buka aplikasi:**
   ```
   http://localhost:5173
   ```

2. **Masukkan kredensial:**
   - Username: `admin`
   - Password: `admin123`

3. **Klik tombol "Masuk"**

4. **Anda akan diarahkan ke halaman utama aplikasi**

## Testing Fitur-Fitur

### 1. Authentication
- ✅ Login dengan akun admin
- ✅ Logout
- ✅ Session persistence

### 2. Hand Gesture Detection
- ✅ Camera access
- ✅ Real-time hand tracking
- ✅ Gesture recognition (1 jari = Alif, dll)
- ✅ Multi-hand support (kiri/kanan/kedua)

### 3. Audio Playback
- ✅ TTS pronunciation
- ✅ Auto-play on detection
- ✅ Clear Arabic pronunciation

### 4. UI/UX
- ✅ Modern glassmorphism design
- ✅ Smooth animations
- ✅ Responsive layout
- ✅ User profile menu

## Default Admin Credentials

```
Username: admin
Password: admin123
Email: admin@iqrogesture.com
```

⚠️ **PENTING**: Ganti password setelah login pertama untuk keamanan!

## Troubleshooting

### Admin sudah ada
Jika script mengatakan admin sudah ada, gunakan kredensial default di atas untuk login.

### Lupa password admin
Hapus database dan buat ulang:
```bash
cd backend
rm iqro_gesture.db
python create_admin.py
```

### Error saat create admin
Pastikan dependencies terinstall:
```bash
cd backend
pip install -r requirements.txt
```

## Membuat User Tambahan

Setelah login sebagai admin, Anda bisa:
1. Logout dari admin account
2. Klik "Daftar Sekarang" di halaman login
3. Isi form registrasi dengan data user baru
