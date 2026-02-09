import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LoginPage: React.FC = () => {
    const { login, register } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        fullName: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                await login(formData.username, formData.password);
            } else {
                await register(formData.username, formData.email, formData.password, formData.fullName);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <div className="login-page">
            <div className="login-background">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="logo">
                            <div className="logo-icon">🤲</div>
                            <h1>Iqro Gesture</h1>
                        </div>
                        <p className="tagline">Belajar Huruf Hijaiyah Melalui Gerakan Tangan</p>
                    </div>

                    <div className="toggle-container">
                        <button
                            className={`toggle-btn ${isLogin ? 'active' : ''}`}
                            onClick={() => setIsLogin(true)}
                        >
                            Login
                        </button>
                        <button
                            className={`toggle-btn ${!isLogin ? 'active' : ''}`}
                            onClick={() => setIsLogin(false)}
                        >
                            Register
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="error-message">
                                <span className="error-icon">⚠️</span>
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="username">
                                <span className="label-icon">👤</span>
                                Username
                            </label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Masukkan username"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        {!isLogin && (
                            <>
                                <div className="form-group">
                                    <label htmlFor="email">
                                        <span className="label-icon">📧</span>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        id="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="Masukkan email"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>

                                <div className="form-group">
                                    <label htmlFor="fullName">
                                        <span className="label-icon">📝</span>
                                        Nama Lengkap
                                    </label>
                                    <input
                                        type="text"
                                        id="fullName"
                                        name="fullName"
                                        value={formData.fullName}
                                        onChange={handleChange}
                                        placeholder="Masukkan nama lengkap"
                                        required
                                        disabled={isLoading}
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-group">
                            <label htmlFor="password">
                                <span className="label-icon">🔒</span>
                                Password
                            </label>
                            <input
                                type="password"
                                id="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Masukkan password"
                                required
                                disabled={isLoading}
                            />
                        </div>

                        <button type="submit" className="submit-btn" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <span className="loading-spinner"></span>
                                    {isLogin ? 'Logging in...' : 'Registering...'}
                                </>
                            ) : (
                                <>
                                    {isLogin ? 'Masuk' : 'Daftar'}
                                    <span className="btn-icon">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="login-footer">
                        <p>
                            {isLogin ? "Belum punya akun? " : "Sudah punya akun? "}
                            <button
                                onClick={() => {
                                    setIsLogin(!isLogin);
                                    setError('');
                                }}
                                className="switch-btn"
                            >
                                {isLogin ? 'Daftar Sekarang' : 'Login'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
