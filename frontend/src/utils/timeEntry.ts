import { TimeEntry } from '../types';
import { parseISO, differenceInMinutes } from 'date-fns';

export const calculateDuration = (timeEntry: TimeEntry): string => {
    if (!timeEntry.end_time) return '0h 0m';
    
    const startTime = parseISO(timeEntry.start_time);
    const endTime = parseISO(timeEntry.end_time);
    const totalMinutes = differenceInMinutes(endTime, startTime);
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}h ${minutes}m`;
};

export const calculateCost = (timeEntry: TimeEntry): number => {
    if (!timeEntry.end_time) return 0;
    
    const startTime = parseISO(timeEntry.start_time);
    const endTime = parseISO(timeEntry.end_time);
    const totalMinutes = differenceInMinutes(endTime, startTime);
    const hours = totalMinutes / 60;
    
    return hours * timeEntry.hourly_rate;
}; 