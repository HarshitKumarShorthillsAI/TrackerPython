import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { monthlyQuotasApi, MonthlyQuota, MonthlyQuotaCreate } from '../services/monthlyQuotas';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const MonthlyQuotas: React.FC = () => {
  const { user } = useAuth();
  const [quotas, setQuotas] = useState<MonthlyQuota[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [open, setOpen] = useState(false);
  const [editQuota, setEditQuota] = useState<MonthlyQuota | null>(null);
  const [error, setError] = useState<string>('');
  const [formData, setFormData] = useState<MonthlyQuotaCreate>({
    month: '',
    working_days: 22,
    daily_hours: 8,
    monthly_hours: 176,
  });

  const isAuthorized = user?.role === UserRole.MANAGER || user?.is_superuser;

  useEffect(() => {
    fetchQuotas();
  }, [selectedYear]);

  const fetchQuotas = async () => {
    try {
      // Validate year
      if (!selectedYear || isNaN(selectedYear) || selectedYear < 1900 || selectedYear > 2100) {
        setError('Invalid year selected');
        return;
      }

      const data = await monthlyQuotasApi.getAll(selectedYear);
      setQuotas(data);
      setError('');
    } catch (err: any) {
      let errorMessage = 'Failed to fetch monthly quotas';
      if (err.response?.data?.detail) {
        errorMessage = typeof err.response.data.detail === 'string' 
          ? err.response.data.detail 
          : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errorMessage = err.message;
      }
      setError(errorMessage);
      console.error('Error fetching quotas:', err);
    }
  };

  const handleOpen = (quota?: MonthlyQuota) => {
    if (quota) {
      setEditQuota(quota);
      setFormData({
        month: quota.month,
        working_days: quota.working_days,
        daily_hours: quota.daily_hours,
        monthly_hours: quota.monthly_hours,
      });
    } else {
      setEditQuota(null);
      setFormData({
        month: `${selectedYear}-01`,
        working_days: 22,
        daily_hours: 8,
        monthly_hours: 176,
      });
    }
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
    setEditQuota(null);
    setError('');
  };

  const handleSubmit = async () => {
    try {
      if (editQuota) {
        await monthlyQuotasApi.update(editQuota.month, formData);
      } else {
        await monthlyQuotasApi.create(formData);
      }
      fetchQuotas();
      handleClose();
    } catch (err) {
      setError('Failed to save monthly quota');
    }
  };

  const handleDelete = async (month: string) => {
    try {
      await monthlyQuotasApi.delete(month);
      fetchQuotas();
    } catch (err) {
      setError('Failed to delete monthly quota');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'working_days' || name === 'daily_hours') {
        newData.monthly_hours = Number(newData.working_days) * Number(newData.daily_hours);
      }
      return newData;
    });
  };

  if (!isAuthorized) {
    return (
      <Box p={3}>
        <Typography variant="h6">Access Denied</Typography>
        <Typography>You don't have permission to view this page.</Typography>
      </Box>
    );
  }

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5">Monthly Quotas</Typography>
        <Box display="flex" gap={2}>
          <TextField
            type="number"
            label="Year"
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            size="small"
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpen()}
          >
            Add Quota
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Month</TableCell>
              <TableCell>Working Days</TableCell>
              <TableCell>Daily Hours</TableCell>
              <TableCell>Monthly Hours</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {quotas.map((quota) => (
              <TableRow key={quota.id}>
                <TableCell>{quota.month}</TableCell>
                <TableCell>{quota.working_days}</TableCell>
                <TableCell>{quota.daily_hours}</TableCell>
                <TableCell>{quota.monthly_hours}</TableCell>
                <TableCell>
                  <IconButton onClick={() => handleOpen(quota)} size="small">
                    <EditIcon />
                  </IconButton>
                  <IconButton onClick={() => handleDelete(quota.month)} size="small">
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editQuota ? 'Edit Quota' : 'Add New Quota'}</DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={2} pt={1}>
            <TextField
              label="Month"
              type="month"
              name="month"
              value={formData.month}
              onChange={handleInputChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Working Days"
              type="number"
              name="working_days"
              value={formData.working_days}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Daily Hours"
              type="number"
              name="daily_hours"
              value={formData.daily_hours}
              onChange={handleInputChange}
              fullWidth
            />
            <TextField
              label="Monthly Hours"
              type="number"
              name="monthly_hours"
              value={formData.monthly_hours}
              disabled
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editQuota ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MonthlyQuotas; 