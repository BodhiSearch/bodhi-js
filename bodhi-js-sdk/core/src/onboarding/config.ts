/**
 * Static configuration for browsers and operating systems
 * Used by setup modal to display installation instructions
 */

import type { Browser, OS } from '@bodhiapp/setup-modal-types';

/**
 * Browser configurations with extension store URLs
 */
export const BROWSER_CONFIGS: Browser[] = [
  {
    id: 'chrome',
    status: 'supported',
    name: 'Google Chrome',
    extension_url:
      'https://chromewebstore.google.com/detail/bodhi-browser-extension/bjdjhiombmfbcoeojijpfckljjghmjbf',
  },
  {
    id: 'edge',
    status: 'supported',
    name: 'Microsoft Edge',
    extension_url:
      'https://chromewebstore.google.com/detail/bodhi-browser-extension/bjdjhiombmfbcoeojijpfckljjghmjbf',
  },
  {
    id: 'firefox',
    status: 'not-supported',
    name: 'Mozilla Firefox',
    github_issue_url: 'https://github.com/BodhiSearch/bodhi-js/issues/1',
  },
  {
    id: 'safari',
    status: 'not-supported',
    name: 'Safari',
    github_issue_url: 'https://github.com/BodhiSearch/bodhi-js/issues/2',
  },
  {
    id: 'unknown',
    status: 'not-supported',
    name: 'Unknown Browser',
    github_issue_url: 'https://github.com/BodhiSearch/bodhi-js/issues/3',
  },
];

/**
 * Operating system configurations with download URLs
 */
export const OS_CONFIGS: OS[] = [
  {
    id: 'macos',
    status: 'supported',
    name: 'macOS',
    download_url: 'https://getbodhi.app/',
  },
  {
    id: 'windows',
    status: 'supported',
    name: 'Windows',
    download_url: 'https://getbodhi.app/',
  },
  {
    id: 'linux',
    status: 'supported',
    name: 'Linux',
    download_url: 'https://getbodhi.app/',
  },
  {
    id: 'unknown',
    status: 'not-supported',
    name: 'Unknown OS',
    github_issue_url: 'https://github.com/BodhiSearch/bodhi-js/issues/4',
  },
];
