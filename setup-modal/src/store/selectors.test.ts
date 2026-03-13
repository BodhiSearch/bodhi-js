import { SetupStep } from '@/types';
import {
  createAllSystemsReadyState,
  createExtensionNotInstalledState,
  createLnaGrantedState,
  createLnaPromptState,
  createLnaServerReadyState,
  createMockState,
  createReadyExtensionState,
  createReadyServerState,
  createTenantSelectionServerState,
  createUnsupportedPlatformState,
} from '@/test/mock-factories';
import { describe, expect, test } from 'vitest';
import {
  selectDetectedBrowser,
  selectDetectedOS,
  selectDeterminedStep,
  selectEffectiveBrowser,
  selectEffectiveOS,
  selectIsAllReady,
  selectIsAnyPathComplete,
  selectIsBrowserSupported,
  selectIsExtensionPathComplete,
  selectIsLnaPathComplete,
  selectIsOSSupported,
  selectIsPlatformSupported,
  selectIsServerInstallConfirmed,
  selectStepStatus,
  selectBrowserName,
  selectOSName,
} from './selectors';
import { SetupModalStore } from './types';
import { SetupState } from '@/types';

// Helper to create a minimal store state for testing
const createStoreState = (setupState: SetupState, uiOverrides = {}): SetupModalStore => ({
  setupState,
  channel: null,
  ui: {
    currentStep: SetupStep.PLATFORM_CHECK,
    isRefreshing: false,
    extensionStep: {
      browserOverride: null,
      extensionAccordionOpen: false,
      serverAccordionOpen: false,
    },
    lnaStep: {
      serverUrl: '',
      lnaAccordionOpen: false,
      serverAccordionOpen: false,
    },
    serverStep: {
      osOverride: null,
    },
    ...uiOverrides,
  },
  setSetupState: () => {},
  initChannel: () => null as any,
  sendMessage: async () => ({}) as any,
  setCurrentStep: () => {},
  setIsRefreshing: () => {},
  setBrowserOverride: () => {},
  setExtensionAccordionOpen: () => {},
  setExtensionServerAccordionOpen: () => {},
  setServerUrl: () => {},
  setLnaAccordionOpen: () => {},
  setLnaServerAccordionOpen: () => {},
  setOSOverride: () => {},
  resetTempOverrides: () => {},
});

describe('Platform Selectors', () => {
  test('selectIsBrowserSupported returns true for supported browser', () => {
    const state = createStoreState(createMockState());
    expect(selectIsBrowserSupported(state)).toBe(true);
  });

  test('selectIsBrowserSupported returns false for unsupported browser', () => {
    const unsupported = createUnsupportedPlatformState('firefox', 'macos');
    const state = createStoreState(unsupported);
    expect(selectIsBrowserSupported(state)).toBe(false);
  });

  test('selectIsOSSupported returns true for supported OS', () => {
    const state = createStoreState(createMockState());
    expect(selectIsOSSupported(state)).toBe(true);
  });

  test('selectIsOSSupported returns false for unsupported OS', () => {
    const unsupported = createUnsupportedPlatformState('chrome', 'linux');
    const state = createStoreState(unsupported);
    expect(selectIsOSSupported(state)).toBe(false);
  });

  test('selectIsPlatformSupported returns true when both browser and OS supported', () => {
    const state = createStoreState(createMockState());
    expect(selectIsPlatformSupported(state)).toBe(true);
  });

  test('selectIsPlatformSupported returns false when browser unsupported', () => {
    const unsupported = createUnsupportedPlatformState('firefox', 'macos');
    const state = createStoreState(unsupported);
    expect(selectIsPlatformSupported(state)).toBe(false);
  });

  test('selectDetectedBrowser returns browser config', () => {
    const state = createStoreState(createMockState());
    const browser = selectDetectedBrowser(state);
    expect(browser).toBeDefined();
    expect(browser?.id).toBe('chrome');
  });

  test('selectDetectedOS returns OS config', () => {
    const state = createStoreState(createMockState());
    const os = selectDetectedOS(state);
    expect(os).toBeDefined();
    expect(os?.id).toBe('macos');
  });
});

describe('Path Completion Selectors', () => {
  test('selectIsLnaPathComplete returns true when lna granted and lnaServer ready', () => {
    const mockState = createMockState({
      lna: createLnaGrantedState('http://localhost:1135'),
      lnaServer: createLnaServerReadyState(),
    });
    const state = createStoreState(mockState);
    expect(selectIsLnaPathComplete(state)).toBe(true);
  });

  test('selectIsLnaPathComplete returns false when lna not granted', () => {
    const mockState = createMockState({
      lna: createLnaPromptState(),
      lnaServer: createLnaServerReadyState(),
    });
    const state = createStoreState(mockState);
    expect(selectIsLnaPathComplete(state)).toBe(false);
  });

  test('selectIsExtensionPathComplete returns true when extension and server ready', () => {
    const mockState = createMockState({
      extension: createReadyExtensionState(),
      server: createReadyServerState(),
    });
    const state = createStoreState(mockState);
    expect(selectIsExtensionPathComplete(state)).toBe(true);
  });

  test('selectIsExtensionPathComplete returns false when extension not ready', () => {
    const state = createStoreState(createExtensionNotInstalledState());
    expect(selectIsExtensionPathComplete(state)).toBe(false);
  });

  test('selectIsAnyPathComplete returns true when either path complete', () => {
    const mockState = createMockState({
      extension: createReadyExtensionState(),
      server: createReadyServerState(),
    });
    const state = createStoreState(mockState);
    expect(selectIsAnyPathComplete(state)).toBe(true);
  });

  test('selectIsAllReady returns true when platform supported and any path complete', () => {
    const state = createStoreState(createAllSystemsReadyState());
    expect(selectIsAllReady(state)).toBe(true);
  });
});

describe('User Confirmation Selectors', () => {
  test('selectIsServerInstallConfirmed returns true when confirmed', () => {
    const mockState = createMockState({
      userConfirmations: { serverInstall: true },
    });
    const state = createStoreState(mockState);
    expect(selectIsServerInstallConfirmed(state)).toBe(true);
  });

  test('selectIsServerInstallConfirmed returns false when not confirmed', () => {
    const state = createStoreState(createMockState());
    expect(selectIsServerInstallConfirmed(state)).toBe(false);
  });
});

describe('Step Logic Selectors', () => {
  test('selectDeterminedStep returns PLATFORM_CHECK when platform not supported', () => {
    const state = createStoreState(createUnsupportedPlatformState());
    expect(selectDeterminedStep(state)).toBe(SetupStep.PLATFORM_CHECK);
  });

  test('selectDeterminedStep returns SERVER_SETUP when not confirmed', () => {
    const state = createStoreState(createMockState());
    expect(selectDeterminedStep(state)).toBe(SetupStep.SERVER_SETUP);
  });

  test('selectDeterminedStep returns COMPLETE when lna path complete', () => {
    const mockState = createMockState({
      lna: createLnaGrantedState('http://localhost:1135'),
      lnaServer: createLnaServerReadyState(),
      userConfirmations: { serverInstall: true },
    });
    const state = createStoreState(mockState);
    expect(selectDeterminedStep(state)).toBe(SetupStep.COMPLETE);
  });

  test('selectDeterminedStep returns EXTENSION_SETUP when extension not ready', () => {
    const mockState = createMockState({
      extension: createExtensionNotInstalledState().extension,
      userConfirmations: { serverInstall: true },
    });
    const state = createStoreState(mockState);
    expect(selectDeterminedStep(state)).toBe(SetupStep.EXTENSION_SETUP);
  });

  test('selectDeterminedStep returns EXTENSION_SETUP when server in tenant-selection status', () => {
    const mockState = createMockState({
      extension: createReadyExtensionState(),
      server: createTenantSelectionServerState(),
      userConfirmations: { serverInstall: true },
    });
    const state = createStoreState(mockState);
    expect(selectDeterminedStep(state)).toBe(SetupStep.EXTENSION_SETUP);
  });

  test('selectStepStatus returns complete for completed step', () => {
    const state = createStoreState(createMockState());
    expect(selectStepStatus(state, SetupStep.PLATFORM_CHECK)).toBe('complete');
  });

  test('selectStepStatus returns not-supported for unsupported platform', () => {
    const state = createStoreState(createUnsupportedPlatformState());
    expect(selectStepStatus(state, SetupStep.PLATFORM_CHECK)).toBe('not-supported');
  });

  test('selectStepStatus returns incomplete for pending step', () => {
    const state = createStoreState(createMockState());
    expect(selectStepStatus(state, SetupStep.SERVER_SETUP)).toBe('incomplete');
  });
});

describe('Effective Selection Selectors', () => {
  test('selectEffectiveBrowser returns override when set', () => {
    const state = createStoreState(createMockState(), {
      extensionStep: {
        browserOverride: 'edge',
        extensionAccordionOpen: false,
        serverAccordionOpen: false,
      },
    });
    expect(selectEffectiveBrowser(state)).toBe('edge');
  });

  test('selectEffectiveBrowser returns detected browser when no override', () => {
    const state = createStoreState(createMockState());
    expect(selectEffectiveBrowser(state)).toBe('chrome');
  });

  test('selectEffectiveOS returns override when set', () => {
    const state = createStoreState(createMockState(), {
      serverStep: {
        osOverride: 'windows',
      },
    });
    expect(selectEffectiveOS(state)).toBe('windows');
  });

  test('selectEffectiveOS returns detected OS when no override', () => {
    const state = createStoreState(createMockState());
    expect(selectEffectiveOS(state)).toBe('macos');
  });
});

describe('Name Selectors', () => {
  test('selectBrowserName returns browser name when detected', () => {
    const state = createStoreState(createMockState());
    expect(selectBrowserName(state)).toBe('Chrome');
  });

  test('selectBrowserName returns Unknown Browser when not detected', () => {
    const setupState = createMockState();
    setupState.env.browser = 'unknown';
    const state = createStoreState(setupState);
    expect(selectBrowserName(state)).toBe('Unknown Browser');
  });

  test('selectOSName returns OS name when detected', () => {
    const state = createStoreState(createMockState());
    expect(selectOSName(state)).toBe('macOS');
  });

  test('selectOSName returns Unknown OS when not detected', () => {
    const setupState = createMockState();
    setupState.env.os = 'unknown';
    const state = createStoreState(setupState);
    expect(selectOSName(state)).toBe('Unknown OS');
  });
});
