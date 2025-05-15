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
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
} from '@mui/material';
import {
    PlayArrow,
    Stop,
    Edit,
    Delete,
    Check,
    Close,
    Send,
    AttachMoney,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { format } from 'date-fns';
import { TimeEntry, TimeEntryStatus, Task, Project, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const TimeEntries = () => {
    const [activeTimer, setActiveTimer] = useState<number | null>(null);
    const [description, setDescription] = useState('');
    const [selectedTask, setSelectedTask] = useState<number | null>(null);
    const [selectedProject, setSelectedProject] = useState<number | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editDescription, setEditDescription] = useState('');
    const queryClient = useQueryClient();
    const { user } = useAuth();

    const { data: timeEntries } = useQuery({
        queryKey: ['timeEntries'],
        queryFn: api.getTimeEntries
    });
    const { data: tasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: api.getTasks
    });
    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects
    });

    const createMutation = useMutation({
        mutationFn: api.createTimeEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setDescription('');
            setSelectedTask(null);
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: number; timeEntry: Partial<TimeEntry> }) =>
            api.updateTimeEntry(data.id, data.timeEntry),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setActiveTimer(null);
            setEditDialogOpen(false);
        },
    });

    const submitMutation = useMutation({
        mutationFn: (id: number) => api.submitTimeEntry(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] }),
    });

    const approveMutation = useMutation({
        mutationFn: (id: number) => api.approveTimeEntry(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] }),
    });

    const rejectMutation = useMutation({
        mutationFn: (data: { id: number; reason: string }) =>
            api.rejectTimeEntry(data.id, data.reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setRejectDialogOpen(false);
            setRejectionReason('');
            setSelectedTimeEntry(null);
        },
    });

    const markBilledMutation = useMutation({
        mutationFn: (id: number) => api.markTimeEntryBilled(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] }),
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => api.deleteTimeEntry(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] }),
    });

    const startTimer = () => {
        if (!selectedTask) return;
        createMutation.mutate({
            task_id: selectedTask,
            start_time: new Date().toISOString(),
            description,
            status: TimeEntryStatus.DRAFT,
            project_id: selectedProject!,
        });
        setActiveTimer(selectedTask);
    };

    const stopTimer = (timeEntryId: number) => {
        updateMutation.mutate({
            id: timeEntryId,
            timeEntry: { end_time: new Date().toISOString() },
        });
    };

    const handleEdit = (timeEntry: TimeEntry) => {
        setSelectedTimeEntry(timeEntry);
        setEditDescription(timeEntry.description || '');
        setEditDialogOpen(true);
    };

    const handleEditSave = () => {
        if (!selectedTimeEntry) return;
        updateMutation.mutate({
            id: selectedTimeEntry.id,
            timeEntry: { description: editDescription },
        });
    };

    const handleReject = (timeEntry: TimeEntry) => {
        setSelectedTimeEntry(timeEntry);
        setRejectDialogOpen(true);
    };

    const handleRejectConfirm = () => {
        if (!selectedTimeEntry || !rejectionReason) return;
        rejectMutation.mutate({
            id: selectedTimeEntry.id,
            reason: rejectionReason,
        });
    };

    const getStatusChipColor = (status: TimeEntryStatus) => {
        switch (status) {
            case TimeEntryStatus.DRAFT:
                return 'default';
            case TimeEntryStatus.SUBMITTED:
                return 'info';
            case TimeEntryStatus.APPROVED:
                return 'success';
            case TimeEntryStatus.REJECTED:
                return 'error';
            case TimeEntryStatus.BILLED:
                return 'secondary';
            default:
                return 'default';
        }
    };

    const canManageTimeEntry = (timeEntry: TimeEntry) =>
        user?.is_superuser ||
        user?.role === UserRole.MANAGER ||
        timeEntry.user_id === user?.id;

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Time Tracking
            </Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth>
                                <InputLabel>Project</InputLabel>
                                <Select
                                    value={selectedProject || ''}
                                    onChange={(e) => setSelectedProject(e.target.value as number)}
                                    label="Project"
                                >
                                    {projects?.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <FormControl fullWidth>
                                <InputLabel>Task</InputLabel>
                                <Select
                                    value={selectedTask || ''}
                                    onChange={(e) => setSelectedTask(e.target.value as number)}
                                    label="Task"
                                    disabled={!selectedProject}
                                >
                                    {tasks
                                        ?.filter((task) => task.project_id === selectedProject)
                                        .map((task) => (
                                            <MenuItem key={task.id} value={task.id}>
                                                {task.title}
                                            </MenuItem>
                                        ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Button
                                variant={activeTimer ? 'contained' : 'outlined'}
                                color={activeTimer ? 'secondary' : 'primary'}
                                onClick={() => (activeTimer ? stopTimer(activeTimer) : startTimer())}
                                startIcon={activeTimer ? <Stop /> : <PlayArrow />}
                                disabled={!selectedTask}
                            >
                                {activeTimer ? 'Stop Timer' : 'Start Timer'}
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Typography variant="h6" gutterBottom>
                Time Entries
            </Typography>

            {timeEntries?.map((entry) => (
                <Card key={entry.id} sx={{ mb: 2 }}>
                    <CardContent>
                        <Grid container alignItems="center" spacing={2}>
                            <Grid item xs={12} md={3}>
                                <Typography variant="subtitle1">
                                    {tasks?.find((t) => t.id === entry.task_id)?.title}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {entry.description}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <Typography variant="body2">
                                    {format(new Date(entry.start_time), 'MMM dd, yyyy HH:mm')}
                                    {entry.end_time &&
                                        ` - ${format(new Date(entry.end_time), 'HH:mm')}`}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} md={2}>
                                <Chip
                                    label={entry.status}
                                    color={getStatusChipColor(entry.status)}
                                    size="small"
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                {canManageTimeEntry(entry) && (
                                    <>
                                        {entry.status === TimeEntryStatus.DRAFT && (
                                            <>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => handleEdit(entry)}
                                                >
                                                    <Edit />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => submitMutation.mutate(entry.id)}
                                                >
                                                    <Send />
                                                </IconButton>
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => deleteMutation.mutate(entry.id)}
                                                >
                                                    <Delete />
                                                </IconButton>
                                            </>
                                        )}
                                        {entry.status === TimeEntryStatus.SUBMITTED &&
                                            (user?.role === UserRole.MANAGER ||
                                                user?.is_superuser) && (
                                                <>
                                                    <IconButton
                                                        size="small"
                                                        color="success"
                                                        onClick={() =>
                                                            approveMutation.mutate(entry.id)
                                                        }
                                                    >
                                                        <Check />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleReject(entry)}
                                                    >
                                                        <Close />
                                                    </IconButton>
                                                </>
                                            )}
                                        {entry.status === TimeEntryStatus.APPROVED &&
                                            (user?.role === UserRole.MANAGER ||
                                                user?.is_superuser) && (
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() =>
                                                        markBilledMutation.mutate(entry.id)
                                                    }
                                                >
                                                    <AttachMoney />
                                                </IconButton>
                                            )}
                                    </>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            ))}

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
                <DialogTitle>Edit Time Entry</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        margin="normal"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleEditSave} color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Reject Dialog */}
            <Dialog open={rejectDialogOpen} onClose={() => setRejectDialogOpen(false)}>
                <DialogTitle>Reject Time Entry</DialogTitle>
                <DialogContent>
                    <TextField
                        fullWidth
                        label="Rejection Reason"
                        value={rejectionReason}
                        onChange={(e) => setRejectionReason(e.target.value)}
                        margin="normal"
                        multiline
                        rows={4}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleRejectConfirm} color="error">
                        Reject
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}; 