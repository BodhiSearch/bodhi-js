/**
 * @bodhiapp/setup-modal-v2-e2e
 * Page Object Model for setup-modal-v2 Playwright tests
 */

export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@bodhiapp/setup-modal-v2-e2e';

// Types
export type { ProbeStatusV2 } from './types/index.js';

// Utilities
export { IframeHelperV2 } from './utils/IframeHelper.js';
export { WaitStrategiesV2 } from './utils/WaitStrategies.js';

// Page Objects
export { BaseModalV2Page } from './pages/BaseModalV2Page.js';
export { SetupScreenPage } from './pages/SetupScreenPage.js';
export { SetupModalV2Page } from './pages/SetupModalV2Page.js';
