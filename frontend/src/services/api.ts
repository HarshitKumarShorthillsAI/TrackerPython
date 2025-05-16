import axios from 'axios';
import { LoginRequest, LoginResponse, Project, Task, TimeEntry, User } from '../types';

const API_URL = 'http://localhost:8010/api/v1';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    // Add trailing slash to URLs that don't have one
    if (!config.url?.endsWith('/')) {
        config.url = `${config.url}/`;
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

export const getProject = async (id: number): Promise<Project> => {
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
export const getTimeEntries = async (status?: string): Promise<TimeEntry[]> => {
    const params = status ? { status } : {};
    const response = await api.get('/time-entries', { params });
    return response.data;
};

export const createTimeEntry = async (data: Partial<TimeEntry>): Promise<TimeEntry> => {
    const response = await api.post('/time-entries', data);
    return response.data;
};

export const updateTimeEntry = async (id: number, data: Partial<TimeEntry>): Promise<TimeEntry> => {
    const response = await api.put(`/time-entries/${id}`, data);
    return response.data;
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

export const rejectTimeEntry = async (id: number, reason: string): Promise<TimeEntry> => {
    const response = await api.put(`/time-entries/${id}/reject`, { rejection_reason: reason });
    return response.data;
};

export const markTimeEntryBilled = async (id: number): Promise<TimeEntry> => {
    const response = await api.put(`/time-entries/${id}/mark-billed`);
    return response.data;
}; 