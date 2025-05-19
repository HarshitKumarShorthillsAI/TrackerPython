import { rest } from 'msw';
import { UserRole } from '../types';

export const handlers = [
  // Mock login
  rest.post('http://localhost:8010/api/v1/login/access-token', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        access_token: 'mock-token',
        token_type: 'bearer'
      })
    );
  }),

  // Mock current user
  rest.get('http://localhost:8010/api/v1/users/me', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 1,
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        role: UserRole.MANAGER,
        is_superuser: false
      })
    );
  }),

  // Mock monthly quotas
  rest.get('http://localhost:8010/api/v1/monthly-quotas', (req, res, ctx) => {
    const year = req.url.searchParams.get('year');
    return res(
      ctx.status(200),
      ctx.json([
        {
          id: 1,
          month: `${year}-01`,
          working_days: 22,
          daily_hours: 8,
          monthly_hours: 176,
          created_at: '2024-01-01T00:00:00',
          updated_at: '2024-01-01T00:00:00'
        }
      ])
    );
  }),

  // Mock create monthly quota
  rest.post('http://localhost:8010/api/v1/monthly-quotas', (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        id: 2,
        ...req.body,
        created_at: '2024-01-01T00:00:00',
        updated_at: '2024-01-01T00:00:00'
      })
    );
  })
]; 