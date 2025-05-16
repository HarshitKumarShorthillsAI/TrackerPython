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
import { Task, TaskStatus, TaskPriority, Project, User } from '../types';
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
    assigned_to_id?: number;
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
        assigned_to_id: undefined,
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
                assigned_to_id: task.assigned_to_id,
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
                assigned_to_id: undefined,
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
            assigned_to_id: formData.assigned_to_id || undefined
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

    const canManageTask = (task: Task) =>
        user?.is_superuser ||
        task.created_by_id === user?.id ||
        task.assigned_to_id === user?.id;

    const getAvailableTeamMembers = () => {
        return employees || [];
    };

    const handleProjectChange = async (projectId: number) => {
        setFormData({
            ...formData,
            project_id: projectId,
            assigned_to_id: undefined
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
                {isManager() && (
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
                                        Due: {format(new Date(task.due_date), 'MMM dd, yyyy')}
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
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Title"
                                value={formData.title}
                                onChange={(e) =>
                                    setFormData({ ...formData, title: e.target.value })
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
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth margin="normal">
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
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    value={formData.priority}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setFormData({
                                            ...formData,
                                            priority: value as TaskPriority,
                                        });
                                    }}
                                    label="Priority"
                                >
                                    <MenuItem value={TaskPriority.LOW}>Low</MenuItem>
                                    <MenuItem value={TaskPriority.MEDIUM}>Medium</MenuItem>
                                    <MenuItem value={TaskPriority.HIGH}>High</MenuItem>
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
                                        estimated_hours: Number(e.target.value),
                                    })
                                }
                                margin="normal"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Due Date"
                                value={formData.due_date}
                                onChange={(e) =>
                                    setFormData({
                                        ...formData,
                                        due_date: e.target.value,
                                    })
                                }
                                margin="normal"
                                InputLabelProps={{
                                    shrink: true,
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth margin="normal" error={!formData.project_id}>
                                <InputLabel>Project *</InputLabel>
                                <Select
                                    value={formData.project_id || ''}
                                    onChange={(e) => handleProjectChange(e.target.value as number)}
                                    label="Project *"
                                    required
                                >
                                    <MenuItem value="">
                                        <em>Select a Project</em>
                                    </MenuItem>
                                    {projects?.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth margin="normal">
                                <InputLabel>Assigned To</InputLabel>
                                <Select
                                    value={formData.assigned_to_id || ''}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            assigned_to_id: e.target.value as number,
                                        })
                                    }
                                    label="Assigned To"
                                    disabled={!formData.project_id}
                                >
                                    <MenuItem value="">
                                        <em>None</em>
                                    </MenuItem>
                                    {getAvailableTeamMembers().map((user) => (
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
                        {editingTask ? 'Save' : 'Create'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 