export enum UserRole {
    EMPLOYEE = 'employee',
    MANAGER = 'manager',
    ADMIN = 'admin',
    CLIENT = 'client'
}

export enum TimeEntryStatus {
    DRAFT = 'DRAFT',
    SUBMITTED = 'SUBMITTED',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    BILLED = 'BILLED'
}

export enum ProjectStatus {
    PLANNED = 'planned',
    IN_PROGRESS = 'in_progress',
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
    team_members: number[];
}

export interface ProjectWithTeam extends Omit<Project, 'team_members'> {
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
    rejection_reason?: string;
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

interface UserFormData {
    email: string;
    username: string;
    full_name: string;
    password?: string;
    hourly_rate?: number;
    role: UserRole;
    is_active: boolean;
}

export interface ProjectCreate {
    name: string;
    description?: string;
    status: ProjectStatus;
    budget_hours: number;
    hourly_rate: number;
    manager_id?: number | null;
    team_members?: number[];
}

export interface ProjectUpdate {
    name?: string;
    description?: string;
    status?: ProjectStatus;
    budget_hours?: number;
    hourly_rate?: number;
    manager_id?: number | null;
    team_members?: number[];
} 