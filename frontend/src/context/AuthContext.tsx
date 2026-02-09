import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api';

interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    is_active: boolean;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string, fullName: string) => Promise<void>;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for stored token on mount
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken && storedUser) {
            setToken(storedToken);
            setUser(JSON.parse(storedUser));
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setIsLoading(false);
    }, []);

    const login = async (username: string, password: string) => {
        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const response = await axios.post(`${API_BASE_URL}/auth/login`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            const { access_token, user: userData } = response.data;

            setToken(access_token);
            setUser(userData);

            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));

            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        } catch (error: any) {
            console.error('Login error:', error);
            throw new Error(error.response?.data?.detail || 'Login failed');
        }
    };

    const register = async (username: string, email: string, password: string, fullName: string) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/auth/register`, {
                username,
                email,
                password,
                full_name: fullName,
            });

            const { access_token, user: userData } = response.data;

            setToken(access_token);
            setUser(userData);

            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));

            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        } catch (error: any) {
            console.error('Register error:', error);
            throw new Error(error.response?.data?.detail || 'Registration failed');
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
    };

    const value: AuthContextType = {
        user,
        token,
        login,
        register,
        logout,
        isAuthenticated: !!token,
        isLoading,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
