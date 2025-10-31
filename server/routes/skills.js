import express from 'express';
import { query, withClient } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get skills for employee (CEO/HR can view any employee in same tenant, employee can view own)
router.get('/employees/:id/skills', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Get tenant_id and check permissions
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
    
    // Check if requester is CEO/HR OR viewing their own skills
    const roleRes = await query('SELECT role FROM user_roles WHERE user_id = $1', [req.user.id]);
    const userRole = roleRes.rows[0]?.role;
    const isHROrCEO = ['hr', 'ceo', 'director'].includes(userRole);
    const isOwnProfile = empUserId === req.user.id;
    
    if (!isHROrCEO && !isOwnProfile) {
      return res.status(403).json({ error: 'Unauthorized: only CEO/HR or employee can view skills' });
    }
    
    const result = await withClient(async (client) => {
      return client.query('SELECT * FROM skills WHERE employee_id = $1 AND tenant_id = $2 ORDER BY name', [id, empTenant]);
    }, empTenant);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching skills:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch skills' });
  }
});

// Upsert skill
router.post('/employees/:id/skills', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, level, years_experience, last_used_date } = req.body || {};
    if (!name || !level) {
      return res.status(400).json({ error: 'name and level required' });
    }
    // Get tenant_id directly from employees table
    const t = await query('SELECT tenant_id FROM employees WHERE id = $1', [id]);
    if (t.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const tenant = t.rows[0]?.tenant_id;
    if (!tenant) {
      return res.status(400).json({ error: 'Employee has no tenant assigned' });
    }
    const result = await withClient(async (client) => {
      return client.query(
        `INSERT INTO skills (employee_id, name, level, years_experience, last_used_date, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (employee_id, lower(name)) DO UPDATE
           SET level = EXCLUDED.level,
               years_experience = COALESCE(EXCLUDED.years_experience, skills.years_experience),
               last_used_date = COALESCE(EXCLUDED.last_used_date, skills.last_used_date),
               updated_at = now()
         RETURNING *`,
        [id, name, level, years_experience || 0, last_used_date || null, tenant]
      );
    }, tenant);
    if (result.rows && result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'Failed to save skill' });
    }
  } catch (error) {
    console.error('Error saving skill:', error);
    res.status(500).json({ error: error.message || 'Failed to save skill' });
  }
});

// Certifications (CEO/HR can view any employee in same tenant, employee can view own)
router.get('/employees/:id/certifications', authenticateToken, async (req, res) => {
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
      return res.status(403).json({ error: 'Unauthorized: only CEO/HR or employee can view certifications' });
    }
    
    const result = await withClient(async (client) => {
      return client.query('SELECT * FROM certifications WHERE employee_id = $1 AND tenant_id = $2 ORDER BY issue_date DESC NULLS LAST', [id, empTenant]);
    }, empTenant);
    res.json(result.rows || []);
  } catch (error) {
    console.error('Error fetching certifications:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch certifications' });
  }
});

router.post('/employees/:id/certifications', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, issuer, issue_date, expiry_date, file_url } = req.body || {};
    if (!name) {
      return res.status(400).json({ error: 'name required' });
    }
    const t2 = await query('SELECT tenant_id FROM employees WHERE id = $1', [id]);
    if (t2.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    const tenant2 = t2.rows[0]?.tenant_id;
    if (!tenant2) {
      return res.status(400).json({ error: 'Employee has no tenant assigned' });
    }
    const result = await withClient(async (client) => {
      return client.query(
        `INSERT INTO certifications (employee_id, name, issuer, issue_date, expiry_date, file_url, tenant_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         RETURNING *`,
        [id, name, issuer || null, issue_date || null, expiry_date || null, file_url || null, tenant2]
      );
    }, tenant2);
    if (result.rows && result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.status(500).json({ error: 'Failed to save certification' });
    }
  } catch (error) {
    console.error('Error saving certification:', error);
    res.status(500).json({ error: error.message || 'Failed to save certification' });
  }
});

export default router;


