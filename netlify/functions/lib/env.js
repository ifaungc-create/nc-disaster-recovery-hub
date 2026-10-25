// Server secrets. FAIL CLOSED: if a secret is missing or too weak, every request is refused, unless
// NCDRH_DEV_INSECURE_SECRETS=1 is set. Only the local dev server and the tests set that, and they get
// fixed, public, dev-only values. Never set it on Netlify.
const DEV = { APP_SESSION_SECRET: 'dev-only-session-secret-not-for-production-use', DATA_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64') };
export class ConfigError extends Error {}
const devMode = () => process.env.NCDRH_DEV_INSECURE_SECRETS === '1' && process.env.CONTEXT !== 'production';
export function sessionSecret() {
  const v = process.env.APP_SESSION_SECRET || (devMode() ? DEV.APP_SESSION_SECRET : '');
  if (v.length < 32) throw new ConfigError('APP_SESSION_SECRET is missing or shorter than 32 characters');
  return v;
}
export function dataKey() {
  const raw = process.env.DATA_ENCRYPTION_KEY || (devMode() ? DEV.DATA_ENCRYPTION_KEY : '');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new ConfigError('DATA_ENCRYPTION_KEY must be 32 random bytes, base64-encoded');
  return k;
}
export const STORE_NAME = process.env.NCDRH_BLOBS_STORE || 'ncdrh';
// Comma-separated admin emails (normalized: trimmed, lower-case). Not a secret, but must be set on the site.
export const adminEmails = () => String(process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
export const isAdminEmail = (email) => adminEmails().includes(String(email || '').trim().toLowerCase());
