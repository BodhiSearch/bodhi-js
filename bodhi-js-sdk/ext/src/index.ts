// Re-export all types and constants
export * from './constants';
export { type SerializedExt2ExtState } from './ext-client';
export * from './messages';

// Public facade client (auto-switches between Direct and Extension based on prefs)
export { ExtUIClient, type ExtUIClientParams } from './facade-client';

export { BodhiExtClient } from './ext2ext-client';

// Re-export build info
export { BUILD_MODE as EXT_BUILD_MODE } from './build-info';
