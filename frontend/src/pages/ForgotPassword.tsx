import React, { useState } from 'react';
import { Box, Button, Container, TextField, Typography, Alert } from '@mui/material';
import { forgotPassword } from '../services/api';
import { useNavigate } from 'react-router-dom';

const ForgotPassword: React.FC = () => {
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError('');

        try {
            await forgotPassword(email);
            setSuccess(true);
        } catch (err: any) {
            setError(err.message || 'An error occurred while processing your request.');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    Forgot Password
                </Typography>

                {success ? (
                    <Box mt={3}>
                        <Alert severity="success">
                            If an account exists with this email, you will receive password reset instructions.
                        </Alert>
                        <Button
                            fullWidth
                            variant="contained"
                            onClick={() => navigate('/login')}
                            sx={{ mt: 3 }}
                        >
                            Return to Login
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
                            id="email"
                            label="Email Address"
                            name="email"
                            autoComplete="email"
                            autoFocus
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            disabled={isSubmitting}
                        />
                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            sx={{ mt: 3, mb: 2 }}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
                        </Button>
                        <Button
                            fullWidth
                            variant="text"
                            onClick={() => navigate('/login')}
                        >
                            Back to Login
                        </Button>
                    </Box>
                )}
            </Box>
        </Container>
    );
};

export default ForgotPassword; 