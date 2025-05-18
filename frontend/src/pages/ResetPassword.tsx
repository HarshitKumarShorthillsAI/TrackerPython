import React, { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Alert } from '@mui/material';
import { resetPassword } from '../services/api';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ResetPassword: React.FC = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('Invalid reset token');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long');
            return;
        }

        setIsSubmitting(true);

        try {
            await resetPassword(token, newPassword);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'An error occurred while resetting your password.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!token) {
        return (
            <Container component="main" maxWidth="xs">
                <Box sx={{ mt: 8 }}>
                    <Alert severity="error">
                        Invalid password reset link. Please request a new password reset.
                    </Alert>
                    <Button
                        fullWidth
                        variant="contained"
                        onClick={() => navigate('/forgot-password')}
                        sx={{ mt: 3 }}
                    >
                        Go to Forgot Password
                    </Button>
                </Box>
            </Container>
        );
    }

    return (
        <Container component="main" maxWidth="xs">
            <Box
                sx={{
                    marginTop: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                }}
            >
                <Typography component="h1" variant="h5">
                    Reset Password
                </Typography>

                {success ? (
                    <Box mt={3}>
                        <Alert severity="success">
                            Your password has been successfully reset.
                        </Alert>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => navigate('/login')}
                            sx={{ mt: 3 }}
                        >
                            Go to Login
                        </Button>
                    </Box>
                ) : (
                    <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }} width="100%">
                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="password"
                            label="New Password"
                            type="password"
                            id="password"
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <TextField
                            margin="normal"
                            required
                            fullWidth
                            name="confirmPassword"
                            label="Confirm New Password"
                            type="password"
                            id="confirmPassword"
                            autoComplete="new-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default ResetPassword; 