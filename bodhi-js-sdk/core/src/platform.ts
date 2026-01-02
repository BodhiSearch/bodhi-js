/**
 * Browser and OS detection utilities using UAParser.js
 */

import { UAParser } from 'ua-parser-js';
import type { BrowserInfo, OSInfo } from './types';

/**
 * Detects the current browser using UAParser.js
 */
export function detectBrowser(): BrowserInfo {
  const parser = new UAParser();
  const browser = parser.getBrowser();
  const browserName = browser.name?.toLowerCase() || '';
  const actualBrowserName = browser.name || 'Unknown Browser';

  // Map UAParser results to our supported browsers
  if (browserName.includes('chrome')) {
    return { name: 'Google Chrome', type: 'chrome' };
  } else if (browserName.includes('edge')) {
    return { name: 'Microsoft Edge', type: 'edge' };
  } else if (browserName.includes('firefox')) {
    return { name: 'Mozilla Firefox', type: 'firefox' };
  } else if (browserName.includes('safari')) {
    return { name: 'Safari', type: 'safari' };
  }
  // All other browsers return unknown type but preserve actual browser name
  else {
    // Clean up browser name (remove common suffixes like "Browser")
    let cleanName = actualBrowserName
      .replace(/\s+Browser$/i, '')
      .replace(/\s+browser$/i, '')
      .trim();

    // If after cleanup we're left with nothing or just "Unknown", use full default
    if (!cleanName || cleanName.toLowerCase() === 'unknown') {
      cleanName = 'Unknown Browser';
    }

    return { name: cleanName, type: 'unknown' };
  }
}

/**
 * Detects the current operating system using UAParser.js
 * Maps all OS variants to simplified supported types
 */
export function detectOS(): OSInfo {
  const parser = new UAParser();
  const os = parser.getOS();
  const osName = os.name?.toLowerCase() || '';

  // macOS detection (treat all macOS as Apple Silicon)
  if (osName.includes('mac')) {
    return { name: 'macOS', type: 'macos' };
  }
  // Windows detection (treat all Windows as x64)
  else if (osName.includes('windows')) {
    return { name: 'Windows', type: 'windows' };
  }
  // Linux detection (treat all Linux as x64)
  else if (
    osName.includes('linux') ||
    osName.includes('ubuntu') ||
    osName.includes('fedora') ||
    osName.includes('debian')
  ) {
    return { name: 'Linux', type: 'linux' };
  }
  // All other OS return unknown
  else {
    return { name: 'Unknown', type: 'unknown' };
  }
}
