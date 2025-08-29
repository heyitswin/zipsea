import { createHmac } from 'crypto';

const MISSIVE_SECRET = "480cf0bbbe366ea267849b0036b763ba";

/**
 * Generate HMAC hash for Missive chat authentication
 * @param email - User's email address
 * @returns HMAC SHA256 hash of the email
 */
export function generateMissiveHmac(email: string): string {
  return createHmac('sha256', MISSIVE_SECRET)
    .update(email)
    .digest('hex');
}

/**
 * Server-side function to generate HMAC for Missive authentication
 * This should be called from an API route to keep the secret secure
 */
export async function getMissiveAuth(email: string) {
  return {
    email,
    hash: generateMissiveHmac(email)
  };
}