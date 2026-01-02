import { SetupStep, DEFAULT_SETUP_STATE } from '@/types';
import { MessageChannel } from '@/lib/protocol';
import { create } from 'zustand';
import { SetupModalStore } from './types';

const initialUIState: SetupModalStore['ui'] = {
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
};

/**
 * Zustand store for setup-modal state management
 * Uses MessageChannel for type-safe parent communication
 */
export const useSetupModalStore = create<SetupModalStore>((set, get) => ({
  // === DOMAIN STATE ===
  setupState: DEFAULT_SETUP_STATE,

  // === MESSAGE CHANNEL ===
  channel: null,

  // === UI STATE ===
  ui: initialUIState,

  // === ACTIONS ===
  setSetupState: state => {
    set({ setupState: state });
    // Reset temp overrides when domain state changes
    get().resetTempOverrides();
  },

  /**
   * Initialize message channel (lazy initialization)
   * Creates channel on first call, returns existing channel on subsequent calls
   */
  initChannel: () => {
    let channel = get().channel;
    if (!channel) {
      channel = new MessageChannel(window.parent, {
        debug: import.meta.env.DEV,
        timeout: 30000, // 30 second timeout for requests
      });
      set({ channel });
    }
    return channel;
  },

  /**
   * Send message to parent and await response
   * Replaces old sendAction with type-safe Promise-based API
   */
  sendMessage: async (type, payload) => {
    const channel = get().initChannel();
    return channel.request(type, payload);
  },

  setCurrentStep: step =>
    set(state => ({
      ui: { ...state.ui, currentStep: step },
    })),

  setIsRefreshing: refreshing =>
    set(state => ({
      ui: { ...state.ui, isRefreshing: refreshing },
    })),

  setBrowserOverride: browser =>
    set(state => ({
      ui: {
        ...state.ui,
        extensionStep: { ...state.ui.extensionStep, browserOverride: browser },
      },
    })),

  setExtensionAccordionOpen: open =>
    set(state => ({
      ui: {
        ...state.ui,
        extensionStep: { ...state.ui.extensionStep, extensionAccordionOpen: open },
      },
    })),

  setExtensionServerAccordionOpen: open =>
    set(state => ({
      ui: {
        ...state.ui,
        extensionStep: { ...state.ui.extensionStep, serverAccordionOpen: open },
      },
    })),

  setServerUrl: url =>
    set(state => ({
      ui: {
        ...state.ui,
        lnaStep: { ...state.ui.lnaStep, serverUrl: url },
      },
    })),

  setLnaAccordionOpen: open =>
    set(state => ({
      ui: {
        ...state.ui,
        lnaStep: { ...state.ui.lnaStep, lnaAccordionOpen: open },
      },
    })),

  setLnaServerAccordionOpen: open =>
    set(state => ({
      ui: {
        ...state.ui,
        lnaStep: { ...state.ui.lnaStep, serverAccordionOpen: open },
      },
    })),

  setOSOverride: os =>
    set(state => ({
      ui: {
        ...state.ui,
        serverStep: { ...state.ui.serverStep, osOverride: os },
      },
    })),

  resetTempOverrides: () =>
    set(state => ({
      ui: {
        ...state.ui,
        extensionStep: { ...state.ui.extensionStep, browserOverride: null },
        serverStep: { ...state.ui.serverStep, osOverride: null },
      },
    })),
}));
