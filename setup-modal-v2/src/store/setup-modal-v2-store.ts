import { create } from 'zustand';
import type { MessageTypeV2, RequestPayloadV2, ResponsePayloadV2, SetupStateV2 } from '@/types';
import { DEFAULT_SETUP_STATE_V2 } from '@/types';
import { MessageChannelV2 } from '@/lib/protocol';

/**
 * Minimal Zustand store for setup-modal-v2.
 *
 * State shape is flat — a single SetupStateV2 plus a lazily-initialized
 * MessageChannelV2. There are no UI override fields (no accordion state, no
 * browser overrides) because the v2 UX is fully driven by setupState.probeStatus.
 */
export interface SetupModalV2Store {
  setupState: SetupStateV2;
  channel: MessageChannelV2 | null;

  setSetupState: (state: SetupStateV2) => void;
  initChannel: () => MessageChannelV2;
  sendMessage: <T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>) => Promise<ResponsePayloadV2<T>>;
}

export const useSetupModalV2Store = create<SetupModalV2Store>((set, get) => ({
  setupState: DEFAULT_SETUP_STATE_V2,
  channel: null,

  setSetupState: state => set({ setupState: state }),

  initChannel: () => {
    let channel = get().channel;
    if (!channel) {
      channel = new MessageChannelV2(window.parent, {
        debug: import.meta.env.DEV,
        timeout: 3000,
      });
      set({ channel });
    }
    return channel;
  },

  sendMessage: async (type, payload) => {
    const channel = get().initChannel();
    return channel.request(type, payload);
  },
}));
