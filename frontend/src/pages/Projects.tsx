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
import { Add, Edit, Delete, Group } from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { Project, ProjectStatus, User } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface ProjectFormData {
    name: string;
    description: string;
    status: ProjectStatus;
    budget_hours: number;
    hourly_rate: number;
    team_members: number[];
    manager_id: number;
}

export const Projects = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formData, setFormData] = useState<ProjectFormData>({
        name: '',
        description: '',
        status: ProjectStatus.PLANNED,
        budget_hours: 0,
        hourly_rate: 0,
        team_members: [],
        manager_id: 0,
    });
    const [teamDialogOpen, setTeamDialogOpen] = useState(false);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);

    const queryClient = useQueryClient();
    const { user, isManager } = useAuth();

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects
    });
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: api.getUsers
    });

    const createMutation = useMutation({
        mutationFn: api.createProject,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            handleCloseDialog();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: number; project: Partial<Project> }) =>
            api.updateProject(data.id, data.project),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            handleCloseDialog();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteProject,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    });

    const handleOpenDialog = (project?: Project) => {
        if (project) {
            setEditingProject(project);
            setFormData({
                name: project.name,
                description: project.description || '',
                status: project.status,
                budget_hours: project.budget_hours,
                hourly_rate: project.hourly_rate,
                team_members: project.team_members.map((member) => member.id),
                manager_id: project.manager_id,
            });
        } else {
            setEditingProject(null);
            setFormData({
                name: '',
                description: '',
                status: ProjectStatus.PLANNED,
                budget_hours: 0,
                hourly_rate: 0,
                team_members: [],
                manager_id: 0,
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingProject(null);
        setFormData({
            name: '',
            description: '',
            status: ProjectStatus.PLANNED,
            budget_hours: 0,
            hourly_rate: 0,
            team_members: [],
            manager_id: 0,
        });
    };

    const handleSubmit = () => {
        const projectData = {
            name: formData.name,
            description: formData.description,
            status: formData.status,
            budget_hours: formData.budget_hours,
            hourly_rate: formData.hourly_rate,
            manager_id: formData.manager_id,
            team_members: formData.team_members
        };

        if (editingProject) {
            updateMutation.mutate({
                id: editingProject.id,
                project: projectData
            });
        } else {
            createMutation.mutate(projectData);
        }
    };

    const handleOpenTeamDialog = (project: Project) => {
        setSelectedProject(project);
        setTeamDialogOpen(true);
    };

    const getStatusChipColor = (status: ProjectStatus) => {
        switch (status) {
            case ProjectStatus.PLANNED:
                return 'default';
            case ProjectStatus.ACTIVE:
                return 'primary';
            case ProjectStatus.ON_HOLD:
                return 'warning';
            case ProjectStatus.COMPLETED:
                return 'success';
            case ProjectStatus.CANCELLED:
                return 'error';
            default:
                return 'default';
        }
    };

    const canManageProject = (project: Project) =>
        user?.is_superuser || project.manager_id === user?.id;

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4">Projects</Typography>
                {isManager() && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={() => handleOpenDialog()}
                    >
                        New Project
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {projects?.map((project) => (
                    <Grid item xs={12} md={6} lg={4} key={project.id}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6">{project.name}</Typography>
                                    <Chip
                                        label={project.status}
                                        color={getStatusChipColor(project.status)}
                                        size="small"
                                    />
                                </Box>
                                <Typography variant="body2" color="textSecondary" paragraph>
                                    {project.description}
                                </Typography>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">
                                        Budget: {project.budget_hours} hours
                                    </Typography>
                                    <Typography variant="body2">
                                        Rate: ${project.hourly_rate}/hr
                                    </Typography>
                                </Box>
                                <Box display="flex" justifyContent="flex-end">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenTeamDialog(project)}
                                    >
                                        <Group />
                                    </IconButton>
                                    {canManageProject(project) && (
                                        <>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenDialog(project)}
                                            >
                                                <Edit />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => deleteMutation.mutate(project.id)}
                                            >
                                                <Delete />
                                            </IconButton>
                                        </>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Project Form Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingProject ? 'Edit Project' : 'Create New Project'}
                </DialogTitle>
                <DialogContent>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Name"
                                value={formData.name}
                                onChange={(e) =>
                                    setFormData({ ...formData, name: e.target.value })
                                }
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                multiline
                                rows={4}
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={formData.status}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            status: e.target.value as ProjectStatus,
                                        })
                                    }
                                    label="Status"
                                >
                                    {Object.values(ProjectStatus).map((status) => (
                                        <MenuItem key={status} value={status}>
                                            {status}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Budget Hours"
                                value={formData.budget_hours}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        budget_hours: Number(e.target.value),
                                    })
                                }
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={6}>
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
                        <Grid item xs={12}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Team Members</InputLabel>
                                <Select
                                    multiple
                                    value={formData.team_members}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            team_members: e.target.value as number[],
                                        })
                                    }
                                    label="Team Members"
                                >
                                    {users?.map((user) => (
                                        <MenuItem key={user.id} value={user.id}>
                                            {user.full_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button onClick={handleSubmit} color="primary">
                        {editingProject ? 'Save' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Team Members Dialog */}
            <Dialog
                open={teamDialogOpen}
                onClose={() => setTeamDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Team Members</DialogTitle>
                <DialogContent>
                    <Grid container spacing={1}>
                        {selectedProject?.team_members.map((member) => (
                            <Grid item key={member.id}>
                                <Chip label={member.full_name} />
                            </Grid>
                        ))}
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTeamDialogOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 