import { query } from '../db/pool.js';

export async function setTenantContext(req, res, next) {
  try {
    if (!req.user?.id) return next();
    const r = await query('SELECT tenant_id FROM profiles WHERE id = $1', [req.user.id]);
    const tenantId = r.rows[0]?.tenant_id;
    if (tenantId) {
      // PostgreSQL SET SESSION doesn't support parameters, validate and format it
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(tenantId)) {
        // Note: This won't work with connection pooling - each query may use a different connection
        // The withClient function is better for setting tenant context per operation
        // await query(`SET SESSION app.current_tenant = '${tenantId}'`);
      }
    }
  } catch (e) {
    console.error('Failed to set tenant context', e?.message || e);
  }
  next();
}

export default { setTenantContext };


