// Browser and OS type definitions
export type BrowserType = 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown';
export type OSType = 'macos' | 'windows' | 'linux' | 'unknown';

// Environment state interface
export interface EnvState {
  os: OSType;
  browser: BrowserType;
}

// Browser platform definitions
export interface SupportedBrowser {
  id: BrowserType;
  status: 'supported';
  name: string;
  extension_url: string;
}

export interface NotSupportedBrowser {
  id: BrowserType;
  status: 'not-supported';
  name: string;
  github_issue_url?: string;
}

export type Browser = SupportedBrowser | NotSupportedBrowser;

// OS platform definitions
export interface SupportedOS {
  id: OSType;
  status: 'supported';
  name: string;
  download_url: string;
}

export interface NotSupportedOS {
  id: OSType;
  status: 'not-supported';
  name: string;
  github_issue_url?: string;
}

export type OS = SupportedOS | NotSupportedOS;
