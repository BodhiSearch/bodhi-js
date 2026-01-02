/**
 * @bodhiapp/bodhi-js - Web SDK exports
 */

// Public facade client (auto-switches between Direct and Extension based on prefs)
import type { SerializedWebExtensionState } from './ext-client';
export { WebUIClient, type WebUIClientParams } from './facade-client';

// Re-export IWebUIClient from core (internal monorepo package)
import type { IWebUIClient } from './interface';

export type { IWebUIClient, SerializedWebExtensionState };

// Re-export build info
export { BUILD_MODE as WEB_BUILD_MODE } from './build-info';
