import express from 'express';
import multer from 'multer';
import { query } from '../db/pool.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Configure multer for logo uploads (5MB limit, images only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only image files (JPG, PNG, WEBP, GIF) are allowed.'));
    }
  }
});

// Get organization by user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Get user's tenant_id
    const profileResult = await query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0 || !profileResult.rows[0].tenant_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const orgResult = await query(
      'SELECT id, name, logo_url, domain, company_size, industry, timezone FROM organizations WHERE id = $1',
      [profileResult.rows[0].tenant_id]
    );

    if (orgResult.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(orgResult.rows[0]);
  } catch (error) {
    console.error('Error fetching organization:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update organization (name, logo, etc.) - Admin/CEO/HR only
router.patch('/me', authenticateToken, requireRole('admin', 'ceo', 'director', 'hr'), upload.single('logo'), async (req, res) => {
  try {
    // Get user's tenant_id
    const profileResult = await query(
      'SELECT tenant_id FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (profileResult.rows.length === 0 || !profileResult.rows[0].tenant_id) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const tenantId = profileResult.rows[0].tenant_id;
    const { name } = req.body;

    let logoUrl = null;

    // Handle logo upload
    if (req.file) {
      try {
        // Convert file buffer to base64 data URL
        const base64 = req.file.buffer.toString('base64');
        const mimeType = req.file.mimetype;
        logoUrl = `data:${mimeType};base64,${base64}`;
      } catch (error) {
        console.error('Error processing logo:', error);
        return res.status(400).json({ error: 'Failed to process logo file' });
      }
    }

    // Update organization
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }

    if (logoUrl !== null) {
      updates.push(`logo_url = $${paramIndex++}`);
      values.push(logoUrl);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    values.push(tenantId);
    const updateQuery = `
      UPDATE organizations 
      SET ${updates.join(', ')}, updated_at = now()
      WHERE id = $${paramIndex}
      RETURNING id, name, logo_url, domain, company_size, industry, timezone
    `;

    const result = await query(updateQuery, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating organization:', error);
    res.status(500).json({ error: error.message || 'Failed to update organization' });
  }
});

export default router;

