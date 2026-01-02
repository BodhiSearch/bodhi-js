/**
 * Validates if a string is a valid URL
 * @param url - String to validate
 * @returns true if valid URL, false otherwise
 */
export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Gets a user-friendly error message for invalid URLs
 * @param url - The URL that failed validation
 * @returns Error message string
 */
export function getUrlValidationError(url: string): string {
  if (!url || url.trim() === '') {
    return 'Server URL is required';
  }

  try {
    const urlObj = new URL(url);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
      return 'URL must use http:// or https:// protocol';
    }
  } catch {
    return 'Please enter a valid URL (e.g., http://localhost:1135)';
  }

  return 'Invalid URL format';
}
