import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return children;
}; 