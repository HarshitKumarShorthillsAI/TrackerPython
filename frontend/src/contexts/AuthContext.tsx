import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';
import { User, UserRole } from '../types';

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    isManager: () => boolean;
    isAdmin: () => boolean;
    isEmployee: () => boolean;
    canManageTimeEntries: () => boolean;
    canApproveTimeEntries: () => boolean;
    canMarkBilled: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            api.getCurrentUser()
                .then((userData) => {
                    setUser(userData);
                })
                .catch(() => {
                    localStorage.removeItem('token');
                })
                .finally(() => {
                    setIsLoading(false);
                });
        } else {
            setIsLoading(false);
        }
    }, []);

    const login = async (email: string, password: string) => {
        const response = await api.login(email, password);
        localStorage.setItem('token', response.access_token);
        const userData = await api.getCurrentUser();
        setUser(userData);
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    const isManager = () => user?.role === UserRole.MANAGER || user?.is_superuser;
    const isAdmin = () => user?.is_superuser;
    const isEmployee = () => user?.role === UserRole.EMPLOYEE;
    const canManageTimeEntries = () => user?.role !== UserRole.CLIENT;
    const canApproveTimeEntries = () => isManager();
    const canMarkBilled = () => isManager();

    return (
        <AuthContext.Provider
            value={{
                user,
                isLoading,
                login,
                logout,
                isManager,
                isAdmin,
                isEmployee,
                canManageTimeEntries,
                canApproveTimeEntries,
                canMarkBilled,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 