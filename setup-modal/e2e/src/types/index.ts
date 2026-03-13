/**
 * TypeScript types for setup-modal e2e tests
 * Provides compile-time verification for interactions
 *
 * Note: These types are kept separate from main types for e2e testing isolation
 * but aligned with main type definitions in src/lib/types.ts
 */

export type OSType = 'macos' | 'windows' | 'linux' | 'unknown';
export type BrowserType = 'chrome' | 'edge' | 'firefox' | 'safari' | 'unknown';
export type ExtensionStatus = 'ready' | 'not-installed' | 'unreachable';
export type ServerStatus = 'ready' | 'pending-extension-ready' | 'unreachable' | 'setup';
export type LnaStatus = 'prompt' | 'granted' | 'skipped' | 'unreachable' | 'denied' | 'unsupported';
export type LnaServerStatus = 'pending-lna-ready' | 'ready' | 'setup' | 'resource_admin' | 'error';
export type StepTestId = 'platform-check-step' | 'server-setup-step' | 'lna-setup-step' | 'extension-setup-step' | 'success-state-step';
