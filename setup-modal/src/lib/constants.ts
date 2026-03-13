/**
 * Default backend server URL
 * Points to local Bodhi App Server default port
 */
export const DEFAULT_SERVER_URL = 'http://localhost:1135';

/**
 * Get server setup URL for a given base URL
 * @param baseUrl - Base server URL (defaults to DEFAULT_SERVER_URL)
 * @returns Setup endpoint URL
 */
export const getServerSetupUrl = (baseUrl: string = DEFAULT_SERVER_URL): string => `${baseUrl}/setup`;

/**
 * Get server admin URL for a given base URL
 * @param baseUrl - Base server URL (defaults to DEFAULT_SERVER_URL)
 * @returns Admin endpoint URL
 */
export const getServerAdminUrl = (baseUrl: string = DEFAULT_SERVER_URL): string => `${baseUrl}/admin`;

/**
 * Get server tenant selection URL for a given base URL
 * @param baseUrl - Base server URL (defaults to DEFAULT_SERVER_URL)
 * @returns Tenant selection endpoint URL
 */
export const getServerTenantSelectionUrl = (baseUrl: string = DEFAULT_SERVER_URL): string => `${baseUrl}/tenant-selection`;
