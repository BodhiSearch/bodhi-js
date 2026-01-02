import { SetupStep } from '@/types';
import { SetupModalStore } from './types';

/**
 * Step status types for visual indication
 */
export type StepStatus = 'complete' | 'incomplete' | 'error' | 'warning' | 'skipped' | 'not-supported';

// ============================================
// Platform Selectors
// ============================================

export function selectIsBrowserSupported(state: SetupModalStore): boolean {
  const { setupState } = state;
  return setupState.browsers.some(b => b.id === setupState.env.browser && b.status === 'supported');
}

export function selectIsOSSupported(state: SetupModalStore): boolean {
  const { setupState } = state;
  return setupState.os.some(o => o.id === setupState.env.os && o.status === 'supported');
}

export function selectIsPlatformSupported(state: SetupModalStore): boolean {
  return selectIsBrowserSupported(state) && selectIsOSSupported(state);
}

export function selectDetectedBrowser(state: SetupModalStore) {
  const { setupState } = state;
  return setupState.browsers.find(b => b.id === setupState.env.browser);
}

export function selectDetectedOS(state: SetupModalStore) {
  const { setupState } = state;
  return setupState.os.find(o => o.id === setupState.env.os);
}

export function selectBrowserName(state: SetupModalStore): string {
  const browser = selectDetectedBrowser(state);
  return browser?.name || 'Unknown Browser';
}

export function selectOSName(state: SetupModalStore): string {
  const os = selectDetectedOS(state);
  return os?.name || 'Unknown OS';
}

// ============================================
// Path Completion Selectors
// ============================================

export function selectIsLnaPathComplete(state: SetupModalStore): boolean {
  const { setupState } = state;
  return setupState.lna.status === 'granted' && setupState.lnaServer.status === 'ready';
}

export function selectIsExtensionPathComplete(state: SetupModalStore): boolean {
  const { setupState } = state;
  return setupState.extension.status === 'ready' && setupState.server.status === 'ready';
}

export function selectIsAnyPathComplete(state: SetupModalStore): boolean {
  return selectIsLnaPathComplete(state) || selectIsExtensionPathComplete(state);
}

export function selectIsAllReady(state: SetupModalStore): boolean {
  return selectIsPlatformSupported(state) && selectIsAnyPathComplete(state);
}

// ============================================
// User Confirmation Selectors
// ============================================

export function selectIsServerInstallConfirmed(state: SetupModalStore): boolean {
  const { setupState } = state;
  return setupState.userConfirmations.serverInstall;
}

// ============================================
// Step Logic Selectors
// ============================================

/**
 * Determines the initial step based on current setup state
 * Replaces SetupWizard.determineInitialStep()
 */
export function selectDeterminedStep(state: SetupModalStore): SetupStep {
  const { setupState } = state;

  // Check platform support first
  if (!selectIsPlatformSupported(state)) {
    return SetupStep.PLATFORM_CHECK;
  }

  // Check server installation confirmation
  if (!selectIsServerInstallConfirmed(state)) {
    return SetupStep.SERVER_SETUP;
  }

  // Check if LNA path is complete
  if (selectIsLnaPathComplete(state)) {
    return SetupStep.COMPLETE;
  }

  // Check if we're in LNA setup flow
  const lnaStatus = setupState.lna.status;
  if (lnaStatus === 'prompt' || lnaStatus === 'granted' || lnaStatus === 'unreachable' || lnaStatus === 'denied' || lnaStatus === 'unsupported') {
    return SetupStep.LNA_SETUP;
  }

  // Check extension status
  if (setupState.extension.status !== 'ready') {
    return SetupStep.EXTENSION_SETUP;
  }

  // Check server status
  if (setupState.server.status !== 'ready') {
    return SetupStep.EXTENSION_SETUP;
  }

  return SetupStep.COMPLETE;
}

/**
 * Gets the status for a specific step
 * Replaces StepIndicator.getStepStatus()
 */
export function selectStepStatus(state: SetupModalStore, step: SetupStep): StepStatus {
  const { setupState } = state;

  const platformSupported = selectIsPlatformSupported(state);
  const lnaPathComplete = selectIsLnaPathComplete(state);
  const extensionPathComplete = selectIsExtensionPathComplete(state);

  switch (step) {
    case SetupStep.PLATFORM_CHECK:
      if (platformSupported) return 'complete';
      return 'not-supported';

    case SetupStep.SERVER_SETUP:
      if (selectIsServerInstallConfirmed(state)) return 'complete';
      return 'incomplete';

    case SetupStep.LNA_SETUP: {
      const lnaStatus = setupState.lna.status;
      const lnaServerStatus = setupState.lnaServer.status;

      if (lnaStatus === 'granted' && lnaServerStatus === 'ready') return 'complete';
      if (lnaStatus === 'granted' && lnaServerStatus === 'error') return 'error';
      if (lnaStatus === 'granted' && lnaServerStatus !== 'ready') return 'warning';
      if (lnaStatus === 'skipped') return 'skipped';
      if (lnaStatus === 'unreachable') return 'error';
      if (lnaStatus === 'denied') return 'warning';
      if (lnaStatus === 'unsupported') return 'warning';
      return 'incomplete';
    }

    case SetupStep.EXTENSION_SETUP: {
      const extensionStatus = setupState.extension.status;
      const serverStatus = setupState.server.status;

      if (extensionPathComplete) return 'complete';
      if (extensionStatus === 'unreachable' || extensionStatus === 'unsupported') return 'error';
      if (extensionStatus === 'ready' && (serverStatus === 'unreachable' || serverStatus === 'error')) return 'error';
      return 'incomplete';
    }

    case SetupStep.COMPLETE:
      if (lnaPathComplete || extensionPathComplete) return 'complete';
      return 'incomplete';

    default:
      return 'incomplete';
  }
}

// ============================================
// Effective Selection Selectors (with UI overrides)
// ============================================

/**
 * Gets the effective browser selection (with override from UI state)
 */
export function selectEffectiveBrowser(state: SetupModalStore) {
  const { setupState, ui } = state;
  const override = ui.extensionStep.browserOverride;
  return override ?? setupState.env.browser;
}

/**
 * Gets the effective OS selection (with override from UI state)
 */
export function selectEffectiveOS(state: SetupModalStore) {
  const { setupState, ui } = state;
  const override = ui.serverStep.osOverride;
  return override ?? setupState.env.os;
}

// ============================================
// NOTE: Compound Selectors Investigation
// ============================================
// We investigated using compound selectors to reduce multiple store subscriptions
// per component (from 5-10 down to 1-2). However, testing revealed that compound
// selectors that return objects with nested selector results cause infinite render
// loops with Zustand, even when using shallow comparison.
//
// Root cause: Selectors that call other selectors returning objects (like
// selectDetectedBrowser) create new object references on every call, causing
// Zustand to think state has changed, triggering re-render, which calls selector
// again, creating new references, etc.
//
// Conclusion: Multiple direct subscriptions are the correct pattern with Zustand.
// The performance concern was premature optimization.
