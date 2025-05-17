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
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useQuery } from '@tanstack/react-query';
import * as api from '../services/api';
import { format } from 'date-fns';
import { Download } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export const Reports = () => {
    const [selectedUser, setSelectedUser] = useState<number | ''>('');
    const [selectedProject, setSelectedProject] = useState<number | ''>('');
    const [startDate, setStartDate] = useState<Date | null>(null);
    const [endDate, setEndDate] = useState<Date | null>(null);
    const { user, isManager } = useAuth();

    // Fetch data
    const { data: users } = useQuery({
        queryKey: ['users'],
        queryFn: api.getUsers,
        enabled: isManager()
    });

    const { data: projects } = useQuery({
        queryKey: ['projects'],
        queryFn: api.getProjects
    });

    const { data: timeEntries } = useQuery({
        queryKey: ['timeEntries', selectedUser, selectedProject, startDate, endDate],
        queryFn: () => api.getTimeEntries(
            selectedUser ? Number(selectedUser) : undefined,
            selectedProject ? Number(selectedProject) : undefined,
            startDate?.toISOString(),
            endDate?.toISOString()
        )
    });

    // Calculate summary statistics
    const calculateSummary = () => {
        if (!timeEntries) return { totalHours: 0, totalProjects: 0, totalTasks: 0 };

        const uniqueProjects = new Set(timeEntries.map(entry => entry.project_id));
        const uniqueTasks = new Set(timeEntries.map(entry => entry.task_id));
        const totalHours = timeEntries.reduce((sum, entry) => {
            if (!entry.end_time) return sum;
            const start = new Date(entry.start_time);
            const end = new Date(entry.end_time);
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            return sum + hours;
        }, 0);

        return {
            totalHours: Math.round(totalHours * 100) / 100,
            totalProjects: uniqueProjects.size,
            totalTasks: uniqueTasks.size
        };
    };

    const handleGenerateReport = async () => {
        if (!timeEntries || !startDate || !endDate) return;

        try {
            const response = await api.generateReport({
                user_id: selectedUser ? Number(selectedUser) : user?.id,
                project_id: selectedProject ? Number(selectedProject) : undefined,
                start_date: startDate.toISOString(),
                end_date: endDate.toISOString()
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
            window.URL.revokeObjectURL(url); // Clean up the URL object
        } catch (error: any) {
            console.error('Error generating report:', error);
            let errorMessage = 'An error occurred while generating the report.';
            
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                if (error.response.status === 403) {
                    errorMessage = 'You do not have permission to generate this report.';
                } else if (error.response.status === 404) {
                    errorMessage = 'No data found for the selected criteria.';
                } else if (error.response.data && typeof error.response.data === 'string') {
                    errorMessage = error.response.data;
                }
            } else if (error.request) {
                // The request was made but no response was received
                errorMessage = 'Unable to connect to the server. Please check your internet connection.';
            }
            
            // Show error using your preferred notification system
            // For now, we'll use console.error
            console.error(errorMessage);
            // TODO: Add proper error notification UI component
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
                                    <InputLabel>User</InputLabel>
                                    <Select
                                        value={selectedUser}
                                        onChange={(e) => setSelectedUser(e.target.value as number)}
                                        label="User"
                                    >
                                        <MenuItem value="">All Users</MenuItem>
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
                                    onChange={(e) => setSelectedProject(e.target.value as number)}
                                    label="Project"
                                >
                                    <MenuItem value="">All Projects</MenuItem>
                                    {projects?.map((project) => (
                                        <MenuItem key={project.id} value={project.id}>
                                            {project.name}
                                        </MenuItem>
                                    ))}
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

            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                    variant="contained"
                    startIcon={<Download />}
                    onClick={handleGenerateReport}
                    disabled={!startDate || !endDate}
                >
                    Download Report
                </Button>
            </Box>

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
                        {timeEntries?.map((entry) => {
                            const project = projects?.find(p => p.id === entry.project_id);
                            const hours = entry.end_time
                                ? (new Date(entry.end_time).getTime() - new Date(entry.start_time).getTime()) / (1000 * 60 * 60)
                                : 0;

                            return (
                                <TableRow key={entry.id}>
                                    <TableCell>
                                        {format(new Date(entry.start_time), 'MMM dd, yyyy')}
                                    </TableCell>
                                    <TableCell>{project?.name}</TableCell>
                                    <TableCell>{entry.task?.title}</TableCell>
                                    <TableCell>{entry.description}</TableCell>
                                    <TableCell>{Math.round(hours * 100) / 100}</TableCell>
                                    <TableCell>{entry.status}</TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}; 