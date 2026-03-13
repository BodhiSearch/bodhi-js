import { describe, expect, test } from 'vitest';
import {
  createLnaDeniedState,
  createLnaGrantedState,
  createLnaPromptState,
  createLnaServerErrorState,
  createLnaServerPendingState,
  createLnaServerReadyState,
  createLnaServerResourceAdminState,
  createLnaServerSetupState,
  createLnaServerTenantSelectionState,
  createLnaSkippedState,
  createLnaUnreachableState,
  createLnaUnsupportedState,
  createNotInstalledExtensionState,
  createNotSupportedBrowser,
  createNotSupportedOS,
  createPendingServerState,
  createReadyExtensionState,
  createReadyServerState,
  createResourceAdminServerState,
  createSetupServerState,
  createSupportedBrowser,
  createSupportedOS,
  createTenantSelectionServerState,
  createUnreachableExtensionState,
  createUnreachableServerState,
  createUnsupportedExtensionState,
} from '@/test/mock-factories';
import {
  isExtensionStateNotReady,
  isExtensionStateReady,
  isLnaServerStateError,
  isLnaServerStatePending,
  isLnaServerStateReady,
  isLnaServerStateResourceAdmin,
  isLnaServerStateSetup,
  isLnaServerStateTenantSelection,
  isLnaStateDenied,
  isLnaStateGranted,
  isLnaStatePrompt,
  isLnaStateSkipped,
  isLnaStateUnreachable,
  isLnaStateUnsupported,
  isNotSupportedBrowser,
  isNotSupportedOS,
  isServerStatePending,
  isServerStateReachable,
  isServerStateReady,
  isServerStateUnreachable,
  isSupportedBrowser,
  isSupportedOS,
} from '@/types/type-guards';

describe('Extension Type Guards', () => {
  test('isExtensionStateReady returns true for ready state', () => {
    const state = createReadyExtensionState();
    expect(isExtensionStateReady(state)).toBe(true);
    expect(isExtensionStateNotReady(state)).toBe(false);
  });

  test('isExtensionStateNotReady returns true for non-ready states', () => {
    const notInstalled = createNotInstalledExtensionState();
    const unreachable = createUnreachableExtensionState();
    const unsupported = createUnsupportedExtensionState();

    expect(isExtensionStateNotReady(notInstalled)).toBe(true);
    expect(isExtensionStateNotReady(unreachable)).toBe(true);
    expect(isExtensionStateNotReady(unsupported)).toBe(true);
  });
});

describe('Server Type Guards', () => {
  test('isServerStateReady returns true for ready state', () => {
    const state = createReadyServerState();
    expect(isServerStateReady(state)).toBe(true);
  });

  test('isServerStateReachable returns true for setup/resource-admin/tenant-selection states', () => {
    const setup = createSetupServerState();
    const resourceAdmin = createResourceAdminServerState();
    const tenantSelection = createTenantSelectionServerState();

    expect(isServerStateReachable(setup)).toBe(true);
    expect(isServerStateReachable(resourceAdmin)).toBe(true);
    expect(isServerStateReachable(tenantSelection)).toBe(true);
  });

  test('isServerStatePending returns true for pending state', () => {
    const state = createPendingServerState();
    expect(isServerStatePending(state)).toBe(true);
  });

  test('isServerStateUnreachable returns true for unreachable state', () => {
    const state = createUnreachableServerState();
    expect(isServerStateUnreachable(state)).toBe(true);
  });
});

describe('LNA Type Guards', () => {
  test('isLnaStatePrompt returns true for prompt state', () => {
    const state = createLnaPromptState();
    expect(isLnaStatePrompt(state)).toBe(true);
  });

  test('isLnaStateSkipped returns true for skipped state', () => {
    const state = createLnaSkippedState();
    expect(isLnaStateSkipped(state)).toBe(true);
  });

  test('isLnaStateGranted returns true for granted state', () => {
    const state = createLnaGrantedState('http://localhost:1135');
    expect(isLnaStateGranted(state)).toBe(true);
  });

  test('isLnaStateUnreachable returns true for unreachable state', () => {
    const state = createLnaUnreachableState('http://localhost:1135');
    expect(isLnaStateUnreachable(state)).toBe(true);
  });

  test('isLnaStateDenied returns true for denied state', () => {
    const state = createLnaDeniedState();
    expect(isLnaStateDenied(state)).toBe(true);
  });

  test('isLnaStateUnsupported returns true for unsupported state', () => {
    const state = createLnaUnsupportedState();
    expect(isLnaStateUnsupported(state)).toBe(true);
  });
});

describe('LNA Server Type Guards', () => {
  test('isLnaServerStatePending returns true for pending state', () => {
    const state = createLnaServerPendingState();
    expect(isLnaServerStatePending(state)).toBe(true);
  });

  test('isLnaServerStateReady returns true for ready state', () => {
    const state = createLnaServerReadyState();
    expect(isLnaServerStateReady(state)).toBe(true);
  });

  test('isLnaServerStateSetup returns true for setup state', () => {
    const state = createLnaServerSetupState();
    expect(isLnaServerStateSetup(state)).toBe(true);
  });

  test('isLnaServerStateResourceAdmin returns true for resource-admin state', () => {
    const state = createLnaServerResourceAdminState();
    expect(isLnaServerStateResourceAdmin(state)).toBe(true);
  });

  test('isLnaServerStateTenantSelection returns true for tenant-selection state', () => {
    const state = createLnaServerTenantSelectionState();
    expect(isLnaServerStateTenantSelection(state)).toBe(true);
  });

  test('isLnaServerStateError returns true for error state', () => {
    const state = createLnaServerErrorState();
    expect(isLnaServerStateError(state)).toBe(true);
  });
});

describe('Browser/OS Type Guards', () => {
  test('isSupportedBrowser returns true for supported browser', () => {
    const browser = createSupportedBrowser('chrome', 'Chrome', 'https://chrome.google.com');
    expect(isSupportedBrowser(browser)).toBe(true);
    expect(isNotSupportedBrowser(browser)).toBe(false);
  });

  test('isNotSupportedBrowser returns true for not-supported browser', () => {
    const browser = createNotSupportedBrowser('firefox', 'Firefox');
    expect(isNotSupportedBrowser(browser)).toBe(true);
    expect(isSupportedBrowser(browser)).toBe(false);
  });

  test('isSupportedOS returns true for supported OS', () => {
    const os = createSupportedOS('macos', 'macOS', 'https://macos.com/download');
    expect(isSupportedOS(os)).toBe(true);
    expect(isNotSupportedOS(os)).toBe(false);
  });

  test('isNotSupportedOS returns true for not-supported OS', () => {
    const os = createNotSupportedOS('linux', 'Linux');
    expect(isNotSupportedOS(os)).toBe(true);
    expect(isSupportedOS(os)).toBe(false);
  });
});
