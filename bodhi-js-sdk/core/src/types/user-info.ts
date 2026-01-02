/**
 * User and authentication related types
 */

/**
 * User scope types for regular and power users
 */
export type UserScope = 'scope_user_user' | 'scope_user_power_user';

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
