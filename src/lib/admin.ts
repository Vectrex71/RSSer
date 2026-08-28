/**
 * Admin Configuration Helper
 * Allows defining admin email(s) via environment variables (VITE_ADMIN_EMAIL or ADMIN_EMAIL).
 * Supports comma-separated multiple admin emails (e.g. "admin@example.com,owner@example.com").
 */

export function getAdminEmails(): string[] {
  let envEmails = '';
  
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_ADMIN_EMAIL) {
    envEmails = (import.meta as any).env.VITE_ADMIN_EMAIL;
  } else if (typeof process !== 'undefined' && process.env?.ADMIN_EMAIL) {
    envEmails = process.env.ADMIN_EMAIL;
  } else if (typeof process !== 'undefined' && process.env?.VITE_ADMIN_EMAIL) {
    envEmails = process.env.VITE_ADMIN_EMAIL;
  }

  const list = envEmails
    .split(',')
    .map((e: string) => e.trim().toLowerCase())
    .filter(Boolean);

  if (list.length > 0) {
    return list;
  }

  // Safe fallback default for current owner
  return ['hj.wuethrich@gmail.com', 'wuethrich@gmail.com'];
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const lower = email.trim().toLowerCase();
  const adminEmails = getAdminEmails();
  return adminEmails.includes(lower);
}
