import express from 'express';
import { query } from '../db/pool.js';

const router = express.Router();

// Run migration for timesheet projects
router.post('/timesheet-projects', async (req, res) => {
  try {
    await query('BEGIN');
    
    try {
      // Add project_id column
      await query(`
        ALTER TABLE timesheet_entries 
        ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL
      `);
      
      // Add project_type column
      await query(`
        ALTER TABLE timesheet_entries 
        ADD COLUMN IF NOT EXISTS project_type TEXT CHECK (project_type IN ('assigned', 'non-billable', 'internal'))
      `);
      
      // Create index
      await query(`
        CREATE INDEX IF NOT EXISTS idx_timesheet_entries_project 
        ON timesheet_entries(project_id)
      `);
      
      await query('COMMIT');
      
      res.json({ success: true, message: 'Migration completed successfully' });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Migration error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

