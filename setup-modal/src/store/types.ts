import { BrowserType, OSType, SetupState, SetupStep, MessageType, RequestPayload, ResponsePayload } from '@/types';
import { MessageChannel } from '@/lib/protocol';

/**
 * UI state for the extension setup step
 */
export interface ExtensionStepUIState {
  browserOverride: BrowserType | null;
  extensionAccordionOpen: boolean;
  serverAccordionOpen: boolean;
}

/**
 * UI state for the LNA setup step
 */
export interface LnaStepUIState {
  serverUrl: string;
  lnaAccordionOpen: boolean;
  serverAccordionOpen: boolean;
}

/**
 * UI state for the server setup step
 */
export interface ServerStepUIState {
  osOverride: OSType | null;
}

/**
 * Combined UI state for all setup steps
 */
export interface UIState {
  currentStep: SetupStep;
  isRefreshing: boolean;
  extensionStep: ExtensionStepUIState;
  lnaStep: LnaStepUIState;
  serverStep: ServerStepUIState;
}

/**
 * Zustand store interface for setup-modal
 */
export interface SetupModalStore {
  // === DOMAIN STATE (from parent) ===
  /** Setup state - initialized with DEFAULT_SETUP_STATE, updated by parent */
  setupState: SetupState;

  // === MESSAGE CHANNEL ===
  channel: MessageChannel | null;

  // === UI STATE ===
  ui: UIState;

  // === ACTIONS ===
  // Domain state setter
  setSetupState: (state: SetupState) => void;

  // Message channel initialization
  initChannel: () => MessageChannel;

  // Parent communication (replaces sendAction)
  sendMessage: <T extends MessageType>(type: T, payload: RequestPayload<T>) => Promise<ResponsePayload<T>>;

  // UI state actions
  setCurrentStep: (step: SetupStep) => void;
  setIsRefreshing: (refreshing: boolean) => void;

  // Extension step UI actions
  setBrowserOverride: (browser: BrowserType | null) => void;
  setExtensionAccordionOpen: (open: boolean) => void;
  setExtensionServerAccordionOpen: (open: boolean) => void;

  // LNA step UI actions
  setServerUrl: (url: string) => void;
  setLnaAccordionOpen: (open: boolean) => void;
  setLnaServerAccordionOpen: (open: boolean) => void;

  // Server step UI actions
  setOSOverride: (os: OSType | null) => void;

  // Reset actions
  resetTempOverrides: () => void;
}
