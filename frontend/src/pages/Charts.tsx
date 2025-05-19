import React from 'react';
import { Box, Typography } from '@mui/material';
import { Chart } from '../components/Chart';

export const Charts = () => {
    return (
        <Box>
            <Typography variant="h4" gutterBottom>
                Work Distribution Charts
            </Typography>
            <Chart />
        </Box>
    );
}; 