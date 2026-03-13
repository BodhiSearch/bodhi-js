/**
 * User and authentication related types
 */

/**
 * User information from OAuth
 */
export interface UserInfo {
  sub: string;
  email: string;
  name: string;
  given_name: string;
  family_name: string;
  preferred_username: string;
}

/**
 * OAuth tokens
 */
export interface Tokens {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn: number;
}
