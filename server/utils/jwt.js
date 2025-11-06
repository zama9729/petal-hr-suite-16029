import jwt from 'jsonwebtoken';

// Creates a JWT aligned with the Python RAG service (uses JWT_SECRET_KEY)
export function createUserJWT({ userId, tenantId, role, expiresIn = '1h' }) {
  const secret = process.env.JWT_SECRET_KEY || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT secret missing: set JWT_SECRET_KEY (or JWT_SECRET)');
  }
  const payload = {
    user_id: String(userId),
    tenant_id: String(tenantId),
    role: String(role),
  };
  return jwt.sign(payload, secret, { algorithm: 'HS256', expiresIn });
}

// Example helper to set token in response JSON for client-side storage
export function issueLoginToken(res, { userId, tenantId, role }) {
  const token = createUserJWT({ userId, tenantId, role });
  return res.json({ token, token_type: 'Bearer', expires_in: 3600 });
}

export default { createUserJWT, issueLoginToken };





