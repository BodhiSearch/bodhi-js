import { SetupStep, DEFAULT_SETUP_STATE } from '@/types';
import { createMockState } from '@/test/mock-factories';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useSetupModalStore } from './setup-modal-store';

describe('SetupModalStore', () => {
  test('initializes with DEFAULT_SETUP_STATE', () => {
    const { result } = renderHook(() => useSetupModalStore());
    expect(result.current.setupState).toEqual(DEFAULT_SETUP_STATE);
    expect(result.current.setupState.env.browser).toBe('unknown');
    expect(result.current.setupState.env.os).toBe('unknown');
    expect(result.current.setupState.extension.status).toBe('not-installed');
  });

  test('initializes with default UI state', () => {
    const { result } = renderHook(() => useSetupModalStore());
    expect(result.current.ui.currentStep).toBe(SetupStep.PLATFORM_CHECK);
    expect(result.current.ui.isRefreshing).toBe(false);
    expect(result.current.ui.extensionStep.browserOverride).toBeNull();
    expect(result.current.ui.lnaStep.serverUrl).toBe('');
    expect(result.current.ui.serverStep.osOverride).toBeNull();
  });

  test('setSetupState updates setupState', () => {
    const { result } = renderHook(() => useSetupModalStore());
    const mockState = createMockState();

    act(() => {
      result.current.setSetupState(mockState);
    });

    expect(result.current.setupState).toEqual(mockState);
  });

  test('setSetupState resets temp overrides', () => {
    const { result } = renderHook(() => useSetupModalStore());

    // Set overrides
    act(() => {
      result.current.setBrowserOverride('edge');
      result.current.setOSOverride('windows');
    });

    expect(result.current.ui.extensionStep.browserOverride).toBe('edge');
    expect(result.current.ui.serverStep.osOverride).toBe('windows');

    // Update setupState should reset overrides
    act(() => {
      result.current.setSetupState(createMockState());
    });

    expect(result.current.ui.extensionStep.browserOverride).toBeNull();
    expect(result.current.ui.serverStep.osOverride).toBeNull();
  });

  test('setCurrentStep updates currentStep', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setCurrentStep(SetupStep.EXTENSION_SETUP);
    });

    expect(result.current.ui.currentStep).toBe(SetupStep.EXTENSION_SETUP);
  });

  test('setIsRefreshing updates isRefreshing', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setIsRefreshing(true);
    });

    expect(result.current.ui.isRefreshing).toBe(true);
  });

  test('setBrowserOverride updates browserOverride', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setBrowserOverride('firefox');
    });

    expect(result.current.ui.extensionStep.browserOverride).toBe('firefox');
  });

  test('setExtensionAccordionOpen updates extensionAccordionOpen', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setExtensionAccordionOpen(true);
    });

    expect(result.current.ui.extensionStep.extensionAccordionOpen).toBe(true);
  });

  test('setServerUrl updates serverUrl', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setServerUrl('http://example.com');
    });

    expect(result.current.ui.lnaStep.serverUrl).toBe('http://example.com');
  });

  test('setOSOverride updates osOverride', () => {
    const { result } = renderHook(() => useSetupModalStore());

    act(() => {
      result.current.setOSOverride('linux');
    });

    expect(result.current.ui.serverStep.osOverride).toBe('linux');
  });

  test('resetTempOverrides resets browser and OS overrides', () => {
    const { result } = renderHook(() => useSetupModalStore());

    // Set overrides
    act(() => {
      result.current.setBrowserOverride('edge');
      result.current.setOSOverride('windows');
    });

    expect(result.current.ui.extensionStep.browserOverride).toBe('edge');
    expect(result.current.ui.serverStep.osOverride).toBe('windows');

    // Reset
    act(() => {
      result.current.resetTempOverrides();
    });

    expect(result.current.ui.extensionStep.browserOverride).toBeNull();
    expect(result.current.ui.serverStep.osOverride).toBeNull();
  });
});
