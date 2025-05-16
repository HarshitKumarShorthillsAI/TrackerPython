import React, { useState, useEffect, useCallback } from 'react';
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
    Container,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TableContainer,
    Tooltip,
    FormControlLabel,
    Switch,
    Stack,
    DialogContentText
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
    AccessTime,
    Info,
    FilterList
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../services/api';
import { format, differenceInHours, differenceInMinutes, parseISO } from 'date-fns';
import { TimeEntry, TimeEntryStatus, Task, Project, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useSnackbar } from 'notistack';

interface PendingApprovalsProps {
    timeEntries: TimeEntry[];
    projects: Project[];
    tasks: Task[];
    employees: any[];
    onApprove: (timeEntry: TimeEntry) => void;
    onReject: (timeEntry: TimeEntry) => void;
}

const PendingApprovals: React.FC<PendingApprovalsProps> = ({
    timeEntries,
    projects,
    tasks,
    employees,
    onApprove,
    onReject
}) => {
    const findProject = (projectId: number) => projects?.find(p => p.id === projectId);
    const findTask = (taskId: number) => tasks?.find(t => t.id === taskId);
    const findEmployee = (userId: number) => employees?.find(e => e.id === userId);

    if (!timeEntries.length) {
        return (
            <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1" color="textSecondary">
                    No pending approvals
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>
                Pending Approvals
            </Typography>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Employee</TableCell>
                            <TableCell>Project</TableCell>
                            <TableCell>Task</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Date</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {timeEntries.map((entry) => {
                            const project = findProject(entry.project_id);
                            const task = findTask(entry.task_id);
                            const employee = findEmployee(entry.user_id);
                            
                            return (
                                <TableRow key={entry.id}>
                                    <TableCell>
                                        {employee?.full_name || employee?.email || 'Unknown'}
                                    </TableCell>
                                    <TableCell>{project?.name || 'Unknown'}</TableCell>
                                    <TableCell>{task?.title || 'Unknown'}</TableCell>
                                    <TableCell>{entry.description}</TableCell>
                                    <TableCell>
                                        {format(parseISO(entry.start_time), 'MMM d, yyyy')}
                                    </TableCell>
                                    <TableCell>
                                        {calculateDuration(entry)}
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={1}>
                                            <Tooltip title="Approve">
                                                <IconButton
                                                    color="success"
                                                    onClick={() => onApprove(entry)}
                                                    size="small"
                                                >
                                                    <Check />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Reject">
                                                <IconButton
                                                    color="error"
                                                    onClick={() => onReject(entry)}
                                                    size="small"
                                                >
                                                    <Close />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export const TimeEntries = () => {
    const [activeTimer, setActiveTimer] = useState<number | null>(null);
    const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
    const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
    const [selectedProject, setSelectedProject] = useState<number | null>(null);
    const [selectedTask, setSelectedTask] = useState<number | null>(null);
    const [description, setDescription] = useState('');
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [endTime, setEndTime] = useState<Date | null>(null);
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [selectedTimeEntry, setSelectedTimeEntry] = useState<TimeEntry | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editData, setEditData] = useState<Partial<TimeEntry>>({});
    const [error, setError] = useState<string | null>(null);
    const [showPendingOnly, setShowPendingOnly] = useState(false);
    const [filterDialogOpen, setFilterDialogOpen] = useState(false);
    const [dateRange, setDateRange] = useState<{
        startDate: Date | null;
        endDate: Date | null;
    }>({
        startDate: null,
        endDate: null
    });
    const [statusFilter, setStatusFilter] = useState<TimeEntryStatus | 'ALL'>('ALL');
    
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Query for basic project list
    const { data: projects, isLoading: isLoadingProjects, error: projectsError } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects,
        staleTime: 5 * 60 * 1000
    });

    const { data: tasks, isLoading: isLoadingTasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: api.getTasks
    });

    const { data: timeEntries, isLoading: isLoadingTimeEntries } = useQuery({
        queryKey: ['timeEntries', statusFilter],
        queryFn: () => api.getTimeEntries(statusFilter !== 'ALL' ? statusFilter : undefined)
    });

    // Query for employees data
    const { data: employees } = useQuery({
        queryKey: ['employees'],
        queryFn: api.getEmployees,
        enabled: user?.is_superuser || user?.role === UserRole.MANAGER
    });

    // Get available projects for the user
    const availableProjects = React.useMemo(() => {
        if (!projects) return [];
        
        // The backend API already filters projects based on user permissions
        // No need for additional filtering in the frontend
        return projects;
    }, [projects]);

    // Get available tasks based on selected project
    const availableTasks = tasks?.filter(task => {
        if (!selectedProject) return false;
        return task.project_id === selectedProject;
    }) || [];

    // Filter time entries based on user role and status
    const filteredTimeEntries = React.useMemo(() => {
        if (!timeEntries || !user || !projects) return [];

        return timeEntries.filter(entry => {
            // Apply status filter first
            if (statusFilter !== 'ALL' && entry.status !== statusFilter) {
                return false;
            }

            // Superusers can see all time entries
            if (user.is_superuser) {
                return true;
            }
            
            // Managers can see all time entries from their projects
            if (user.role === UserRole.MANAGER) {
                return projects.some(project => 
                    project.id === entry.project_id && 
                    (project.manager_id === user.id || project.team_members?.includes(user.id))
                );
            }
            
            // Regular employees can only see their own time entries
            return entry.user_id === user.id;
        });
    }, [timeEntries, user, projects, statusFilter]);
f
    // Separate list for pending approvals section
    const pendingTimeEntries = React.useMemo(() => {
        if (!timeEntries || !user || !projects) return [];

        return timeEntries.filter(entry => {
            // Only show SUBMITTED entries
            if (entry.status !== TimeEntryStatus.SUBMITTED) return false;

            // Superusers can see all pending entries
            if (user.is_superuser) {
                return true;
            }

            // Managers can see pending entries from their projects
            if (user.role === UserRole.MANAGER) {
                return projects.some(project => 
                    project.id === entry.project_id && 
                    (project.manager_id === user.id || project.team_members?.includes(user.id))
                );
            }

            return false;
        });
    }, [timeEntries, user, projects]);

    // Add debugging logs
    useEffect(() => {
        if (pendingTimeEntries && user) {
            console.log('Pending time entries:', {
                count: pendingTimeEntries.length,
                entries: pendingTimeEntries,
                userRole: user.role,
                isSuperuser: user.is_superuser,
                projects: projects
            });
        }
    }, [pendingTimeEntries, user, projects]);

    // Mutations
    const createMutation = useMutation({
        mutationFn: api.createTimeEntry,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            resetForm();
            enqueueSnackbar('Time entry created successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            setError(error.message || 'Failed to create time entry');
            enqueueSnackbar('Failed to create time entry', { variant: 'error' });
        }
    });

    const updateMutation = useMutation({
        mutationFn: (params: { id: number; data: Partial<TimeEntry> }) => 
            api.updateTimeEntry(params.id, params.data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            setEditDialogOpen(false);
            setSelectedTimeEntry(null);
            enqueueSnackbar('Time entry updated successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            setError(error.message || 'Failed to update time entry');
            enqueueSnackbar('Failed to update time entry', { variant: 'error' });
        }
    });

    const submitMutation = useMutation({
        mutationFn: (id: number) => api.submitTimeEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            enqueueSnackbar('Time entry submitted successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            setError(error.message || 'Failed to submit time entry');
            enqueueSnackbar('Failed to submit time entry', { variant: 'error' });
        }
    });

    const approveMutation = useMutation({
        mutationFn: (id: number) => api.approveTimeEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            enqueueSnackbar('Time entry approved successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            setError(error.message || 'Failed to approve time entry');
            enqueueSnackbar('Failed to approve time entry', { variant: 'error' });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            api.rejectTimeEntry(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            enqueueSnackbar('Time entry rejected successfully', { variant: 'success' });
        },
        onError: (error) => {
            console.error('Error rejecting time entry:', error);
            enqueueSnackbar('Failed to reject time entry', { variant: 'error' });
        }
    });

    const markBilledMutation = useMutation({
        mutationFn: (id: number) => api.markTimeEntryBilled(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        },
        onError: (error: any) => {
            setError(error.message || 'Failed to mark time entry as billed');
        }
    });

    // Timer functionality
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (activeTimer) {
            interval = setInterval(() => {
                if (timerStartTime) {
                    const now = new Date();
                    const diff = now.getTime() - timerStartTime.getTime();
                    const hours = Math.floor(diff / (1000 * 60 * 60));
                    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                    setElapsedTime(
                        `${hours.toString().padStart(2, '0')}:${minutes
                            .toString()
                            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                    );
                }
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [activeTimer, timerStartTime]);

    const handleStartTimer = useCallback(() => {
        if (!selectedProject || !selectedTask) {
            setError('Please select a project and task first');
            return;
        }
        setActiveTimer(Date.now());
        setTimerStartTime(new Date());
        setStartTime(new Date());
    }, [selectedProject, selectedTask]);

    const handleStopTimer = useCallback(async () => {
        if (!startTime) return;
        
        const endTime = new Date();
        setEndTime(endTime);
        setActiveTimer(null);
        
        const selectedProjectData = projects?.find(p => p.id === selectedProject);
        
        try {
            await createMutation.mutateAsync({
                task_id: selectedTask!,
                project_id: selectedProject!,
                start_time: startTime.toISOString(),
                end_time: endTime.toISOString(),
                description: description,
                billable: true,
                status: TimeEntryStatus.DRAFT,
                hourly_rate: selectedProjectData?.hourly_rate || user?.hourly_rate || 0
            });
            
            resetForm();
        } catch (error: any) {
            setError(error.message || 'Failed to save time entry');
        }
    }, [startTime, selectedTask, selectedProject, description, createMutation, projects, user]);

    const resetForm = () => {
        setSelectedProject(null);
        setSelectedTask(null);
        setDescription('');
        setStartTime(null);
        setEndTime(null);
        setError(null);
    };

    const validateTimeEntry = (
        project: number | null,
        task: number | null,
        startTime: Date | null,
        endTime: Date | null,
        description: string
    ): string | null => {
        if (!project) return 'Please select a project';
        if (!task) return 'Please select a task';
        if (!startTime) return 'Please select a start time';
        if (!endTime) return 'Please select an end time';
        if (endTime < startTime) return 'End time cannot be before start time';
        if (!description.trim()) return 'Please enter a description';
        return null;
    };

    const handleCreateTimeEntry = async () => {
        const validationError = validateTimeEntry(
            selectedProject,
            selectedTask,
            startTime,
            endTime,
            description
        );

        if (validationError) {
            setError(validationError);
            return;
        }

        const selectedProjectData = projects?.find(p => p.id === selectedProject);

        try {
            await createMutation.mutateAsync({
                task_id: selectedTask!,
                project_id: selectedProject!,
                start_time: startTime!.toISOString(),
                end_time: endTime!.toISOString(),
                description: description,
                billable: true,
                hourly_rate: selectedProjectData?.hourly_rate || user?.hourly_rate || 0
            });
        } catch (error: any) {
            setError(error.message || 'Failed to create time entry');
        }
    };

    const handleEditTimeEntry = (timeEntry: TimeEntry) => {
        setSelectedTimeEntry(timeEntry);
        setEditData({
            description: timeEntry.description,
            start_time: timeEntry.start_time,
            end_time: timeEntry.end_time,
            billable: timeEntry.billable
        });
        setEditDialogOpen(true);
    };

    const handleUpdateTimeEntry = async () => {
        if (!selectedTimeEntry) return;
        
        try {
            await updateMutation.mutateAsync({
                id: selectedTimeEntry.id,
                data: editData
            });
        } catch (error: any) {
            setError(error.message || 'Failed to update time entry');
        }
    };

    const handleSubmitTimeEntry = async (timeEntry: TimeEntry) => {
        try {
            await submitMutation.mutateAsync(timeEntry.id);
        } catch (error: any) {
            setError(error.message || 'Failed to submit time entry');
        }
    };

    const handleApproveTimeEntry = async (timeEntry: TimeEntry) => {
        try {
            await approveMutation.mutateAsync(timeEntry.id);
        } catch (error: any) {
            setError(error.message || 'Failed to approve time entry');
        }
    };

    const handleRejectTimeEntry = async () => {
        if (!selectedTimeEntry || !rejectionReason.trim()) {
            setError('Please provide a rejection reason');
            return;
        }

        try {
            await rejectMutation.mutateAsync({
                id: selectedTimeEntry.id,
                reason: rejectionReason.trim()
            });
        } catch (error: any) {
            setError(error.message || 'Failed to reject time entry');
        }
    };

    const handleMarkBilled = async (timeEntry: TimeEntry) => {
        try {
            await markBilledMutation.mutateAsync(timeEntry.id);
        } catch (error: any) {
            setError(error.message || 'Failed to mark time entry as billed');
        }
    };

    const canManageTimeEntries = user?.is_superuser || user?.role === UserRole.MANAGER;

    const canApproveTimeEntries = user?.is_superuser || user?.role === UserRole.MANAGER;

    const getStatusChipColor = (status: TimeEntryStatus) => {
        switch (status) {
            case TimeEntryStatus.DRAFT:
                return 'default';
            case TimeEntryStatus.SUBMITTED:
                return 'primary';
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

    const handleOpenRejectDialog = (timeEntry: TimeEntry) => {
        setSelectedTimeEntry(timeEntry);
        setRejectDialogOpen(true);
    };

    const handleCloseRejectDialog = () => {
        setSelectedTimeEntry(null);
        setRejectionReason('');
        setRejectDialogOpen(false);
    };

    const handleReject = async () => {
        if (!selectedTimeEntry || !rejectionReason.trim()) return;
        try {
            await rejectMutation.mutateAsync({
                id: selectedTimeEntry.id,
                reason: rejectionReason.trim()
            });
            handleCloseRejectDialog();
        } catch (error) {
            console.error('Error rejecting time entry:', error);
        }
    };

    // Add a filter toolbar above the time entries table
    const renderFilterToolbar = () => (
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                    <FormControl sx={{ minWidth: 200 }}>
                        <InputLabel>Status Filter</InputLabel>
                        <Select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as TimeEntryStatus | 'ALL')}
                            label="Status Filter"
                        >
                            <MenuItem value="ALL">All Statuses</MenuItem>
                            <MenuItem value={TimeEntryStatus.DRAFT}>Draft</MenuItem>
                            <MenuItem value={TimeEntryStatus.SUBMITTED}>Pending Approval</MenuItem>
                            <MenuItem value={TimeEntryStatus.APPROVED}>Approved</MenuItem>
                            <MenuItem value={TimeEntryStatus.REJECTED}>Rejected</MenuItem>
                            <MenuItem value={TimeEntryStatus.BILLED}>Billed</MenuItem>
                        </Select>
                    </FormControl>
                )}
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DateTimePicker
                        label="From Date"
                        value={dateRange.startDate}
                        onChange={(newValue) => setDateRange(prev => ({ ...prev, startDate: newValue }))}
                    />
                    <DateTimePicker
                        label="To Date"
                        value={dateRange.endDate}
                        onChange={(newValue) => setDateRange(prev => ({ ...prev, endDate: newValue }))}
                    />
                </LocalizationProvider>
            </Box>
            {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                <FormControlLabel
                    control={
                        <Switch
                            checked={showPendingOnly}
                            onChange={(e) => setShowPendingOnly(e.target.checked)}
                            color="primary"
                        />
                    }
                    label="Show Pending Approvals Only"
                />
            )}
        </Box>
    );

    const calculateTotalHoursAndCost = (entries: TimeEntry[] | undefined) => {
        if (!entries) return { totalHours: 0, totalCost: 0 };
        
        return entries.reduce((acc, entry) => {
            if (!entry.end_time) return acc;
            const start = parseISO(entry.start_time);
            const end = parseISO(entry.end_time);
            const hours = differenceInMinutes(end, start) / 60;
            return {
                totalHours: acc.totalHours + hours,
                totalCost: acc.totalCost + (hours * entry.hourly_rate)
            };
        }, { totalHours: 0, totalCost: 0 });
    };

    if (isLoadingTimeEntries || isLoadingTasks || isLoadingProjects) {
        return <Typography>Loading...</Typography>;
    }

    const { totalHours, totalCost } = calculateTotalHoursAndCost(filteredTimeEntries);

    // Add error display for projects loading
    if (projectsError) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                Failed to load projects. Please refresh the page or contact support.
            </Alert>
        );
    }

    // Update project finding in the table cells
    const findProject = (projectId: number): Project | undefined => {
        return projects?.find((p: Project) => p.id === projectId);
    };

    return (
        <Container maxWidth="xl">
            {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                <PendingApprovals
                    timeEntries={pendingTimeEntries}
                    projects={projects || []}
                    tasks={tasks || []}
                    employees={employees || []}
                    onApprove={handleApproveTimeEntry}
                    onReject={handleOpenRejectDialog}
                />
            )}
            
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom>
                    Time Entries
                </Typography>
                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                {renderFilterToolbar()}
                <Card>
                    <CardContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Project</InputLabel>
                                    <Select
                                        value={selectedProject || ''}
                                        onChange={(e) => {
                                            setSelectedProject(e.target.value as number);
                                            setSelectedTask(null); // Reset task when project changes
                                        }}
                                        disabled={isLoadingProjects}
                                    >
                                        <MenuItem value="">
                                            <em>Select a project</em>
                                        </MenuItem>
                                        {availableProjects.map((project) => (
                                            <MenuItem key={project.id} value={project.id}>
                                                {project.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {isLoadingProjects && (
                                    <Typography variant="caption" color="textSecondary">
                                        Loading projects...
                                    </Typography>
                                )}
                                {projectsError && (
                                    <Typography variant="caption" color="error">
                                        Error loading projects. Please try again.
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Task</InputLabel>
                                    <Select
                                        value={selectedTask || ''}
                                        onChange={(e) => setSelectedTask(e.target.value as number)}
                                        disabled={!selectedProject || isLoadingTasks}
                                    >
                                        <MenuItem value="">
                                            <em>Select a task</em>
                                        </MenuItem>
                                        {availableTasks.map((task) => (
                                            <MenuItem key={task.id} value={task.id}>
                                                {task.title}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {isLoadingTasks && (
                                    <Typography variant="caption" color="textSecondary">
                                        Loading tasks...
                                    </Typography>
                                )}
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <TextField
                                    fullWidth
                                    label="Description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    disabled={!!activeTimer}
                                />
                            </Grid>
                            {!activeTimer ? (
                                <>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DateTimePicker
                                                label="Start Time"
                                                value={startTime}
                                                onChange={(newValue) => setStartTime(newValue)}
                                                sx={{ width: '100%' }}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <DateTimePicker
                                                label="End Time"
                                                value={endTime}
                                                onChange={(newValue) => setEndTime(newValue)}
                                                sx={{ width: '100%' }}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            onClick={handleCreateTimeEntry}
                                            disabled={!selectedProject || !selectedTask || !startTime || !endTime}
                                            fullWidth
                                        >
                                            Create Time Entry
                                        </Button>
                                    </Grid>
                                </>
                            ) : (
                                <Grid item xs={12} sm={6} md={3}>
                                    <Typography variant="h6" align="center">
                                        {elapsedTime}
                                    </Typography>
                                </Grid>
                            )}
                            <Grid item xs={12} sm={6} md={3}>
                                {!activeTimer ? (
                                    <Button
                                        variant="contained"
                                        color="success"
                                        onClick={handleStartTimer}
                                        disabled={!selectedProject || !selectedTask}
                                        startIcon={<PlayArrow />}
                                        fullWidth
                                    >
                                        Start Timer
                                    </Button>
                                ) : (
                                    <Button
                                        variant="contained"
                                        color="error"
                                        onClick={handleStopTimer}
                                        startIcon={<Stop />}
                                        fullWidth
                                    >
                                        Stop Timer
                                    </Button>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            </Box>

            <Typography variant="h5" gutterBottom>
                {user?.is_superuser || user?.role === UserRole.MANAGER ? 'All Time Entries' : 'My Time Entries'}
            </Typography>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                <TableCell>Employee</TableCell>
                            )}
                            <TableCell>Project</TableCell>
                            <TableCell>Task</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Start Time</TableCell>
                            <TableCell>End Time</TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Cost</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filteredTimeEntries?.map((entry) => (
                            <TableRow key={entry.id}>
                                {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                    <TableCell>
                                        {employees?.find(e => e.id === entry.user_id)?.full_name || 'Unknown'}
                                    </TableCell>
                                )}
                                <TableCell>
                                    {findProject(entry.project_id)?.name}
                                </TableCell>
                                <TableCell>
                                    {tasks?.find(t => t.id === entry.task_id)?.title}
                                </TableCell>
                                <TableCell>{entry.description}</TableCell>
                                <TableCell>
                                    {format(parseISO(entry.start_time), 'yyyy-MM-dd HH:mm')}
                                </TableCell>
                                <TableCell>
                                    {entry.end_time && format(parseISO(entry.end_time), 'yyyy-MM-dd HH:mm')}
                                </TableCell>
                                <TableCell>{calculateDuration(entry)}</TableCell>
                                <TableCell>${calculateCost(entry)}</TableCell>
                                <TableCell>
                                    <Tooltip 
                                        title={entry.rejection_reason ? `Rejection reason: ${entry.rejection_reason}` : ''} 
                                        arrow
                                    >
                                        <Chip
                                            label={entry.status}
                                            color={getStatusChipColor(entry.status)}
                                            icon={entry.rejection_reason ? <Info /> : undefined}
                                        />
                                    </Tooltip>
                                </TableCell>
                                <TableCell>
                                    <Stack direction="row" spacing={1}>
                                        {entry.status === TimeEntryStatus.DRAFT && entry.user_id === user?.id && (
                                            <>
                                                <IconButton onClick={() => handleEditTimeEntry(entry)} size="small">
                                                    <Edit />
                                                </IconButton>
                                                <IconButton onClick={() => handleSubmitTimeEntry(entry)} size="small">
                                                    <Send />
                                                </IconButton>
                                            </>
                                        )}
                                        {entry.status === TimeEntryStatus.SUBMITTED &&
                                            (user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                            <>
                                                <IconButton
                                                    onClick={() => handleApproveTimeEntry(entry)}
                                                    size="small"
                                                    color="success"
                                                >
                                                    <Check />
                                                </IconButton>
                                                <IconButton
                                                    onClick={() => handleOpenRejectDialog(entry)}
                                                    size="small"
                                                    color="error"
                                                >
                                                    <Close />
                                                </IconButton>
                                            </>
                                        )}
                                        {entry.status === TimeEntryStatus.APPROVED &&
                                            (user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                            <IconButton
                                                onClick={() => handleMarkBilled(entry)}
                                                size="small"
                                            >
                                                <AttachMoney />
                                            </IconButton>
                                        )}
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Box sx={{ mt: 3, mb: 2 }}>
                <Paper sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6">
                                Total Hours: {totalHours.toFixed(2)}
                            </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6">
                                Total Cost: ${totalCost.toFixed(2)}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            </Box>

            {/* Edit Dialog */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
                <DialogTitle>Edit Time Entry</DialogTitle>
                <DialogContent>
                    <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Description"
                                value={editData.description || ''}
                                onChange={(e) =>
                                    setEditData({ ...editData, description: e.target.value })
                                }
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DateTimePicker
                                    label="Start Time"
                                    value={editData.start_time ? parseISO(editData.start_time) : null}
                                    onChange={(newValue) =>
                                        setEditData({
                                            ...editData,
                                            start_time: newValue?.toISOString()
                                        })
                                    }
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DateTimePicker
                                    label="End Time"
                                    value={editData.end_time ? parseISO(editData.end_time) : null}
                                    onChange={(newValue) =>
                                        setEditData({
                                            ...editData,
                                            end_time: newValue?.toISOString()
                                        })
                                    }
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleUpdateTimeEntry} variant="contained" color="primary">
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Rejection Dialog */}
            <RejectDialog
                open={rejectDialogOpen}
                onClose={handleCloseRejectDialog}
                rejectionReason={rejectionReason}
                onReasonChange={setRejectionReason}
                onReject={handleReject}
            />
        </Container>
    );
};

const calculateCost = (timeEntry: TimeEntry) => {
    if (!timeEntry.end_time) return 0;
    const start = parseISO(timeEntry.start_time);
    const end = parseISO(timeEntry.end_time);
    const hours = differenceInMinutes(end, start) / 60;
    return hours * timeEntry.hourly_rate;
};

const calculateDuration = (timeEntry: TimeEntry) => {
    if (!timeEntry.end_time) return 'In Progress';
    const start = parseISO(timeEntry.start_time);
    const end = parseISO(timeEntry.end_time);
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    return `${hours}h ${minutes}m`;
};

interface RejectDialogProps {
    open: boolean;
    onClose: () => void;
    rejectionReason: string;
    onReasonChange: (reason: string) => void;
    onReject: () => void;
}

const RejectDialog: React.FC<RejectDialogProps> = ({
    open,
    onClose,
    rejectionReason,
    onReasonChange,
    onReject
}) => (
    <Dialog open={open} onClose={onClose}>
        <DialogTitle>Reject Time Entry</DialogTitle>
        <DialogContent>
            <DialogContentText>
                Please provide a reason for rejecting this time entry:
            </DialogContentText>
            <TextField
                autoFocus
                margin="dense"
                label="Rejection Reason"
                type="text"
                fullWidth
                multiline
                rows={3}
                value={rejectionReason}
                onChange={(e) => onReasonChange(e.target.value)}
            />
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Cancel</Button>
            <Button
                onClick={onReject}
                color="error"
                disabled={!rejectionReason.trim()}
            >
                Reject
            </Button>
        </DialogActions>
    </Dialog>
); 