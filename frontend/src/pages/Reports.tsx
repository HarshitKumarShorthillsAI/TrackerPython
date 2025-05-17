import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    Grid,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Alert,
    CircularProgress,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import { format, parseISO, startOfDay } from 'date-fns';
import { Download } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { TimeEntry, Task, ProjectWithTeam, UserRole, User, TimeEntryStatus } from '../types/index';

export const Reports = () => {
    const [selectedUser, setSelectedUser] = useState<number | ''>('');
    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [selectedTask, setSelectedTask] = useState<number | ''>('');
    const [selectedStatus, setSelectedStatus] = useState<TimeEntryStatus | ''>('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const { user, isManager } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Fetch data
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: api.getUsers,
        enabled: isManager()
    });

    // Query for projects with team members
    const { data: projects, isLoading: isLoadingProjects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            // Get all projects first
            const projectsList = await api.getProjects();
            
            // Then fetch full details for each project
            const projectsWithTeam = await Promise.all(
                projectsList.map(project => api.getProject(project.id))
            );
            
            return projectsWithTeam;
        }
    });

    const { data: tasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: api.getTasks
    });

    // Query for time entries with task and status filtering
    const { data: timeEntries, isLoading } = useQuery({
        queryKey: ['timeEntries', selectedUser, selectedProject, selectedTask, selectedStatus, startDate, endDate],
        queryFn: () => api.getTimeEntries(
            selectedUser ? Number(selectedUser) : user?.id,
            selectedProject ? Number(selectedProject) : undefined,
            selectedTask ? Number(selectedTask) : undefined,
            startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
            endDate ? format(endDate, 'yyyy-MM-dd') : undefined
        ),
        enabled: !!(startDate && endDate), // Only fetch when dates are selected
        select: (data) => {
            if (!data) return [];
            
            return data.filter((entry: TimeEntry) => {
                // Filter by date
                if (startDate && endDate) {
                    const entryStartDate = startOfDay(parseISO(entry.start_time));
                    const filterStartDate = startOfDay(startDate);
                    const filterEndDate = startOfDay(endDate);
                    if (!(entryStartDate >= filterStartDate && entryStartDate <= filterEndDate)) {
                        return false;
                    }
                }

                // Filter by status
                if (selectedStatus && entry.status !== selectedStatus) {
                    return false;
                }

                return true;
            });
        }
    });

    // Filter projects based on user role and team membership
    const availableProjects = React.useMemo(() => {
        if (!projects || !user || isLoadingProjects) return [];

        // Superusers and managers can see all projects
        if (user.is_superuser || user.role === UserRole.MANAGER) {
            return projects;
        }

        // Regular users can only see projects where they are team members
        return projects.filter((project: ProjectWithTeam) => {
            // Check if team_members exists and is an array before using some()
            return Array.isArray(project.team_members) && 
                project.team_members.some((member: User) => member.id === user.id);
        });
    }, [projects, user, isLoadingProjects]);

    // Get available tasks based on selected project
    const availableTasks = React.useMemo(() => {
        if (!tasks || !selectedProject) return [];
        
        return tasks.filter(task => task.project_id === selectedProject);
    }, [tasks, selectedProject]);

    // Calculate summary statistics
    const calculateSummary = () => {
        if (!timeEntries) return { totalHours: 0, totalProjects: 0, totalTasks: 0 };

        const uniqueProjects = new Set(timeEntries.map((entry: TimeEntry) => entry.project_id));
        const uniqueTasks = new Set(timeEntries.map((entry: TimeEntry) => entry.task_id));
        
        const totalHours = timeEntries.reduce((sum: number, entry: TimeEntry) => {
            if (entry.end_time) {
                const start = new Date(entry.start_time);
                const end = new Date(entry.end_time);
                const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                return sum + hours;
            }
            return sum;
        }, 0);

        return {
            totalHours: Math.round(totalHours * 100) / 100,
            totalProjects: uniqueProjects.size,
            totalTasks: uniqueTasks.size
        };
    };

    const handleGenerateReport = async () => {
        if (!startDate || !endDate) {
            enqueueSnackbar('Please select both start and end dates', { variant: 'error' });
            return;
        }

        try {
            const response = await api.generateReport({
                user_id: selectedUser ? Number(selectedUser) : user?.id,
                project_id: selectedProject ? Number(selectedProject) : undefined,
                task_id: selectedTask ? Number(selectedTask) : undefined,
                status: selectedStatus || undefined,
                start_date: format(startDate, 'yyyy-MM-dd'),
                end_date: format(endDate, 'yyyy-MM-dd')
            });

            // Create a blob from the PDF data and download it
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `timesheet-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            enqueueSnackbar('Report generated successfully', { variant: 'success' });
        } catch (error: any) {
            console.error('Error generating report:', error);
            let errorMessage = 'Failed to generate report';
            
            // Try to extract error message from response
            if (error.response?.data) {
                if (error.response.data instanceof Blob) {
                    try {
                        const text = await error.response.data.text();
                        const errorData = JSON.parse(text);
                        errorMessage = errorData.detail || errorData.message || errorMessage;
                    } catch (e) {
                        console.error('Error parsing error response:', e);
                    }
                } else {
                    errorMessage = error.response.data.detail || error.response.data.message || errorMessage;
                }
            }
            
            enqueueSnackbar(errorMessage, { variant: 'error' });
        }
    };

    const summary = calculateSummary();

    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Time Entry Reports
            </Typography>

            <Card sx={{ mb: 4 }}>
                <CardContent>
                    <Grid container spacing={3}>
                        {isManager() && (
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth>
                                    <InputLabel>Employee</InputLabel>
                                    <Select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value as number)}
                                        label="Employee"
                                    >
                                        <MenuItem value="">All Employees</MenuItem>
                                        {users?.map((user) => (
                                            <MenuItem key={user.id} value={user.id}>
                                                {user.full_name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Project</InputLabel>
                                <Select
                                    value={selectedProject}
                                    onChange={(e) => {
                                        setSelectedProject(e.target.value as number);
                                        setSelectedTask(''); // Reset task when project changes
                                    }}
                                    label="Project"
                                >
                                    <MenuItem value="">All Projects</MenuItem>
                                    {availableProjects.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Task</InputLabel>
                                <Select
                                    value={selectedTask}
                                    onChange={(e) => setSelectedTask(e.target.value as number)}
                                    label="Task"
                                    disabled={!selectedProject}
                                >
                                    <MenuItem value="">All Tasks</MenuItem>
                                    {availableTasks.map((task) => (
                                        <MenuItem key={task.id} value={task.id}>
                                            {task.title}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    value={selectedStatus}
                                    onChange={(e) => setSelectedStatus(e.target.value as TimeEntryStatus)}
                                    label="Status"
                                >
                                    <MenuItem value="">All Statuses</MenuItem>
                                    <MenuItem value={TimeEntryStatus.DRAFT}>Draft</MenuItem>
                                    <MenuItem value={TimeEntryStatus.SUBMITTED}>Submitted</MenuItem>
                                    <MenuItem value={TimeEntryStatus.APPROVED}>Approved</MenuItem>
                                    <MenuItem value={TimeEntryStatus.REJECTED}>Rejected</MenuItem>
                                    <MenuItem value={TimeEntryStatus.BILLED}>Billed</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="Start Date"
                                    value={startDate}
                                    onChange={(date) => setStartDate(date)}
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <LocalizationProvider dateAdapter={AdapterDateFns}>
                                <DatePicker
                                    label="End Date"
                                    value={endDate}
                                    onChange={(date) => setEndDate(date)}
                                    sx={{ width: '100%' }}
                                />
                            </LocalizationProvider>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {!startDate || !endDate ? (
                <Alert severity="info" sx={{ mb: 4 }}>
                    Please select both start and end dates to view the report
                </Alert>
            ) : (
                <>
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Total Hours</Typography>
                                    <Typography variant="h4">{summary.totalHours}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Projects Worked On</Typography>
                                    <Typography variant="h4">{summary.totalProjects}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>Total Tasks</Typography>
                                    <Typography variant="h4">{summary.totalTasks}</Typography>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="h5">Time Entries</Typography>
                        <Button
                            variant="contained"
                            startIcon={<Download />}
                            onClick={handleGenerateReport}
                            disabled={!startDate || !endDate}
                        >
                            Download Report
                        </Button>
                    </Box>

                    {isLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                            <CircularProgress />
                        </Box>
                    ) : timeEntries?.length === 0 ? (
                        <Alert severity="info">No time entries found for the selected criteria</Alert>
                    ) : (
                        <TableContainer component={Paper}>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Project</TableCell>
                                        <TableCell>Task</TableCell>
                                        <TableCell>Description</TableCell>
                                        <TableCell>Hours</TableCell>
                                        <TableCell>Status</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {timeEntries?.map((entry: TimeEntry) => {
                                        const project = availableProjects?.find(p => p.id === entry.project_id);
                                        const task = tasks?.find(t => t.id === entry.task_id);
                                        
                                        const hours = entry.end_time
                                            ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
                                            : 0;

                                        return (
                                            <TableRow key={entry.id}>
                                                <TableCell>
                                                    {format(parseISO(entry.start_time), 'MMM dd, yyyy')}
                                                </TableCell>
                                                <TableCell>{project?.name || 'Unknown Project'}</TableCell>
                                                <TableCell>{task?.title || 'Unknown Task'}</TableCell>
                                                <TableCell>{entry.description || '-'}</TableCell>
                                                <TableCell>{Math.round(hours * 100) / 100}</TableCell>
                                                <TableCell>{entry.status}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </>
            )}
        </Box>
    );
};