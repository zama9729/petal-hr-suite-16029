import express from "express";
import { query } from "../db/pool.js";
import { authenticateToken } from "../middleware/auth.js";
const router = express.Router();

router.get("/", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await query(
      `SELECT id, cycle_name, cycle_year, status FROM appraisal_cycles
       WHERE tenant_id = (SELECT tenant_id FROM profiles WHERE id = $1)
       ORDER BY cycle_year DESC`,
      [userId]
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to fetch" });
  }
});

export default router;
