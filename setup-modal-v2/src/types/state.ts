export type ProbeStatusV2 = 'idle' | 'probing' | 'connected' | 'not-ready' | 'error' | 'network-error';

export type ServerStatusV2 = 'ready' | 'setup' | 'resource_admin' | 'unreachable' | 'error';

export interface BrowserInfoV2 {
  name: string;
  version: number;
  supported: boolean;
}

export interface SetupStateV2 {
  serverUrl: string;
  browser: BrowserInfoV2;
  probeStatus: ProbeStatusV2;
  serverStatus?: ServerStatusV2;
  error?: { code: string; message: string };
}

export const DEFAULT_LOCAL_URL = 'http://localhost:1135';

export const CLOUD_URL = 'https://cloud.getbodhi.app';

export const INSTALL_URL = 'https://getbodhi.app';

export const DEFAULT_SETUP_STATE_V2: SetupStateV2 = {
  probeStatus: 'idle',
  serverUrl: DEFAULT_LOCAL_URL,
  browser: { name: 'unknown', version: 0, supported: false },
};
