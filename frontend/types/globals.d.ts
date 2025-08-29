// Clerk custom session claims for role-based access control
export type UserRole = 'admin' | 'user';

declare global {
  interface CustomJwtSessionClaims {
    publicMetadata?: {
      role?: UserRole;
    };
  }
}

export {};