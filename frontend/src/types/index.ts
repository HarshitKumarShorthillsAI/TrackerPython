export enum UserRole {
    EMPLOYEE = 'employee',
    MANAGER = 'manager',
    ADMIN = 'admin',
    CLIENT = 'client'
}

export enum TimeEntryStatus {
    DRAFT = 'draft',
    SUBMITTED = 'submitted',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    BILLED = 'billed'
}

export enum ProjectStatus {
    PLANNED = 'planned',
    ACTIVE = 'active',
    ON_HOLD = 'on_hold',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled'
}

export enum TaskStatus {
    TODO = 'todo',
    IN_PROGRESS = 'in_progress',
    REVIEW = 'review',
    DONE = 'done'
}

export enum TaskPriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high'
}

export interface User {
    id: number;
    email: string;
    full_name: string;
    hourly_rate?: number;
    role: UserRole;
    is_active: boolean;
    is_superuser: boolean;
    created_at: string;
    updated_at: string;
}

export interface Project {
    id: number;
    name: string;
    description?: string;
    status: ProjectStatus;
    budget_hours: number;
    hourly_rate: number;
    created_at: string;
    updated_at: string;
    manager_id?: number;
    owner_id?: number;
    team_members: User[];
}

export interface Task {
    id: number;
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    estimated_hours: number;
    due_date?: string;
    created_at: string;
    updated_at: string;
    project_id: number;
    created_by_id?: number;
    assigned_to_id?: number;
    is_active: boolean;
}

export interface TaskCreate {
    title: string;
    description?: string;
    status: TaskStatus;
    priority: TaskPriority;
    estimated_hours: number;
    due_date?: string;
    project_id: number;
    assigned_to_id?: number;
    is_active: boolean;
}

export interface TimeEntry {
    id: number;
    task_id: number;
    user_id: number;
    project_id: number;
    description?: string;
    start_time: string;
    end_time?: string;
    hourly_rate: number;
    billable: boolean;
    status: TimeEntryStatus;
    created_at: string;
    updated_at: string;
    approved_by_id?: number;
}

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    access_token: string;
    token_type: string;
}

export interface TokenPayload {
    exp: number;
    sub: string;
} 