import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MonthlyQuotas } from '../pages/MonthlyQuotas';
import { AuthProvider } from '../contexts/AuthContext';
import { UserRole } from '../types';

// Mock the auth context
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      email: 'test@example.com',
      role: UserRole.MANAGER,
      is_superuser: true
    }
  })
}));

describe('MonthlyQuotas', () => {
  it('renders the monthly quotas page', async () => {
    render(
      <AuthProvider>
        <MonthlyQuotas />
      </AuthProvider>
    );

    // Check if the main elements are rendered
    expect(screen.getByText('Monthly Quotas')).toBeInTheDocument();
    expect(screen.getByLabelText('Year')).toBeInTheDocument();
    expect(screen.getByText('Add Quota')).toBeInTheDocument();

    // Wait for the table to be populated
    await waitFor(() => {
      expect(screen.getByText('2024-01')).toBeInTheDocument();
    });
  });

  it('opens the add quota dialog when clicking Add Quota button', async () => {
    render(
      <AuthProvider>
        <MonthlyQuotas />
      </AuthProvider>
    );

    // Click the Add Quota button
    fireEvent.click(screen.getByText('Add Quota'));

    // Check if the dialog is opened
    expect(screen.getByText('Add New Quota')).toBeInTheDocument();
    expect(screen.getByLabelText('Month')).toBeInTheDocument();
    expect(screen.getByLabelText('Working Days')).toBeInTheDocument();
    expect(screen.getByLabelText('Daily Hours')).toBeInTheDocument();
  });

  it('calculates monthly hours automatically', async () => {
    render(
      <AuthProvider>
        <MonthlyQuotas />
      </AuthProvider>
    );

    // Open the add dialog
    fireEvent.click(screen.getByText('Add Quota'));

    // Change working days and daily hours
    const workingDaysInput = screen.getByLabelText('Working Days');
    const dailyHoursInput = screen.getByLabelText('Daily Hours');
    
    fireEvent.change(workingDaysInput, { target: { value: '20' } });
    fireEvent.change(dailyHoursInput, { target: { value: '7' } });

    // Check if monthly hours is calculated correctly
    const monthlyHoursInput = screen.getByLabelText('Monthly Hours');
    expect(monthlyHoursInput).toHaveValue(140); // 20 * 7 = 140
  });

  it('shows access denied for non-authorized users', () => {
    // Mock the auth context to return a non-manager user
    jest.spyOn(require('../contexts/AuthContext'), 'useAuth').mockImplementation(() => ({
      user: {
        id: 1,
        email: 'test@example.com',
        role: UserRole.EMPLOYEE,
        is_superuser: false
      }
    }));

    render(
      <AuthProvider>
        <MonthlyQuotas />
      </AuthProvider>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to view this page.")).toBeInTheDocument();
  });
}); 