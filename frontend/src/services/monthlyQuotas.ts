import { api } from './api';

export interface MonthlyQuota {
  id: number;
  month: string;  // YYYY-MM format
  working_days: number;
  daily_hours: number;
  monthly_hours: number;
  created_at: string;
  updated_at: string;
}

export interface MonthlyQuotaCreate {
  month: string;
  working_days: number;
  daily_hours: number;
  monthly_hours: number;
}

export const monthlyQuotasApi = {
  getAll: async (year: number) => {
    if (!year || isNaN(year)) {
      throw new Error('Invalid year parameter');
    }
    const response = await api.get<MonthlyQuota[]>('/monthly-quotas', {
      params: { year }
    });
    return response.data;
  },

  getByMonth: async (month: string) => {
    const response = await api.get<MonthlyQuota>(`/monthly-quotas/${month}`);
    return response.data;
  },

  create: async (data: MonthlyQuotaCreate) => {
    const response = await api.post<MonthlyQuota>('/monthly-quotas/', data);
    return response.data;
  },

  update: async (month: string, data: Partial<MonthlyQuotaCreate>) => {
    const response = await api.put<MonthlyQuota>(`/monthly-quotas/${month}`, data);
    return response.data;
  },

  delete: async (month: string) => {
    await api.delete(`/monthly-quotas/${month}`);
  }
}; 