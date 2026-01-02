/**
 * @bodhiapp/setup-modal-e2e
 * Page Object Model for setup-modal Playwright tests
 * Built incrementally test-by-test
 */

export const VERSION = '1.0.0';
export const PACKAGE_NAME = '@bodhiapp/setup-modal-e2e';

// Types
export type { OSType, BrowserType, ExtensionStatus, ServerStatus, LnaStatus, StepTestId } from './types/index.js';

// Utilities
export { IframeHelper } from './utils/IframeHelper.js';
export { WaitStrategies } from './utils/WaitStrategies.js';

// Page Objects
export { BaseModalPage } from './pages/BaseModalPage.js';
export { ServerSetupPage } from './pages/ServerSetupPage.js';
export { ExtensionSetupPage } from './pages/ExtensionSetupPage.js';
export { LnaSetupPage } from './pages/LnaSetupPage.js';
export { PlatformCheckPage } from './pages/PlatformCheckPage.js';
export { SuccessStatePage } from './pages/SuccessStatePage.js';
export { SetupModalPage } from './pages/SetupModalPage.js';

// Additional page objects will be exported as they're built
// ... more exports added incrementally
