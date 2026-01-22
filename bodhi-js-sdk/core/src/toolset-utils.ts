import type { AppClientToolset } from '@bodhiapp/ts-client';

/**
 * Validate requested toolset scope IDs are present in response
 * @param requestedScopeIds - Array of scope IDs that were requested
 * @param toolsets - Array of toolsets returned from the server
 * @returns Array of missing scope IDs (empty if all present)
 */
export function getMissingToolsetScopeIds(
  requestedScopeIds: string[] | undefined,
  toolsets: AppClientToolset[]
): string[] {
  if (!requestedScopeIds || requestedScopeIds.length === 0) {
    return [];
  }
  const returnedScopeIds = new Set(toolsets.map((t) => t.scope_id).filter(Boolean));
  return requestedScopeIds.filter((id) => !returnedScopeIds.has(id));
}

/**
 * Get space-separated scope strings for requested toolset scope IDs
 * @param requestedScopeIds - Array of scope IDs that were requested (undefined/empty = no toolsets)
 * @param toolsets - Array of toolsets returned from the server
 * @returns Space-separated scope strings (e.g., "scope_toolset-foo scope_toolset-bar") or empty string
 */
export function getRequestedToolsetScopes(
  requestedScopeIds: string[] | undefined,
  toolsets: AppClientToolset[]
): string {
  if (!requestedScopeIds || requestedScopeIds.length === 0) {
    return '';
  }
  // Filter toolsets to only include requested ones (by scope_id), excluding those with undefined scope_id
  const requestedToolsets = toolsets.filter(
    (t) => t.scope_id && requestedScopeIds.includes(t.scope_id)
  );
  // Map to scope strings and join with space
  return requestedToolsets.map((t) => t.scope).join(' ');
}
