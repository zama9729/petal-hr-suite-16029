import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole, requireSuperadmin } from '../middleware/auth.js';
import { Parser } from 'json2csv';

const router = express.Router();

// Platform-level metrics for application heads (temporarily restricted to CE0 role)
router.get('/metrics', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const [orgs, users, employees, orgsByDay, revenueByMonth, totalRevenue, mrr] = await Promise.all([
      query('SELECT COUNT(*)::int AS count FROM organizations'),
      query('SELECT COUNT(*)::int AS count FROM profiles'),
      query('SELECT COUNT(*)::int AS count FROM employees'),
      query(
        `SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
                COUNT(*)::int AS count
           FROM organizations
          WHERE created_at >= now() - interval '30 days'
          GROUP BY 1
          ORDER BY 1`
      ),
      query(
        `WITH months AS (
           SELECT date_trunc('month', now()) - (n || ' months')::interval AS m
             FROM generate_series(0, 11) AS n
        )
        SELECT to_char(m, 'YYYY-MM') AS month,
               COALESCE((
                 SELECT SUM(amount_cents) FROM payments
                  WHERE status = 'paid' AND date_trunc('month', created_at) = date_trunc('month', m)
               ), 0)::int AS amount
          FROM months
         ORDER BY month`
      ),
      query(`SELECT COALESCE(SUM(amount_cents),0)::bigint AS cents FROM payments WHERE status='paid'`),
      query(`SELECT COALESCE(SUM(price_cents),0)::bigint AS cents FROM subscriptions WHERE status='active'`),
    ]);

    const totalOrganizations = orgs.rows[0]?.count ?? 0;
    const totalUsers = users.rows[0]?.count ?? 0;
    const totalEmployees = employees.rows[0]?.count ?? 0;
    const totalRevenueCents = Number(totalRevenue.rows[0]?.cents ?? 0);
    const mrrCents = Number(mrr.rows[0]?.cents ?? 0);

    res.json({
      totals: {
        organizations: totalOrganizations,
        users: totalUsers,
        employees: totalEmployees,
        revenue: totalRevenueCents / 100,
        mrr: mrrCents / 100,
      },
      series: {
        organizationsByDay: orgsByDay.rows,
        revenueByMonth: revenueByMonth.rows,
      },
    });
  } catch (error) {
    console.error('Admin metrics error:', error);
    res.status(500).json({ error: error.message || 'Failed to load metrics' });
  }
});

// Payments listing with optional date filters
router.get('/payments', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { from, to, limit = 100 } = req.query;
    const clauses = ["status = 'paid'"];
    const params = [];
    if (from) { params.push(from); clauses.push(`created_at >= $${params.length}`); }
    if (to)   { params.push(to);   clauses.push(`created_at <= $${params.length}`); }
    params.push(Number(limit));
    const sql = `SELECT id, organization_id, amount_cents, currency, created_at
                   FROM payments
                  WHERE ${clauses.join(' AND ')}
                  ORDER BY created_at DESC
                  LIMIT $${params.length}`;
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Admin payments error:', error);
    res.status(500).json({ error: error.message || 'Failed to load payments' });
  }
});

// CSV export
router.get('/payments/export.csv', authenticateToken, requireSuperadmin, async (req, res) => {
  try {
    const { from, to } = req.query;
    const clauses = ["status = 'paid'"];
    const params = [];
    if (from) { params.push(from); clauses.push(`created_at >= $${params.length}`); }
    if (to)   { params.push(to);   clauses.push(`created_at <= $${params.length}`); }
    const sql = `SELECT id, organization_id, amount_cents, currency, created_at FROM payments WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC`;
    const result = await query(sql, params);
    const parser = new Parser({ fields: ['id','organization_id','amount_cents','currency','created_at'] });
    const csv = parser.parse(result.rows);
    res.header('Content-Type', 'text/csv');
    res.attachment('payments.csv');
    res.send(csv);
  } catch (error) {
    console.error('Admin payments export error:', error);
    res.status(500).json({ error: error.message || 'Failed to export payments' });
  }
});

// Probe: tell client whether current user is superadmin (allowlisted)
router.get('/access', authenticateToken, async (req, res) => {
  const email = (req.user?.email || '').toLowerCase();
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
  const superadmin = email && adminEmails.includes(email);
  res.json({ superadmin });
});

export default router;


