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
import { Task, TaskStatus, TaskPriority, Project, User, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

interface TaskFormData {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    estimated_hours: number;
    due_date: string;
    project_id: number;
}

export const Tasks = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null);
    const [formData, setFormData] = useState<TaskFormData>({
        title: '',
        description: '',
        status: TaskStatus.TODO,
        priority: TaskPriority.MEDIUM,
        estimated_hours: 0,
        due_date: new Date().toISOString().split('T')[0],
        project_id: 0,
    });

    const queryClient = useQueryClient();
    const { user, isManager } = useAuth();

    const { data: tasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: api.getTasks
    });
    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects
    });
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: api.getEmployees
    });

    const createMutation = useMutation({
        mutationFn: api.createTask,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            handleCloseDialog();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: number; task: Partial<Task> }) =>
            api.updateTask(data.id, data.task),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            handleCloseDialog();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: api.deleteTask,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    });

    const handleOpenDialog = (task?: Task) => {
        if (task) {
            setEditingTask(task);
            setFormData({
                title: task.title,
                description: task.description || '',
                status: task.status as TaskStatus,
                priority: task.priority as TaskPriority,
                estimated_hours: task.estimated_hours,
                due_date: task.due_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                project_id: task.project_id,
            });
        } else {
            setEditingTask(null);
            setFormData({
                title: '',
                description: '',
                status: TaskStatus.TODO,
                priority: TaskPriority.MEDIUM,
                estimated_hours: 0,
                due_date: new Date().toISOString().split('T')[0],
                project_id: 0,
            });
        }
        setDialogOpen(true);
    };

    const handleCloseDialog = () => {
        setDialogOpen(false);
        setEditingTask(null);
    };

    const handleSubmit = () => {
        if (!formData.project_id) {
            alert('Please select a project');
            return;
        }

        const taskData = {
            title: formData.title,
            description: formData.description,
            status: formData.status,
            priority: formData.priority,
            estimated_hours: formData.estimated_hours,
            due_date: formData.due_date ? new Date(formData.due_date).toISOString() : undefined,
            project_id: formData.project_id,
        };

        if (editingTask) {
            updateMutation.mutate({
                id: editingTask.id,
                task: taskData,
            });
        } else {
            createMutation.mutate(taskData);
        }
    };

    const getStatusChipColor = (status: TaskStatus) => {
        switch (status) {
            case TaskStatus.TODO:
                return 'default';
            case TaskStatus.IN_PROGRESS:
                return 'primary';
            case TaskStatus.REVIEW:
                return 'warning';
            case TaskStatus.DONE:
                return 'success';
            default:
                return 'default';
        }
    };

    const getPriorityChipColor = (priority: TaskPriority) => {
        switch (priority) {
            case TaskPriority.LOW:
                return 'success';
            case TaskPriority.MEDIUM:
                return 'warning';
            case TaskPriority.HIGH:
                return 'error';
            default:
                return 'default';
        }
    };

    const canManageTask = (task: Task) => {
        // Superusers can manage all tasks
        if (user?.is_superuser) {
            return true;
        }

        // Managers can manage tasks in their projects
        if (user?.role === UserRole.MANAGER) {
            const project = projects?.find(p => p.id === task.project_id);
            return project?.manager_id === user?.id;
        }

        // Regular employees cannot edit tasks
        return false;
    };

    const getAvailableTeamMembers = () => {
        return employees || [];
    };

    const handleProjectChange = async (projectId: number) => {
        setFormData({
            ...formData,
            project_id: projectId,
        });

        if (projectId) {
            try {
                const projectDetails = await api.getProject(projectId);
                const selectedProject = projects?.find(p => p.id === projectId);
                if (selectedProject) {
                    selectedProject.team_members = projectDetails.team_members;
                }
            } catch (error) {
                console.error('Error fetching project details:', error);
            }
        }
    };

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4">Tasks</Typography>
                {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={() => handleOpenDialog()}
                    >
                        New Task
                    </Button>
                )}
            </Box>

            <Grid container spacing={3}>
                {tasks?.map((task) => (
                    <Grid item xs={12} md={6} lg={4} key={task.id}>
                        <Card>
                            <CardContent>
                                <Box display="flex" justifyContent="space-between" mb={2}>
                                    <Typography variant="h6">{task.title}</Typography>
                                    <Box>
                                        <Chip
                                            label={task.status}
                                            color={getStatusChipColor(task.status)}
                                            size="small"
                                            sx={{ mr: 1 }}
                                        />
                                        <Chip
                                            label={task.priority}
                                            color={getPriorityChipColor(task.priority)}
                                            size="small"
                                        />
                                    </Box>
                                </Box>
                                <Typography variant="body2" color="textSecondary" paragraph>
                                    {task.description}
                                </Typography>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">
                                        Project:{' '}
                                        {projects?.find((p) => p.id === task.project_id)?.name}
                                    </Typography>
                                    <Typography variant="body2">
                                        Est. Hours: {task.estimated_hours}
                                    </Typography>
                                </Box>
                                <Box display="flex" justifyContent="space-between" mb={2}>
                                    <Typography variant="body2">
                                        Due: {task.due_date ? format(new Date(task.due_date), 'MMM dd, yyyy') : 'No due date'}
                                    </Typography>
                                    {task.assigned_to_id && (
                                        <Box display="flex" alignItems="center">
                                            <Person fontSize="small" sx={{ mr: 0.5 }} />
                                            <Typography variant="body2">
                                                {
                                                    employees?.find((u) => u.id === task.assigned_to_id)
                                                        ?.full_name
                                                }
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                                {canManageTask(task) && (
                                    <Box display="flex" justifyContent="flex-end">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenDialog(task)}
                                        >
                                            <Edit />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => deleteMutation.mutate(task.id)}
                                        >
                                            <Delete />
                                        </IconButton>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Task Form Dialog */}
            <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
                                }
                                required
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
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={formData.status}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            status: e.target.value as TaskStatus,
                                        })
                                    }
                                    label="Status"
                                >
                                    {Object.values(TaskStatus).map((status) => (
                                        <MenuItem key={status} value={status}>
                                            {status}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    value={formData.priority}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            priority: e.target.value as TaskPriority,
                                        })
                                    }
                                    label="Priority"
                                >
                                    {Object.values(TaskPriority).map((priority) => (
                                        <MenuItem key={priority} value={priority}>
                                            {priority}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Estimated Hours"
                                value={formData.estimated_hours}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        estimated_hours: parseFloat(e.target.value),
                                    })
                                }
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Project</InputLabel>
                                <Select
                                    value={formData.project_id || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            project_id: e.target.value as number,
                                        })
                                    }
                                    label="Project"
                                >
                                    <MenuItem value="">
                                        <em>Select a project</em>
                                    </MenuItem>
                                    {projects?.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
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
                        {editingTask ? 'Save' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 