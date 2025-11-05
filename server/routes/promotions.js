import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Promote all existing employees with 2+ direct reports (one-time fix)
router.post('/promote-existing-managers', authenticateToken, requireRole('hr', 'director', 'ceo', 'admin'), async (req, res) => {
  try {
    // Run the promotion function
    const result = await query('SELECT promote_existing_managers() as promoted_count');
    const promotedCount = result.rows[0]?.promoted_count || 0;
    
    res.json({ 
      success: true, 
      promoted_count: promotedCount,
      message: `Promoted ${promotedCount} employees to manager role based on direct reports`
    });
  } catch (error) {
    console.error('Error promoting existing managers:', error);
    res.status(500).json({ error: error.message || 'Failed to promote existing managers' });
  }
});

// Get employees eligible for promotion (for admin view)
router.get('/eligible', authenticateToken, requireRole('hr', 'director', 'ceo', 'admin'), async (req, res) => {
  try {
    // Get user's tenant_id
    const tenantResult = await query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );
    const tenantId = tenantResult.rows[0]?.tenant_id;

    if (!tenantId) {
      return res.status(403).json({ error: 'No organization found' });
    }

    // Find employees with 2+ direct reports who are not managers
    const result = await query(
      `SELECT 
        e.id,
        e.employee_id,
        e.user_id,
        COUNT(dr.id) as direct_reports_count,
        json_build_object(
          'first_name', p.first_name,
          'last_name', p.last_name,
          'email', p.email
        ) as profiles
      FROM employees e
      JOIN profiles p ON p.id = e.user_id
      LEFT JOIN employees dr ON dr.reporting_manager_id = e.id AND dr.status = 'active'
      WHERE e.status = 'active' AND e.tenant_id = $1
      GROUP BY e.id, e.employee_id, e.user_id, p.first_name, p.last_name, p.email
      HAVING COUNT(dr.id) >= 2
      AND NOT EXISTS (
        SELECT 1 FROM user_roles
        WHERE user_id = e.user_id
        AND role IN ('manager', 'hr', 'director', 'ceo', 'admin')
      )
      ORDER BY direct_reports_count DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching eligible employees:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch eligible employees' });
  }
});

export default router;

