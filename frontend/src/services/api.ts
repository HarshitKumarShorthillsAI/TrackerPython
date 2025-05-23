import axios from 'axios';
import { LoginRequest, LoginResponse, Project, ProjectWithTeam, Task, TimeEntry, User, UserRole, TimeEntryStatus } from '../types/index';

const API_URL = 'http://localhost:8010/api/v1';

export const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    if (config.url) {
        config.url = config.url.replace(/\/+$/, '');
    }
    
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth
export const login = async (email: string, password: string): Promise<LoginResponse> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await api.post('/login/access-token', formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
    });
    return response.data;
};

// Users
export const getCurrentUser = async (): Promise<User> => {
    const response = await api.get('/users/me');
    return response.data;
};

export const getUsers = async (): Promise<User[]> => {
    const response = await api.get('/users');
    return response.data;
};

export const getEmployees = async (): Promise<User[]> => {
    const response = await api.get('/users/employees');
    return response.data;
};

export const createUser = async (data: Partial<User>): Promise<User> => {
    const response = await api.post('/users', data);
    return response.data;
};

export const updateUser = async (id: number, data: Partial<User>): Promise<User> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
};

export const deleteUser = async (id: number): Promise<void> => {
    await api.delete(`/users/${id}`);
};

// Projects
export const getProjects = async (): Promise<Project[]> => {
    const response = await api.get('/projects');
    return response.data;
};

export const getProject = async (id: number): Promise<ProjectWithTeam> => {
    const response = await api.get(`/projects/${id}`);
    return response.data;
};

export const createProject = async (data: Partial<Project>): Promise<Project> => {
    const response = await api.post('/projects', data);
    return response.data;
};

export const updateProject = async (id: number, data: Partial<Project>): Promise<Project> => {
    const response = await api.put(`/projects/${id}`, data);
    return response.data;
};

export const deleteProject = async (id: number): Promise<void> => {
    await api.delete(`/projects/${id}`);
};

// Tasks
export const getTasks = async (): Promise<Task[]> => {
    const response = await api.get('/tasks');
    return response.data;
};

export const createTask = async (data: Partial<Task>): Promise<Task> => {
    const response = await api.post('/tasks', data);
    return response.data;
};

export const updateTask = async (id: number, data: Partial<Task>): Promise<Task> => {
    const response = await api.put(`/tasks/${id}`, data);
    return response.data;
};

export const deleteTask = async (id: number): Promise<void> => {
    await api.delete(`/tasks/${id}`);
};

// Time Entries
export const getTimeEntries = async (
    user_id?: number,
    project_id?: number,
    task_id?: number,
    start_date?: string,
    end_date?: string
) => {
    try {
        let url = '/time-entries';
        const params = new URLSearchParams();
        
        if (user_id) params.append('user_id', user_id.toString());
        if (project_id) params.append('project_id', project_id.toString());
        if (task_id) params.append('task_id', task_id.toString());
        if (start_date) params.append('start_date', start_date);
        if (end_date) params.append('end_date', end_date);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const response = await api.get(url);
        return response.data;
    } catch (error: any) {
        console.error('Error fetching time entries:', error);
        throw new Error(error.response?.data?.detail || 'Failed to fetch time entries');
    }
};

export const createTimeEntry = async (data: Partial<TimeEntry>): Promise<TimeEntry> => {
    const response = await api.post('/time-entries', data);
    return response.data;
};

export const updateTimeEntry = async (id: number, data: Partial<TimeEntry>): Promise<TimeEntry> => {
    try {
        const response = await api.put(`/time-entries/${id}`, data);
        return response.data;
    } catch (error: any) {
        console.error('Error updating time entry:', error);
        const errorMessage = error.response?.data?.detail 
            || error.response?.data?.message 
            || error.message 
            || 'Failed to update time entry';
        throw new Error(errorMessage);
    }
};

export const deleteTimeEntry = async (id: number): Promise<void> => {
    await api.delete(`/time-entries/${id}`);
};

export const submitTimeEntry = async (id: number): Promise<TimeEntry> => {
    const response = await api.post(`/time-entries/${id}/submit`);
    return response.data;
};

export const approveTimeEntry = async (id: number): Promise<TimeEntry> => {
    const response = await api.post(`/time-entries/${id}/approve`);
    return response.data;
};

export const rejectTimeEntry = async (id: number, rejection_reason: string): Promise<TimeEntry> => {
    const response = await api.post(`/time-entries/${id}/reject?rejection_reason=${encodeURIComponent(rejection_reason)}`);
    return response.data;
};

export const markTimeEntryBilled = async (id: number): Promise<TimeEntry> => {
    const response = await api.post(`/time-entries/${id}/mark-billed`);
    return response.data;
};

export interface ReportParams {
    user_id?: number;
    project_id?: number;
    task_id?: number;
    status?: TimeEntryStatus;
    start_date: string;
    end_date: string;
}

export const generateReport = async (params: ReportParams) => {
    try {
        console.log('Making API request with params:', params);
        const response = await api.post('/reports/generate', params, {
            responseType: 'blob',
            headers: {
                'Accept': 'application/pdf',
                'Content-Type': 'application/json'
            }
        });

        // Check if the response is actually a PDF
        const contentType = response.headers['content-type'];
        console.log('Response content type:', contentType);
        
        if (!contentType || !contentType.includes('application/pdf')) {
            throw new Error(`Invalid response type: ${contentType}`);
        }

        return response;
    } catch (error: any) {
        console.error('Error in generateReport:', error);
        
        // If the error response is a blob, read it as text
        if (error.response?.data instanceof Blob) {
            const text = await error.response.data.text();
            try {
                const errorData = JSON.parse(text);
                throw new Error(errorData.detail || 'Failed to generate report');
            } catch (e) {
                console.error('Error parsing error response:', e);
                throw new Error('Failed to generate report: Server error');
            }
        }

        // Handle non-blob error responses
        const errorMessage = error.response?.data?.detail 
            || error.response?.data?.message 
            || error.message 
            || 'Failed to generate report';
            
        throw new Error(errorMessage);
    }
};

export interface SendReportEmailParams extends ReportParams {
    email_to: string;
    comment?: string;
}

export const sendReportEmail = async (params: SendReportEmailParams) => {
    try {
        const response = await api.post('/reports/send-email', params);
        return response.data;
    } catch (error: any) {
        const errorMessage = error.response?.data?.detail 
            || error.response?.data?.message 
            || error.message 
            || 'Failed to send report';
        throw new Error(errorMessage);
    }
};

export const forgotPassword = async (email: string): Promise<void> => {
    await api.post('/auth/forgot-password', { email });
};

export const resetPassword = async (token: string, new_password: string): Promise<void> => {
    await api.post('/auth/reset-password', { token, new_password });
}; 