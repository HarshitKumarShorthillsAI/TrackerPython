import { TimeEntryStatus } from '../types';

export const getStatusChipColor = (status: TimeEntryStatus): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
        case TimeEntryStatus.DRAFT:
            return 'default';
        case TimeEntryStatus.SUBMITTED:
            return 'info';
        case TimeEntryStatus.APPROVED:
            return 'success';
        case TimeEntryStatus.REJECTED:
            return 'error';
        case TimeEntryStatus.BILLED:
            return 'secondary';
        default:
            return 'default';
    }
}; 