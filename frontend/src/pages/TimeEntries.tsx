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
    DialogContentText,
    CircularProgress
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
import { format, differenceInHours, differenceInMinutes, parseISO, startOfDay, endOfDay, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { TimeEntry, TimeEntryStatus, Task, Project, UserRole, ProjectWithTeam, User } from '../types/index';
import { useAuth } from '../contexts/AuthContext';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useSnackbar } from 'notistack';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { monthlyQuotasApi, MonthlyQuota } from '../services/monthlyQuotas';

// Utility functions
const calculateDuration = (entry: TimeEntry): string => {
    if (!entry.end_time) return '00:00';
    const start = parseISO(entry.start_time);
    const end = parseISO(entry.end_time);
    const hours = differenceInHours(end, start);
    const minutes = differenceInMinutes(end, start) % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
};

const calculateCost = (entry: TimeEntry): string => {
    if (!entry.end_time) return '0.00';
    const start = parseISO(entry.start_time);
    const end = parseISO(entry.end_time);
    const hours = differenceInMinutes(end, start) / 60;
    return (hours * entry.hourly_rate).toFixed(2);
};

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

interface PendingApprovalsProps {
    timeEntries: TimeEntry[];
    projects: ProjectWithTeam[];
    tasks: Task[];
    employees: User[];
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
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
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
    const [currentMonthQuota, setCurrentMonthQuota] = useState<MonthlyQuota | null>(null);
    
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Force refresh data when user changes or component mounts
    useEffect(() => {
        if (user) {
            // Invalidate and refetch all relevant queries
            queryClient.invalidateQueries({ queryKey: ['projects'] });
            queryClient.invalidateQueries({ queryKey: ['tasks'] });
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            queryClient.invalidateQueries({ queryKey: ['employees'] });
        }
    }, [user, queryClient]);

    // Query for projects with team members
    const { data: projects, isLoading: isLoadingProjects, error: projectsError, refetch: refetchProjects } = useQuery<ProjectWithTeam[]>({
        queryKey: ['projects'],
        queryFn: async () => {
            try {
                // Get all projects first
                const projectsList = await api.getProjects();
                
                // Then fetch full details for each project
                const projectsWithTeam = await Promise.all(
                    projectsList.map(project => api.getProject(project.id))
                );
                
                return projectsWithTeam;
            } catch (error) {
                console.error('Error fetching projects:', error);
                throw error;
            }
        },
        enabled: Boolean(user?.id), // Only run query when user is logged in
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true,
        retry: 2
    });

    const { data: tasks, isLoading: isLoadingTasks, refetch: refetchTasks } = useQuery<Task[]>({
        queryKey: ['tasks'],
        queryFn: api.getTasks,
        enabled: Boolean(user?.id) && Boolean(projects), // Only fetch tasks after projects are loaded
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true
    });

    const { data: timeEntries, isLoading: isLoadingTimeEntries, refetch: refetchTimeEntries } = useQuery<TimeEntry[]>({
        queryKey: ['timeEntries'],
        queryFn: () => api.getTimeEntries(undefined),
        enabled: Boolean(user?.id) && Boolean(projects) && Boolean(tasks), // Only fetch time entries after projects and tasks are loaded
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true
    });

    // Query for employees data
    const { data: employees, refetch: refetchEmployees } = useQuery<User[]>({
        queryKey: ['employees'],
        queryFn: api.getEmployees,
        enabled: Boolean(user?.id) && (user?.is_superuser || user?.role === UserRole.MANAGER),
        staleTime: 5 * 60 * 1000,
        refetchOnWindowFocus: true,
        refetchOnMount: true
    });

    // Function to manually refresh all data
    const refreshAllData = useCallback(async () => {
        try {
            await Promise.all([
                refetchProjects(),
                refetchTasks(),
                refetchTimeEntries(),
                refetchEmployees()
            ]);
            enqueueSnackbar('Data refreshed successfully', { variant: 'success' });
        } catch (error) {
            console.error('Error refreshing data:', error);
            enqueueSnackbar('Failed to refresh data. Please try again.', { variant: 'error' });
        }
    }, [refetchProjects, refetchTasks, refetchTimeEntries, refetchEmployees, enqueueSnackbar]);

    // Refresh data periodically
    useEffect(() => {
        if (!user) return;

        const intervalId = setInterval(() => {
            refreshAllData();
        }, 5 * 60 * 1000); // Refresh every 5 minutes

        return () => clearInterval(intervalId);
    }, [user, refreshAllData]);

    // Filter projects based on user role and team membership
    const availableProjects = React.useMemo(() => {
        if (!projects || !user || isLoadingProjects) {
            console.log('Projects not ready:', { projects, user, isLoadingProjects });
            return [];
        }

        // Validate project data
        const validProjects = projects.filter(project => {
            if (!project || typeof project.id !== 'number' || !project.name) {
                console.warn('Invalid project data:', project);
                return false;
            }
            return true;
        });

        // Superusers and managers can see all projects
        if (user.is_superuser || user.role === UserRole.MANAGER) {
            return validProjects;
        }

        // Regular users can only see projects where they are team members
        return validProjects.filter((project: ProjectWithTeam) => {
            if (!Array.isArray(project.team_members)) {
                console.warn('Project has invalid team_members:', project);
                return false;
            }
            return project.team_members.some(member => member.id === user.id);
        });
    }, [projects, user, isLoadingProjects]);

    // Add debug logging for project data
    useEffect(() => {
        if (projects) {
            console.log('Projects loaded:', {
                count: projects.length,
                hasTeamMembers: projects.every(p => Array.isArray(p.team_members)),
                projects: projects
            });
        }
    }, [projects]);

    // Get available tasks based on selected project and user assignments
    const availableTasks = React.useMemo(() => {
        if (!tasks || !selectedProject || !user) return [];
        
        return tasks.filter(task => {
            // Task must belong to the selected project
            if (task.project_id !== selectedProject) return false;

            // Superusers can see all tasks in the project
            if (user.is_superuser) return true;

            // Managers can see all tasks in their projects
            if (user.role === UserRole.MANAGER) {
                const project = projects?.find((p: ProjectWithTeam) => p.id === task.project_id);
                if (project?.manager_id === user.id) return true;
            }

            // Regular users can only see tasks assigned to them
            return task.assigned_to_id === user.id;
        });
    }, [tasks, selectedProject, user, projects]);

    // Filter time entries based on user role and status
    const filteredTimeEntries = React.useMemo(() => {
        if (!timeEntries || !user || !projects) return [];

        return timeEntries.filter((entry: TimeEntry) => {
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
                return projects.some((project: ProjectWithTeam) => 
                    project.id === entry.project_id && 
                    (project.manager_id === user.id || project.team_members.some(member => member.id === user.id))
                );
            }
            
            // Regular employees can only see their own time entries
            return entry.user_id === user.id;
        });
    }, [timeEntries, user, projects, statusFilter]);

    // Separate list for pending approvals section
    const pendingTimeEntries = React.useMemo(() => {
        if (!timeEntries || !user || !projects) return [];

        return timeEntries.filter((entry: TimeEntry) => {
            // Only show SUBMITTED entries
            if (entry.status !== TimeEntryStatus.SUBMITTED) return false;

            // Superusers can see all pending entries
            if (user.is_superuser) {
                return true;
            }

            // Managers can see pending entries from their projects
            if (user.role === UserRole.MANAGER) {
                return projects.some((project: ProjectWithTeam) => 
                    project.id === entry.project_id && 
                    (project.manager_id === user.id || project.team_members.some(member => member.id === user.id))
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
            console.error('Error submitting time entry:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Failed to submit time entry';
            enqueueSnackbar(errorMessage, { variant: 'error' });
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

    // Add delete mutation
    const deleteEntryMutation = useMutation({
        mutationFn: (id: number) => api.deleteTimeEntry(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
            enqueueSnackbar('Time entry deleted successfully', { variant: 'success' });
        },
        onError: (error: any) => {
            enqueueSnackbar(error.message || 'Failed to delete time entry', { variant: 'error' });
        },
    });

    const handleDeleteTimeEntry = async (id: number) => {
        if (window.confirm('Are you sure you want to delete this time entry?')) {
            try {
                await deleteEntryMutation.mutateAsync(id);
            } catch (error) {
                console.error('Error deleting time entry:', error);
            }
        }
    };

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
        setSelectedDate(null);
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

        if (!selectedDate || !startTime || !endTime) {
            setError('Please select date and times');
            return;
        }

        // Combine date and times
        const combinedStartTime = new Date(selectedDate);
        combinedStartTime.setHours(startTime.getHours(), startTime.getMinutes());

        const combinedEndTime = new Date(selectedDate);
        combinedEndTime.setHours(endTime.getHours(), endTime.getMinutes());

        // Validate that end time is after start time
        if (combinedEndTime <= combinedStartTime) {
            setError('End time must be after start time');
            return;
        }

        const selectedProjectData = projects?.find(p => p.id === selectedProject);

        try {
            await createMutation.mutateAsync({
                task_id: selectedTask!,
                project_id: selectedProject!,
                start_time: combinedStartTime.toISOString(),
                end_time: combinedEndTime.toISOString(),
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

    const handleSubmitTimeEntry = async (id: number) => {
        if (!id) {
            enqueueSnackbar('Invalid time entry ID', { variant: 'error' });
            return;
        }

        try {
            await submitMutation.mutateAsync(id);
            enqueueSnackbar('Time entry submitted successfully', { variant: 'success' });
            queryClient.invalidateQueries({ queryKey: ['timeEntries'] });
        } catch (error: any) {
            console.error('Error submitting time entry:', error);
            const errorMessage = error.response?.data?.detail || error.message || 'Failed to submit time entry';
            enqueueSnackbar(errorMessage, { variant: 'error' });
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
            enqueueSnackbar('Please provide a rejection reason', { variant: 'error' });
            return;
        }
        
        try {
            await rejectMutation.mutateAsync({
                id: selectedTimeEntry.id,
                reason: rejectionReason.trim()
            });
            handleCloseRejectDialog();
            enqueueSnackbar('Time entry rejected successfully', { variant: 'success' });
        } catch (error: any) {
            console.error('Error rejecting time entry:', error);
            const errorMessage = error.response?.data?.detail || 'Failed to reject time entry';
            enqueueSnackbar(errorMessage, { variant: 'error' });
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

    const handleOpenRejectDialog = (timeEntry: TimeEntry) => {
        setSelectedTimeEntry(timeEntry);
        setRejectDialogOpen(true);
    };

    const handleCloseRejectDialog = () => {
        setSelectedTimeEntry(null);
        setRejectionReason('');
        setRejectDialogOpen(false);
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

    // Update the loading check to be more specific
    const isInitialLoading = isLoadingTimeEntries || isLoadingTasks || isLoadingProjects;
    const isDataReady = !!projects && !!tasks && !!timeEntries;

    // Add function to calculate hours for a time range
    const calculateHoursForTimeRange = (entries: TimeEntry[] | undefined, start: Date, end: Date): number => {
        if (!entries) return 0;
        
        return entries.reduce((total, entry) => {
            if (!entry.end_time) return total;
            
            const entryStart = parseISO(entry.start_time);
            const entryEnd = parseISO(entry.end_time);
            
            // Check if entry falls within the time range
            if (isWithinInterval(entryStart, { start, end }) || 
                isWithinInterval(entryEnd, { start, end })) {
                const hours = differenceInMinutes(entryEnd, entryStart) / 60;
                return total + hours;
            }
            return total;
        }, 0);
    };

    // Calculate daily and weekly hours
    const { dailyHours, weeklyHours } = React.useMemo(() => {
        const now = new Date();
        const dayStart = startOfDay(now);
        const dayEnd = endOfDay(now);
        const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // Week starts on Monday
        const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

        // Filter entries for current user only
        const userEntries = timeEntries?.filter(entry => entry.user_id === user?.id);
        
        return {
            dailyHours: calculateHoursForTimeRange(userEntries, dayStart, dayEnd),
            weeklyHours: calculateHoursForTimeRange(userEntries, weekStart, weekEnd)
        };
    }, [timeEntries, user?.id]);

    // Add query for monthly quota
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = (currentDate.getMonth() + 1).toString().padStart(2, '0');
    
    // Fetch current month's quota
    useEffect(() => {
        const fetchCurrentMonthQuota = async () => {
            try {
                const monthStr = `${currentYear}-${currentMonth}`;
                const quota = await monthlyQuotasApi.getByMonth(monthStr);
                setCurrentMonthQuota(quota);
            } catch (error) {
                console.error('Error fetching monthly quota:', error);
            }
        };
        
        if (user?.id) {
            fetchCurrentMonthQuota();
        }
    }, [user?.id, currentYear, currentMonth]);

    // Calculate remaining hours for the month
    const calculateRemainingHours = () => {
        if (!currentMonthQuota || !timeEntries || !user) return null;

        const monthStart = new Date(currentYear, currentDate.getMonth(), 1);
        const monthEnd = new Date(currentYear, currentDate.getMonth() + 1, 0);
        
        // Calculate total hours worked this month for the logged-in user only
        const monthlyWorkedHours = timeEntries
            .filter(entry => entry.user_id === user.id) // Filter for logged-in user
            .reduce((total, entry) => {
                if (!entry.end_time) return total;
                const start = parseISO(entry.start_time);
                const end = parseISO(entry.end_time);
                
                // Only count if the entry is in the current month
                if (isWithinInterval(start, { start: monthStart, end: monthEnd }) ||
                    isWithinInterval(end, { start: monthStart, end: monthEnd })) {
                    const hours = differenceInMinutes(end, start) / 60;
                    return total + hours;
                }
                return total;
            }, 0);

        return {
            totalQuota: currentMonthQuota.monthly_hours,
            workedHours: monthlyWorkedHours,
            remainingHours: currentMonthQuota.monthly_hours - monthlyWorkedHours
        };
    };

    const monthlyStats = calculateRemainingHours();

    if (isInitialLoading || !isDataReady) {
        return (
            <Container maxWidth="xl">
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    minHeight: '50vh',
                    gap: 2
                }}>
                    <CircularProgress size={40} />
                    <Typography variant="h6" color="textSecondary">
                        {isLoadingProjects ? 'Loading projects...' : 
                         isLoadingTasks ? 'Loading tasks...' :
                         isLoadingTimeEntries ? 'Loading time entries...' :
                         'Preparing timesheet data...'}
                    </Typography>
                </Box>
            </Container>
        );
    }

    // Add error display for any loading errors
    if (projectsError) {
        return (
            <Container maxWidth="xl">
                <Alert 
                    severity="error" 
                    sx={{ 
                        mt: 2,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'start'
                    }}
                >
                    <Typography variant="subtitle1" gutterBottom>
                        Failed to load projects. Please try:
                    </Typography>
                    <Box component="ul" sx={{ mt: 1, mb: 1 }}>
                        <li>Refreshing the page</li>
                        <li>Checking your internet connection</li>
                        <li>Contacting support if the problem persists</li>
                    </Box>
                    {projectsError instanceof Error && (
                        <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
                            Error details: {projectsError.message}
                        </Typography>
                    )}
                </Alert>
            </Container>
        );
    }

    const { totalHours, totalCost } = calculateTotalHoursAndCost(filteredTimeEntries);

    // Update project finding in the table cells
    const findProject = (projectId: number): ProjectWithTeam | undefined => {
        return projects?.find((p: ProjectWithTeam) => p.id === projectId);
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

                {/* Add Time Summary Cards */}
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    Today's Hours
                                </Typography>
                                <Typography variant="h3">
                                    {dailyHours.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {format(new Date(), 'EEEE, MMMM d, yyyy')}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    Weekly Hours
                                </Typography>
                                <Typography variant="h3">
                                    {weeklyHours.toFixed(2)}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Current Week
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    My Monthly Hours
                                </Typography>
                                <Typography variant="h3">
                                    {monthlyStats?.workedHours.toFixed(2) || '0.00'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    {format(new Date(), 'MMMM yyyy')}
                                </Typography>
                                {user?.is_superuser || user?.role === UserRole.MANAGER ? (
                                    <Typography variant="caption" color="textSecondary" display="block">
                                        Showing your personal hours only
                                    </Typography>
                                ) : null}
                            </CardContent>
                        </Card>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" color="textSecondary" gutterBottom>
                                    Monthly Quota Remaining
                                </Typography>
                                <Typography variant="h3" color={monthlyStats?.remainingHours && monthlyStats.remainingHours < 0 ? 'error' : 'inherit'}>
                                    {monthlyStats?.remainingHours?.toFixed(2) || 'N/A'}
                                </Typography>
                                <Typography variant="body2" color="textSecondary">
                                    Quota: {monthlyStats?.totalQuota || 'Not Set'} hours
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>

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
                                            setSelectedTask(null);
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
                                            <DatePicker
                                                label="Date"
                                                value={selectedDate}
                                                onChange={(newValue) => setSelectedDate(newValue)}
                                                sx={{ width: '100%' }}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <TimePicker
                                                label="Start Time"
                                                value={startTime}
                                                onChange={(newValue) => setStartTime(newValue)}
                                                sx={{ width: '100%' }}
                                            />
                                        </LocalizationProvider>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                                            <TimePicker
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
                                            disabled={!selectedProject || !selectedTask || !selectedDate || !startTime || !endTime}
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
                            {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                <TableCell>Cost</TableCell>
                            )}
                            <TableCell>Status</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {!filteredTimeEntries?.length ? (
                            <TableRow>
                                <TableCell 
                                    colSpan={
                                        (user?.is_superuser || user?.role === UserRole.MANAGER) 
                                            ? 10 
                                            : 8
                                    }
                                    align="center"
                                >
                                    <Box sx={{ py: 3 }}>
                                        <Typography variant="subtitle1" color="textSecondary">
                                            No time entries found
                                        </Typography>
                                        <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                                            Create a new time entry using the form above
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredTimeEntries.map((entry: TimeEntry) => (
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
                                    <TableCell>{entry.description || '-'}</TableCell>
                                    <TableCell>
                                        {format(parseISO(entry.start_time), 'yyyy-MM-dd HH:mm')}
                                    </TableCell>
                                    <TableCell>
                                        {entry.end_time && format(parseISO(entry.end_time), 'yyyy-MM-dd HH:mm')}
                                    </TableCell>
                                    <TableCell>{calculateDuration(entry)}</TableCell>
                                    {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                                        <TableCell>${calculateCost(entry)}</TableCell>
                                    )}
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
                                                    <IconButton 
                                                        onClick={() => handleDeleteTimeEntry(entry.id)}
                                                        size="small"
                                                        color="error"
                                                    >
                                                        <Delete />
                                                    </IconButton>
                                                    <IconButton
                                                        onClick={() => handleSubmitTimeEntry(entry.id)}
                                                        size="small"
                                                        color="primary"
                                                    >
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
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Add loading overlay */}
            {(isLoadingTimeEntries || isLoadingProjects || isLoadingTasks) && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        zIndex: 1,
                    }}
                >
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={40} />
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            Updating timesheet...
                        </Typography>
                    </Box>
                </Box>
            )}

            <Box sx={{ mt: 3, mb: 2 }}>
                <Paper sx={{ p: 2 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography variant="h6">
                                Total Hours: {totalHours.toFixed(2)}
                            </Typography>
                        </Grid>
                        {(user?.is_superuser || user?.role === UserRole.MANAGER) && (
                            <Grid item xs={12} md={6}>
                                <Typography variant="h6">
                                    Total Cost: ${totalCost.toFixed(2)}
                                </Typography>
                            </Grid>
                        )}
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
                                <DatePicker
                                    label="Date"
                                    value={editData.start_time ? parseISO(editData.start_time) : null}
                                    onChange={(newDate) => {
                                        if (newDate) {
                                            try {
                                                const currentStart = editData.start_time ? parseISO(editData.start_time) : new Date();
                                                const currentEnd = editData.end_time ? parseISO(editData.end_time) : new Date();
                                                
                                                // Create new dates preserving the time
                                                const newStart = new Date(
                                                    newDate.getFullYear(),
                                                    newDate.getMonth(),
                                                    newDate.getDate(),
                                                    currentStart.getHours(),
                                                    currentStart.getMinutes()
                                                );
                                                
                                                const newEnd = new Date(
                                                    newDate.getFullYear(),
                                                    newDate.getMonth(),
                                                    newDate.getDate(),
                                                    currentEnd.getHours(),
                                                    currentEnd.getMinutes()
                                                );
                                                
                                                setEditData({
                                                    ...editData,
                                                    start_time: newStart.toISOString(),
                                                    end_time: newEnd.toISOString()
                                                });
                                            } catch (error) {
                                                console.error('Error updating date:', error);
                                                enqueueSnackbar('Error updating date', { variant: 'error' });
                                            }
                                        }
                                    }}
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <TimePicker
                                    label="Start Time"
                                    value={editData.start_time ? parseISO(editData.start_time) : null}
                                    onChange={(newTime) => {
                                        if (newTime) {
                                            try {
                                                const currentDate = editData.start_time ? parseISO(editData.start_time) : new Date();
                                                const newDateTime = new Date(
                                                    currentDate.getFullYear(),
                                                    currentDate.getMonth(),
                                                    currentDate.getDate(),
                                                    newTime.getHours(),
                                                    newTime.getMinutes()
                                                );
                                                setEditData({
                                                    ...editData,
                                                    start_time: newDateTime.toISOString()
                                                });
                                            } catch (error) {
                                                console.error('Error updating start time:', error);
                                                enqueueSnackbar('Error updating start time', { variant: 'error' });
                                            }
                                        }
                                    }}
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <TimePicker
                                    label="End Time"
                                    value={editData.end_time ? parseISO(editData.end_time) : null}
                                    onChange={(newTime) => {
                                        if (newTime) {
                                            try {
                                                const currentDate = editData.end_time ? parseISO(editData.end_time) : new Date();
                                                const newDateTime = new Date(
                                                    currentDate.getFullYear(),
                                                    currentDate.getMonth(),
                                                    currentDate.getDate(),
                                                    newTime.getHours(),
                                                    newTime.getMinutes()
                                                );
                                                
                                                // Validate that end time is after start time
                                                if (editData.start_time && newDateTime <= parseISO(editData.start_time)) {
                                                    enqueueSnackbar('End time must be after start time', { variant: 'error' });
                                                    return;
                                                }
                                                
                                                setEditData({
                                                    ...editData,
                                                    end_time: newDateTime.toISOString()
                                                });
                                            } catch (error) {
                                                console.error('Error updating end time:', error);
                                                enqueueSnackbar('Error updating end time', { variant: 'error' });
                                            }
                                        }
                                    }}
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                    <Button 
                        onClick={handleUpdateTimeEntry} 
                        variant="contained" 
                        color="primary"
                        disabled={!editData.description || !editData.start_time || !editData.end_time}
                    >
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
                onReject={handleRejectTimeEntry}
            />
        </Container>
    );
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