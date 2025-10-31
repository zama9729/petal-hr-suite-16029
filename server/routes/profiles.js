import express from 'express';
import { query } from '../db/pool.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, ur.role
       FROM profiles p
       LEFT JOIN user_roles ur ON ur.user_id = p.id
       WHERE p.id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update presence status
router.post('/me/presence', authenticateToken, async (req, res) => {
  try {
    const { presence_status } = req.body;
    
    // Validate presence status
    if (!['online', 'away', 'out_of_office', 'break'].includes(presence_status)) {
      return res.status(400).json({ error: 'Invalid presence status' });
    }

    // Check for active approved leave
    const leaveCheck = await query(
      `SELECT has_active_approved_leave(e.id) as has_active_leave
       FROM employees e
       WHERE e.user_id = $1`,
      [req.user.id]
    );

    // If employee has active approved leave, append "but available"
    let effectiveStatus = presence_status;
    if (leaveCheck.rows.length > 0 && leaveCheck.rows[0].has_active_leave) {
      effectiveStatus = 'out_of_office'; // Force out_of_office if on leave
    }

    // Update presence status
    await query(
      `UPDATE employees 
       SET presence_status = $1, last_presence_update = now()
       WHERE user_id = $2`,
      [effectiveStatus, req.user.id]
    );

    res.json({ 
      presence_status: effectiveStatus,
      has_active_leave: leaveCheck.rows[0]?.has_active_leave || false
    });
  } catch (error) {
    console.error('Error updating presence status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user's presence status
router.get('/me/presence', authenticateToken, async (req, res) => {
  try {
    const result = await query(
      `SELECT 
        e.presence_status, 
        e.last_presence_update,
        has_active_approved_leave(e.id) as has_active_leave
       FROM employees e
       WHERE e.user_id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching presence status:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

