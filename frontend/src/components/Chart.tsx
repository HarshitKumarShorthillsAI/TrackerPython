import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Typography,
    CircularProgress,
} from '@mui/material';
import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
} from 'chart.js';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import { 
    format, 
    subDays, 
    subMonths, 
    startOfDay, 
    endOfDay, 
    differenceInHours, 
    parseISO,
    startOfMonth,
    endOfMonth,
    subMonths as dateFnsSubMonths
} from 'date-fns';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale);

interface TimeEntry {
    id: number;
    project_id: number;
    task_id: number;
    user_id: number;
    start_time: string;
    end_time: string;
    duration: number;
}

interface Project {
    id: number;
    name: string;
    team_members?: { id: number }[];
}

interface Task {
    id: number;
    title: string;
    project_id: number;
    assigned_to_id?: number;
}

interface User {
    id: number;
    full_name: string;
}

type TimeInterval = 'day' | 'week' | 'month' | 'all';
type DistributionType = 'project' | 'task';

export const Chart = () => {
    const { user, isManager } = useAuth();
    const [selectedUser, setSelectedUser] = useState<number | ''>('');
    const [selectedInterval, setSelectedInterval] = useState<TimeInterval>('week');
    const [distributionType, setDistributionType] = useState<DistributionType>('project');

    // Fetch projects
    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: async () => {
            const projectsList = await api.getProjects();
            const projectsWithTeam = await Promise.all(
                projectsList.map(project => api.getProject(project.id))
            );
            return projectsWithTeam;
        },
        enabled: true
    });

    // Fetch tasks
    const { data: tasks } = useQuery({
        queryKey: ['tasks'],
        queryFn: () => api.getTasks(),
        enabled: true
    });

    // Fetch users for admin/manager
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: () => api.getUsers(),
        enabled: isManager()
    });

    // Get date range based on selected interval
    const getDateRange = () => {
        const now = new Date();
        let startDate: Date | undefined;
        let endDate: Date | undefined;

        switch (selectedInterval) {
            case 'day':
                startDate = startOfDay(now);
                endDate = endOfDay(now);
                break;
            case 'week':
                startDate = subDays(now, 7);
                endDate = now;
                break;
            case 'month':
                // Get the previous month's start and end dates
                const previousMonth = dateFnsSubMonths(now, 1);
                startDate = startOfMonth(previousMonth);
                endDate = endOfMonth(previousMonth);
                break;
            case 'all':
                startDate = undefined;
                endDate = undefined;
                break;
        }

        return { startDate, endDate };
    };

    // Fetch time entries
    const { data: timeEntries, isLoading: isLoadingEntries } = useQuery({
        queryKey: ['timeEntries', selectedUser, selectedInterval],
        queryFn: async () => {
            const { startDate, endDate } = getDateRange();

            return api.getTimeEntries(
                selectedUser ? Number(selectedUser) : user?.id,
                undefined,
                undefined,
                startDate ? format(startDate, 'yyyy-MM-dd') : undefined,
                endDate ? format(endDate, 'yyyy-MM-dd') : undefined
            );
        },
        enabled: true
    });

    // Calculate duration for each time entry
    const calculateDuration = (entry: TimeEntry) => {
        if (entry.duration) {
            return entry.duration;
        }
        const start = parseISO(entry.start_time);
        const end = parseISO(entry.end_time);
        return differenceInHours(end, start);
    };

    // Get projects and tasks for the selected user
    const getUserProjectsAndTasks = () => {
        if (!projects || !tasks || !timeEntries) return { userProjects: [], userTasks: [] };

        // Get unique project IDs from time entries
        const projectIds = new Set(timeEntries.map(entry => entry.project_id));
        const taskIds = new Set(timeEntries.map(entry => entry.task_id));

        // Filter projects to only include those where the user is a team member
        const userProjects = projects.filter(project => 
            projectIds.has(project.id) && 
            project.team_members?.some(member => member.id === (selectedUser ? Number(selectedUser) : user?.id))
        );

        // Filter tasks to only include those assigned to the user
        const userTasks = tasks.filter(task => 
            taskIds.has(task.id) && 
            (!task.assigned_to_id || task.assigned_to_id === (selectedUser ? Number(selectedUser) : user?.id))
        );

        return { userProjects, userTasks };
    };

    // Prepare chart data
    const prepareChartData = () => {
        if (!timeEntries || !projects || !tasks) return null;

        const { userProjects, userTasks } = getUserProjectsAndTasks();
        const dataMap = new Map<string, number>();

        // Filter time entries based on selected interval
        const { startDate, endDate } = getDateRange();

        const filteredEntries = timeEntries.filter(entry => {
            if (!startDate || !endDate) return true; // For 'all' interval
            const entryStart = parseISO(entry.start_time);
            return entryStart >= startDate && entryStart <= endDate;
        });

        filteredEntries.forEach((entry: TimeEntry) => {
            const project = userProjects.find((p: Project) => p.id === entry.project_id);
            const task = userTasks.find((t: Task) => t.id === entry.task_id);
            
            if (project && task) {
                const key = distributionType === 'project' ? project.name : task.title;
                const duration = calculateDuration(entry);
                dataMap.set(key, (dataMap.get(key) || 0) + duration);
            }
        });

        // Sort data by duration (descending)
        const sortedEntries = Array.from(dataMap.entries()).sort((a, b) => b[1] - a[1]);
        
        const labels = sortedEntries.map(([key]) => key);
        const data = sortedEntries.map(([_, value]) => value);

        return {
            labels,
            datasets: [
                {
                    data,
                    backgroundColor: [
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                        '#9966FF',
                        '#FF9F40',
                        '#FF6384',
                        '#36A2EB',
                        '#FFCE56',
                        '#4BC0C0',
                    ],
                    borderWidth: 1,
                },
            ],
        };
    };

    const chartData = prepareChartData();

    // Get interval display text
    const getIntervalDisplayText = () => {
        switch (selectedInterval) {
            case 'day':
                return 'Today';
            case 'week':
                return 'Last Week';
            case 'month':
                const previousMonth = dateFnsSubMonths(new Date(), 1);
                return `Last Month (${format(previousMonth, 'MMMM yyyy')})`;
            default:
                return 'All Time';
        }
    };

    return (
        <Box>
            <Card sx={{ mb: 3 }}>
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
                                        {users?.map((user: User) => (
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
                                <InputLabel>Time Interval</InputLabel>
                                <Select
                                    value={selectedInterval}
                                    onChange={(e) => setSelectedInterval(e.target.value as TimeInterval)}
                                    label="Time Interval"
                                >
                                    <MenuItem value="day">Today</MenuItem>
                                    <MenuItem value="week">Last Week</MenuItem>
                                    <MenuItem value="month">Last Month</MenuItem>
                                    <MenuItem value="all">All Time</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Distribution Type</InputLabel>
                                <Select
                                    value={distributionType}
                                    onChange={(e) => setDistributionType(e.target.value as DistributionType)}
                                    label="Distribution Type"
                                >
                                    <MenuItem value="project">By Project</MenuItem>
                                    <MenuItem value="task">By Task</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Work Distribution {distributionType === 'project' ? 'by Project' : 'by Task'}
                        {selectedUser && users ? ` - ${users.find(u => u.id === selectedUser)?.full_name}` : ''}
                        {selectedInterval !== 'all' && ` (${getIntervalDisplayText()})`}
                    </Typography>
                    {isLoadingEntries ? (
                        <Box display="flex" justifyContent="center" p={3}>
                            <CircularProgress />
                        </Box>
                    ) : chartData ? (
                        <Box height={400}>
                            <Pie
                                data={chartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: {
                                            position: 'right',
                                        },
                                        tooltip: {
                                            callbacks: {
                                                label: (context) => {
                                                    const label = context.label || '';
                                                    const value = context.raw as number;
                                                    const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                                                    const percentage = ((value / total) * 100).toFixed(1);
                                                    return `${label}: ${value.toFixed(2)} hours (${percentage}%)`;
                                                },
                                            },
                                        },
                                    },
                                }}
                            />
                        </Box>
                    ) : (
                        <Typography variant="body1" align="center">
                            No data available for the selected criteria
                        </Typography>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}; 