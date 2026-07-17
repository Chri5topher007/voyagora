import { randomBytes, createHash } from 'crypto';

// Generates a random opaque token for refresh tokens / password reset links.
// We only ever store the HASH of this in the database, never the raw value,
// so a database leak alone can't be used to impersonate users or reset
// passwords (same principle as never storing plaintext passwords).
export function generateOpaqueToken(): string {
  return randomBytes(40).toString('hex');
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
