import { ArrowRight, Check, CheckCircle, Clock, MinusCircle, Wifi, XCircle } from 'lucide-react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import {
  selectIsBrowserSupported,
  selectIsOSSupported,
  selectIsAllReady,
  selectIsLnaPathComplete,
  selectIsExtensionPathComplete,
  selectBrowserName,
  selectOSName,
} from '@/store/selectors';

export function SuccessState() {
  // Get state using individual subscriptions - compound selectors cause infinite loops with nested object returns
  const setupState = useSetupModalStore(state => state.setupState);
  const sendMessage = useSetupModalStore(state => state.sendMessage);
  const isPlatformSupported = useSetupModalStore(selectIsBrowserSupported);
  const isOSSupported = useSetupModalStore(selectIsOSSupported);
  const allReady = useSetupModalStore(selectIsAllReady);
  const isLnaPathComplete = useSetupModalStore(selectIsLnaPathComplete);
  const isExtensionPathComplete = useSetupModalStore(selectIsExtensionPathComplete);
  const browserName = useSetupModalStore(selectBrowserName);
  const osName = useSetupModalStore(selectOSName);

  const { extension, server, lna, lnaServer, selectedConnection } = setupState!;

  const isExtensionReady = extension.status === 'ready';
  const isServerReady = server.status === 'ready';

  // Computed effective selection for display when selectedConnection is null
  const effectiveSelection = selectedConnection ?? (isLnaPathComplete ? 'lna' : isExtensionPathComplete ? 'extension' : null);

  const handleConnectionChange = (value: 'lna' | 'extension') => {
    sendMessage('modal:select-connection', { connection: value }).catch(err => {
      console.error('[SuccessState] Select connection failed:', err);
    });
  };

  const getStatusIcon = (isComplete: boolean, isSupported = true) => {
    if (isComplete && isSupported) {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    } else if (!isSupported) {
      return <Clock className="w-5 h-5 text-amber-500" />;
    } else {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusText = (isComplete: boolean, isSupported = true) => {
    if (isComplete && isSupported) {
      return { text: 'Ready', className: 'text-green-700' };
    } else if (!isSupported) {
      return { text: 'Not Supported', className: 'text-amber-700' };
    } else {
      return { text: 'Incomplete', className: 'text-red-700' };
    }
  };

  const handleContinue = () => {
    sendMessage('modal:complete', undefined).catch(err => {
      console.error('[SuccessState] Complete failed:', err);
    });
  };

  return (
    <div className="space-y-6" data-testid="success-state-step">
      <div className="text-center py-6" data-testid="success-state-header">
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${allReady ? 'bg-green-100' : 'bg-amber-100'}`} data-testid="success-state-icon">
          {allReady ? <CheckCircle className="w-8 h-8 text-green-600" /> : <Clock className="w-8 h-8 text-amber-600" />}
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="success-state-title">
          {allReady ? 'All Systems Ready!' : 'Setup In Progress'}
        </h3>

        <p className="text-gray-600 mb-6" data-testid="success-state-description">
          {allReady ? 'Your Bodhi Platform setup is complete and ready to use.' : 'Complete the remaining setup steps to get started.'}
        </p>

        {allReady && (
          <button
            onClick={handleContinue}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            data-testid="continue-button"
          >
            Continue to Webpage
            <ArrowRight className="ml-2 w-5 h-5" />
          </button>
        )}
      </div>

      {/* Setup Status Summary */}
      <div className="bg-white border border-gray-200 rounded-lg p-4" data-testid="status-summary-section">
        <h4 className="text-sm font-medium text-gray-900 mb-4" data-testid="status-summary-title">
          Setup Status Summary
        </h4>

        <div className="space-y-3">
          {/* Platform Compatibility */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100" data-testid="platform-status-row">
            <div className="flex items-center">
              {getStatusIcon(isPlatformSupported && isOSSupported, isPlatformSupported && isOSSupported)}
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900" data-testid="platform-status-label">
                  Platform Compatibility
                </p>
                <p className="text-xs text-gray-500" data-testid="platform-status-details">
                  {browserName} on {osName}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${getStatusText(isPlatformSupported && isOSSupported, isPlatformSupported && isOSSupported).className}`}
              data-testid="platform-status-text"
            >
              {getStatusText(isPlatformSupported && isOSSupported, isPlatformSupported && isOSSupported).text}
            </span>
          </div>

          {/* Direct Connection (LNA) */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100" data-testid="lna-status-row">
            <div className="flex items-center">
              {lna.status === 'granted' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : lna.status === 'skipped' ? (
                <MinusCircle className="w-5 h-5 text-gray-400" />
              ) : (
                <Wifi className="w-5 h-5 text-gray-400" />
              )}
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900" data-testid="lna-status-label">
                  Direct Connection
                </p>
                <p className="text-xs text-gray-500" data-testid="lna-status-details">
                  {lna.status === 'granted' ? `Connected to ${lna.serverUrl}` : lna.status === 'skipped' ? 'Using browser extension instead' : 'Not configured'}
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-medium ${lna.status === 'granted' ? 'text-green-700' : lna.status === 'skipped' ? 'text-gray-500' : 'text-gray-500'}`}
              data-testid="lna-status-text"
            >
              {lna.status === 'granted' ? 'Ready' : lna.status === 'skipped' ? 'Skipped' : 'Not Connected'}
            </span>
          </div>

          {/* Local Server (via LNA) */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100" data-testid="lna-server-status-row">
            <div className="flex items-center">
              {lna.status === 'skipped' || lna.status === 'prompt' ? (
                <MinusCircle className="w-5 h-5 text-gray-400" />
              ) : lnaServer.status === 'ready' ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : (
                <Clock className="w-5 h-5 text-amber-500" />
              )}
              <div className="ml-3">
                <p
                  className={`text-sm font-medium ${lna.status === 'skipped' || lna.status === 'prompt' ? 'text-gray-500' : 'text-gray-900'}`}
                  data-testid="lna-server-status-label"
                >
                  Local Server (via LNA)
                </p>
                <p className="text-xs text-gray-500" data-testid="lna-server-status-details">
                  {lna.status === 'skipped'
                    ? 'Using browser extension instead'
                    : lna.status === 'prompt'
                      ? 'LNA not configured'
                      : lnaServer.status === 'ready'
                        ? `Version ${lnaServer.version}`
                        : lnaServer.status === 'pending-lna-ready'
                          ? 'Waiting for LNA connection'
                          : ('error' in lnaServer && lnaServer.error?.message) || 'Connection issue'}
                </p>
              </div>
            </div>
            {/* Connection selection radio for LNA path */}
            <div className="flex items-center">
              {isLnaPathComplete ? (
                <label htmlFor="connection-lna" className="flex items-center space-x-2 cursor-pointer">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={effectiveSelection === 'lna'}
                    id="connection-lna"
                    data-testid="connection-lna"
                    onClick={() => handleConnectionChange('lna')}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      effectiveSelection === 'lna' ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white hover:border-green-400'
                    }`}
                  >
                    {effectiveSelection === 'lna' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-xs font-medium text-green-700">Use this</span>
                </label>
              ) : (
                <span className="text-xs font-medium text-gray-400" data-testid="connection-lna-hint">
                  Not set up
                </span>
              )}
            </div>
          </div>

          {/* Browser Extension */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100" data-testid="extension-status-row">
            <div className="flex items-center">
              {getStatusIcon(isExtensionReady)}
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900" data-testid="extension-status-label">
                  Browser Extension
                </p>
                <p className="text-xs text-gray-500" data-testid="extension-status-details">
                  {isExtensionReady ? `Version ${extension.version}` : extension.error.message}
                </p>
              </div>
            </div>
            <span className={`text-xs font-medium ${getStatusText(isExtensionReady).className}`} data-testid="extension-status-text">
              {getStatusText(isExtensionReady).text}
            </span>
          </div>

          {/* Local Server (via Extension) */}
          <div className="flex items-center justify-between py-2" data-testid="server-status-row">
            <div className="flex items-center">
              {getStatusIcon(isServerReady)}
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900" data-testid="server-status-label">
                  Local Server (via Extension)
                </p>
                <p className="text-xs text-gray-500" data-testid="server-status-details">
                  {isServerReady ? `Version ${server.version}` : server.error.message}
                </p>
              </div>
            </div>
            {/* Connection selection radio for Extension path */}
            <div className="flex items-center">
              {isExtensionPathComplete ? (
                <label htmlFor="connection-extension" className="flex items-center space-x-2 cursor-pointer">
                  <button
                    type="button"
                    role="radio"
                    aria-checked={effectiveSelection === 'extension'}
                    id="connection-extension"
                    data-testid="connection-extension"
                    onClick={() => handleConnectionChange('extension')}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      effectiveSelection === 'extension' ? 'border-green-500 bg-green-500' : 'border-gray-300 bg-white hover:border-green-400'
                    }`}
                  >
                    {effectiveSelection === 'extension' && <Check className="w-3 h-3 text-white" />}
                  </button>
                  <span className="text-xs font-medium text-green-700">Use this</span>
                </label>
              ) : (
                <span className="text-xs font-medium text-gray-400" data-testid="connection-extension-hint">
                  Not set up
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Help text for incomplete setup */}
      {!allReady && (
        <div className="text-center bg-gray-50 rounded-lg p-4" data-testid="help-text-section">
          <p className="text-sm text-gray-600 mb-2" data-testid="help-text">
            You can navigate to any step using the progress indicator above to complete the remaining setup.
          </p>
        </div>
      )}
    </div>
  );
}
