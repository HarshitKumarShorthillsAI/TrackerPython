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

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return null;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    return <MainLayout>{children}</MainLayout>;
};

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
                                    <Route
                                        path="/time-entries"
                                        element={
                                            <ProtectedRoute>
                                                <TimeEntries />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/projects"
                                        element={
                                            <ProtectedRoute>
                                                <Projects />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/tasks"
                                        element={
                                            <ProtectedRoute>
                                                <Tasks />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/users"
                                        element={
                                            <ProtectedRoute>
                                                <Users />
                                            </ProtectedRoute>
                                        }
                                    />
                                    <Route
                                        path="/"
                                        element={<Navigate to="/time-entries" />}
                                    />
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
