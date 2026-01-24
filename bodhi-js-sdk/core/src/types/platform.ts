/**
 * Platform detection types
 */

import type { BrowserType, OSType } from '@bodhiapp/setup-modal-types';

/**
 * Browser detection result
 */
export interface BrowserInfo {
  name: string;
  type: BrowserType;
}

/**
 * Operating system detection result
 */
export interface OSInfo {
  name: string;
  type: OSType;
}
