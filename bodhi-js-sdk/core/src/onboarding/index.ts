/**
 * Onboarding module - Framework-agnostic setup modal
 */

export {
  OnboardingModal,
  type AsyncRequestHandler,
  type AsyncRequestHandlers,
  type ModalEvent,
  type ModalEventMap,
  type OnboardingModalConfig,
} from './modal';

export {
  OnboardingModalV2,
  type AsyncRequestHandlerV2,
  type AsyncRequestHandlersV2,
  type OnboardingModalV2Config,
} from './modal-v2';

export { BROWSER_CONFIGS, OS_CONFIGS } from './config';
