import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { SnackbarProvider } from 'notistack';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { MainLayout } from './layouts/MainLayout';
import { Login } from './pages/Login';
import { TimeEntries } from './pages/TimeEntries';
import { Projects } from './pages/Projects';
import { Tasks } from './pages/Tasks';
import { Users } from './pages/Users';
import { Reports } from './pages/Reports';
import MonthlyQuotas from './pages/MonthlyQuotas';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import { UserRole } from './types';
import { ProtectedRoute } from './components/ProtectedRoute';

const queryClient = new QueryClient();

const theme = createTheme({
    palette: {
        primary: {
            main: '#1976d2',
        },
        secondary: {
            main: '#dc004e',
        },
    },
});

const App = () => {
    return (
        <QueryClientProvider client={queryClient}>
            <ThemeProvider theme={theme}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <SnackbarProvider maxSnack={3}>
                        <AuthProvider>
                            <BrowserRouter>
                                <Routes>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/forgot-password" element={<ForgotPassword />} />
                                    <Route path="/reset-password" element={<ResetPassword />} />
                                    <Route
                                        path="/"
                                        element={
                                            <ProtectedRoute>
                                                <MainLayout />
                                            </ProtectedRoute>
                                        }
                                    >
                                        <Route index element={<Navigate to="/time-entries" replace />} />
                                        <Route path="time-entries" element={<TimeEntries />} />
                                        <Route path="projects" element={<Projects />} />
                                        <Route path="tasks" element={<Tasks />} />
                                        <Route path="reports" element={<Reports />} />
                                        <Route path="users" element={<Users />} />
                                        <Route path="monthly-quotas" element={<MonthlyQuotas />} />
                                    </Route>
                                </Routes>
                            </BrowserRouter>
                        </AuthProvider>
                    </SnackbarProvider>
                </LocalizationProvider>
            </ThemeProvider>
        </QueryClientProvider>
    );
};

export default App;