export {};

declare global {
  interface CustomJwtSessionClaims {
    org_name?: string | null;
    role?: string;
  }
}
