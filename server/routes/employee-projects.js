import express from 'express';
import { query, withClient } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get past projects (CEO/HR can view any employee in same tenant, employee can view own)
router.get('/employees/:id/projects', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const empRes = await query('SELECT tenant_id, user_id FROM employees WHERE id = $1', [id]);
    if (empRes.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const { tenant_id: empTenant, user_id: empUserId } = empRes.rows[0];
    if (!empTenant) {
      return res.status(400).json({ error: 'Employee has no tenant assigned' });
    }
    
    // Check requester's tenant and role
    const reqProfile = await query('SELECT tenant_id FROM profiles WHERE id = $1', [req.user.id]);
    const reqTenant = reqProfile.rows[0]?.tenant_id;
    if (!reqTenant || reqTenant !== empTenant) {
      return res.status(403).json({ error: 'Unauthorized: different organization' });
    }
    
    const roleRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [req.user.id]);
    const userRole = roleRes.rows[0]?.role;
    const isHROrCEO = ['hr', 'ceo', 'director'].includes(userRole);
    const isOwnProfile = empUserId === req.user.id;
    
    if (!isHROrCEO && !isOwnProfile) {
      return res.status(403).json({ error: 'Unauthorized: only CEO/HR or employee can view past projects' });
    }
    
    const result = await withClient(async (client) => {
      return client.query('SELECT * FROM employee_projects WHERE employee_id = $1 AND tenant_id = $2 ORDER BY start_date DESC NULLS LAST', [id, empTenant]);
    }, empTenant);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching past projects:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch past projects' });
  }
});

router.post('/employees/:id/projects', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { project_name, role, start_date, end_date, technologies, description } = req.body || {};
  if (!project_name) return res.status(400).json({ error: 'project_name required' });
  const t2 = await query('SELECT p.tenant_id AS tenant_id FROM profiles p JOIN employees e ON e.user_id = p.id WHERE e.id = $1', [id]);
  const tenant2 = t2.rows[0]?.tenant_id;
  const result = await withClient(async (client) => client.query(
    `INSERT INTO employee_projects (employee_id, project_name, role, start_date, end_date, technologies, description, tenant_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *`,
    [id, project_name, role || null, start_date || null, end_date || null, Array.isArray(technologies) ? technologies : [], description || null, tenant2]
  ), tenant2);
  res.json(result.rows[0]);
});

export default router;


