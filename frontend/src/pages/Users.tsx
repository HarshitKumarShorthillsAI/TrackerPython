import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    IconButton,
    TextField,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
} from '@mui/material';
import { Add, Edit, Delete, Person } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { User, UserRole } from '../types/index';
import { useAuth } from '../contexts/AuthContext';

interface UserFormData {
    email: string;
    username: string;
    full_name: string;
    password?: string;
    hourly_rate?: number;
    role: UserRole;
    is_active: boolean;
}

export const Users = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [formData, setFormData] = useState<UserFormData>({
        email: '',
        username: '',
        full_name: '',
        password: '',
        hourly_rate: 0,
        role: UserRole.EMPLOYEE,
        is_active: true,
    });

    const queryClient = useQueryClient();
    const { user, isAdmin } = useAuth();

    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: api.getUsers
    });

    const createMutation = useMutation({
        mutationFn: api.createUser,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            handleCloseDialog();
        }
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: number; user: Partial<User> }) =>
            api.updateUser(data.id, data.user),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            handleCloseDialog();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteUser,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] })
    });

    const handleOpenDialog = (user?: User) => {
        if (user) {
            setEditingUser(user);
            setFormData({
                email: user.email,
                username: user.username,
                full_name: user.full_name,
                hourly_rate: user.hourly_rate,
                role: user.role,
                is_active: user.is_active,
            });
        } else {
            setEditingUser(null);
            setFormData({
                email: '',
                username: '',
                full_name: '',
                password: '',
                hourly_rate: 0,
                role: UserRole.EMPLOYEE,
                is_active: true,
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingUser(null);
    };

    const handleSubmit = () => {
        if (editingUser) {
            updateMutation.mutate({
                id: editingUser.id,
                user: {
                    email: formData.email,
                    username: formData.username,
                    full_name: formData.full_name,
                    hourly_rate: formData.hourly_rate,
                    role: formData.role,
                    is_active: formData.is_active,
                    password: formData.password,
                }
            });
        } else {
            createMutation.mutate({
                email: formData.email,
                username: formData.email,
                full_name: formData.full_name,
                password: formData.password || '',
                hourly_rate: formData.hourly_rate,
                role: formData.role,
                is_active: formData.is_active,
            });
        }
        handleCloseDialog();
    };

    const getRoleChipColor = (role: UserRole) => {
        switch (role) {
            case UserRole.ADMIN:
                return 'error';
            case UserRole.MANAGER:
                return 'warning';
            case UserRole.EMPLOYEE:
                return 'primary';
            case UserRole.CLIENT:
                return 'success';
            default:
                return 'default';
        }
    };

    if (!isAdmin()) {
        return (
            <Box>
                <Typography variant="h4" gutterBottom>
                    Access Denied
                </Typography>
                <Typography>
                    You do not have permission to access the user management page.
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4">Users</Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog()}
                >
                    New User
                </Button>
            </Box>

            <Grid container spacing={3}>
                {users?.map((user) => (
                    <Grid item xs={12} md={6} lg={4} key={user.id}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" mb={2}>
                                    <Box display="flex" alignItems="center">
                                        <Person sx={{ mr: 1 }} />
                                        <Typography variant="h6">{user.full_name}</Typography>
                                    </Box>
                                    <Chip
                                        label={user.role}
                                        color={getRoleChipColor(user.role)}
                                        size="small"
                                    />
                                </Box>
                                <Typography variant="body2" color="textSecondary" paragraph>
                                    {user.email}
                                </Typography>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">
                                        Rate: ${user.hourly_rate}/hr
                                    </Typography>
                                    <Chip
                                        label={user.is_active ? 'Active' : 'Inactive'}
                                        color={user.is_active ? 'success' : 'default'}
                                        size="small"
                                    />
                                </Box>
                                <Box display="flex" justifyContent="flex-end">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenDialog(user)}
                                    >
                                        <Edit />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        color="error"
                                        onClick={() => deleteMutation.mutate(user.id)}
                                    >
                                        <Delete />
                                    </IconButton>
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* User Form Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingUser ? 'Edit User' : 'Create New User'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) =>
                                    setFormData({ 
                                        ...formData, 
                                        email: e.target.value,
                                        username: e.target.value
                                    })
                                }
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Full Name"
                                value={formData.full_name}
                                onChange={(e) =>
                                    setFormData({ ...formData, full_name: e.target.value })
                                }
                                margin="normal"
                            />
                        </Grid>
                        {!editingUser && (
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) =>
                                        setFormData({ ...formData, password: e.target.value })
                                    }
                                    margin="normal"
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Hourly Rate"
                                value={formData.hourly_rate}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        hourly_rate: Number(e.target.value),
                                    })
                                }
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Role</InputLabel>
                                <Select
                                    value={formData.role}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            role: e.target.value as UserRole,
                                        })
                                    }
                                    label="Role"
                                >
                                    {Object.values(UserRole).map((role) => (
                                        <MenuItem key={role} value={role}>
                                            {role}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={formData.is_active}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            is_active: e.target.value as boolean,
                                        })
                                    }
                                    label="Status"
                                >
                                    <MenuItem value={true}>Active</MenuItem>
                                    <MenuItem value={false}>Inactive</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} color="primary">
                        {editingUser ? 'Save' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 