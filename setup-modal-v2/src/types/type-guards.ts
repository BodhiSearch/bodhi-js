import type { ProbeStatusV2, SetupStateV2 } from './state';

export function isProbeIdle(state: SetupStateV2): boolean {
  return state.probeStatus === 'idle';
}

export function isProbing(state: SetupStateV2): boolean {
  return state.probeStatus === 'probing';
}

export function isConnected(state: SetupStateV2): boolean {
  return state.probeStatus === 'connected';
}

export function isNotReady(state: SetupStateV2): boolean {
  return state.probeStatus === 'not-ready';
}

export function isProbeError(state: SetupStateV2): boolean {
  return state.probeStatus === 'error';
}

export function isNetworkError(state: SetupStateV2): boolean {
  return state.probeStatus === 'network-error';
}

export function isTerminalStatus(status: ProbeStatusV2): boolean {
  return status === 'connected';
}
