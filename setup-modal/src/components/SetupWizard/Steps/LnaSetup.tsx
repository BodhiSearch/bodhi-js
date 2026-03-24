import { DEFAULT_SERVER_URL, getServerSetupUrl, getServerAdminUrl } from '@/lib/constants';
import { isValidUrl, getUrlValidationError } from '@/lib/url-validation';
import { AlertCircle, AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, SkipForward, Wifi, XCircle } from 'lucide-react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { useEffect, useState } from 'react';
import { Accordion } from '@/components/common/Accordion';
import { TroubleshootingBox } from '@/components/common/TroubleshootingBox';

export function LnaSetup() {
  const setupState = useSetupModalStore(state => state.setupState);
  const serverUrl = useSetupModalStore(state => state.ui.lnaStep.serverUrl);
  const lnaOpen = useSetupModalStore(state => state.ui.lnaStep.lnaAccordionOpen);
  const serverOpen = useSetupModalStore(state => state.ui.lnaStep.serverAccordionOpen);
  const setServerUrl = useSetupModalStore(state => state.setServerUrl);
  const setLnaOpen = useSetupModalStore(state => state.setLnaAccordionOpen);
  const setServerOpen = useSetupModalStore(state => state.setLnaServerAccordionOpen);
  const sendMessage = useSetupModalStore(state => state.sendMessage);

  // Local state for URL validation error
  const [urlError, setUrlError] = useState<string>('');

  const { lna, lnaServer } = setupState!;

  // UX: Auto-initialize serverUrl for user convenience
  // Pre-fills the input field with appropriate default based on LNA status
  // This avoids requiring users to manually enter the URL every time
  useEffect(() => {
    if (!serverUrl) {
      if (lna.status === 'granted') setServerUrl(lna.serverUrl);
      else if (lna.status === 'unreachable') setServerUrl(lna.serverUrl);
      else if (lna.status === 'prompt' && lna.serverUrl) setServerUrl(lna.serverUrl);
      else if (lna.status === 'skipped' && lna.serverUrl) setServerUrl(lna.serverUrl);
      else setServerUrl(DEFAULT_SERVER_URL);
    }
  }, [serverUrl, lna, setServerUrl]);

  // UX: Auto-expand accordions to guide users through setup
  // Opens the section that needs attention, implementing progressive disclosure
  useEffect(() => {
    if (lna.status !== 'granted') {
      setLnaOpen(true);
    } else if (lnaServer.status !== 'ready') {
      setServerOpen(true);
    }
  }, [lna.status, lnaServer.status, setLnaOpen, setServerOpen]);

  const handleConnect = () => {
    // Validate URL before sending
    if (!isValidUrl(serverUrl)) {
      setUrlError(getUrlValidationError(serverUrl));
      return;
    }

    // Clear any previous error and send message
    setUrlError('');
    sendMessage('modal:lna:connect', { serverUrl }).catch(err => {
      console.error('[LnaSetup] Connect failed:', err);
      setUrlError('Failed to connect. Please try again.');
    });
  };

  const handleSkip = () => {
    sendMessage('modal:lna:skip', undefined).catch(err => {
      console.error('[LnaSetup] Skip failed:', err);
    });
  };

  // Determine button label based on state
  const getButtonLabel = () => {
    switch (lna.status) {
      case 'granted':
        return 'Reconnect';
      case 'unreachable':
      case 'denied':
        return 'Try Again';
      default:
        return 'Connect';
    }
  };

  // Determine button icon based on state
  const getButtonIcon = () => {
    switch (lna.status) {
      case 'granted':
      case 'unreachable':
      case 'denied':
        return <RefreshCw className="w-4 h-4" />;
      default:
        return <Wifi className="w-4 h-4" />;
    }
  };

  const getLnaStatusLabel = () => {
    switch (lna.status) {
      case 'granted':
        return 'Connected';
      case 'skipped':
        return 'Skipped';
      case 'unreachable':
        return 'Connection Failed';
      case 'denied':
        return 'Permission Denied';
      case 'unsupported':
        return 'Not Supported';
      default:
        return 'Not Connected';
    }
  };

  const getLnaIcon = () => {
    if (lna.status === 'granted') {
      return <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />;
    } else if (lna.status === 'skipped') {
      return <span className="w-5 h-5 mr-2 text-gray-400 flex items-center justify-center">—</span>;
    } else if (lna.status === 'unreachable') {
      return <XCircle className="w-5 h-5 text-red-500 mr-2" />;
    } else if (lna.status === 'denied') {
      return <AlertTriangle className="w-5 h-5 text-amber-500 mr-2" />;
    } else if (lna.status === 'unsupported') {
      return <AlertTriangle className="w-5 h-5 text-gray-500 mr-2" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />;
    }
  };

  const getServerStatusLabel = () => {
    if (lna.status !== 'granted') return 'Pending LNA';
    switch (lnaServer.status) {
      case 'ready':
        return 'Connected';
      case 'setup':
        return 'Setup Required';
      case 'resource_admin':
        return 'Admin Required';
      case 'error':
        return 'Error';
      default:
        return 'Checking...';
    }
  };

  const getServerIcon = () => {
    if (lnaServer.status === 'ready') {
      return <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />;
    } else if (lna.status !== 'granted') {
      return <span className="w-5 h-5 mr-2 text-gray-400 flex items-center justify-center">—</span>;
    } else if (lnaServer.status === 'pending-lna-ready') {
      return <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />;
    } else {
      return <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />;
    }
  };

  const renderLnaContent = () => {
    return (
      <div className="space-y-4">
        {/* LNA status message */}
        {lna.status === 'granted' && (
          <div className="flex items-center text-green-600 py-2">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span>Direct connection established to {lna.serverUrl}</span>
          </div>
        )}

        {lna.status === 'prompt' && (
          <div className="text-gray-600 py-2">
            <p>Configure direct connection to your local Bodhi server.</p>
            <p className="text-sm text-gray-500 mt-1">Direct connection allows websites to connect to localhost without a browser extension.</p>
          </div>
        )}

        {lna.status === 'unsupported' && (
          <div className="flex items-start text-amber-600 py-2">
            <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Browser Not Supported</p>
              <p className="text-sm text-gray-500">Your browser does not support Local Network Access. You can still try to connect, or use the browser extension instead.</p>
            </div>
          </div>
        )}

        {lna.status === 'unreachable' && (
          <div className="flex items-start text-red-600 py-2">
            <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Connection Failed</p>
              <p className="text-sm">{lna.error.message}</p>
              <p className="text-sm text-gray-500">Could not connect to {lna.serverUrl}</p>
            </div>
          </div>
        )}

        {lna.status === 'denied' && (
          <div className="flex items-start text-amber-600 py-2">
            <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Permission Denied</p>
              <p className="text-sm">{lna.error.message}</p>
              <p className="text-sm text-gray-500">Your browser requires permission to access local network resources.</p>
            </div>
          </div>
        )}

        {lna.status === 'skipped' && (
          <div className="text-gray-600 py-2">
            <p>Direct connection skipped. Using browser extension instead.</p>
            <p className="text-sm text-gray-500 mt-1">You can still enable direct connection by entering a server URL below.</p>
          </div>
        )}

        {/* URL input */}
        <div>
          <label htmlFor="lna-url" className="block text-sm font-medium text-gray-700 mb-1">
            Server URL
          </label>
          <input
            id="lna-url"
            type="text"
            data-testid="lna-url-input"
            value={serverUrl}
            onChange={e => {
              setServerUrl(e.target.value);
              // Clear error when user starts typing
              if (urlError) setUrlError('');
            }}
            className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
              urlError ? 'border-red-300' : 'border-gray-300'
            }`}
            placeholder={DEFAULT_SERVER_URL}
          />
          {urlError && (
            <p className="mt-1 text-sm text-red-600" data-testid="url-error-message">
              {urlError}
            </p>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3">
          <button
            data-testid="lna-connect-button"
            onClick={handleConnect}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          >
            <div className="flex items-center justify-center gap-2">
              {getButtonIcon()}
              {getButtonLabel()}
            </div>
          </button>
          {lna.status !== 'skipped' && (
            <button
              data-testid="lna-skip-button"
              onClick={handleSkip}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <SkipForward className="w-4 h-4" />
                Skip
              </div>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderServerContent = () => {
    if (lna.status !== 'granted') {
      return <div className="text-sm text-gray-500 py-2">Server status will be checked once LNA connection is established.</div>;
    }

    if (lnaServer.status === 'pending-lna-ready') {
      return (
        <div className="flex items-center text-gray-500 py-2">
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
          <span>Checking server...</span>
        </div>
      );
    }

    if (lnaServer.status === 'ready') {
      return (
        <div className="flex items-center text-green-600 py-2">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <span>Server v{lnaServer.version} connected successfully</span>
        </div>
      );
    }

    // Server has issues - show guidance
    return (
      <div className="space-y-4">
        {lnaServer.status === 'setup' && (
          <>
            <div className="flex items-start text-amber-600">
              <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Server requires initial setup</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800 mb-2">Complete the server setup to continue.</p>
              <a
                href={getServerSetupUrl(lna.serverUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                data-testid="lna-server-setup-link"
              >
                Complete server setup
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}

        {lnaServer.status === 'resource_admin' && (
          <>
            <div className="flex items-start text-amber-600">
              <AlertTriangle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Server requires resource configuration</p>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800 mb-2">Configure server resources to continue.</p>
              <a
                href={getServerAdminUrl(lna.serverUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                data-testid="lna-server-admin-link"
              >
                Configure resources
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </>
        )}

        {lnaServer.status === 'error' && (
          <>
            <div className="flex items-start text-red-600">
              <XCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Server connection error</p>
                <p className="text-sm">{lnaServer.error.message}</p>
              </div>
            </div>
            <TroubleshootingBox
              items={[
                'Make sure the Bodhi App Server is running',
                "Check that your firewall isn't blocking the server",
                'Verify the server is running on the configured port',
                'Try restarting the server application',
              ]}
            />
          </>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" data-testid="lna-setup-step">
      <h2 className="text-xl font-semibold text-gray-900">Direct Connection</h2>

      {/* LNA Connection Accordion */}
      <Accordion
        isOpen={lnaOpen}
        onToggle={() => setLnaOpen(!lnaOpen)}
        icon={getLnaIcon()}
        label="LNA Connection"
        statusText={getLnaStatusLabel()}
        testId="lna-accordion-header"
        contentTestId="lna-accordion-content"
      >
        {renderLnaContent()}
      </Accordion>

      {/* Server Status Accordion */}
      <Accordion
        isOpen={serverOpen}
        onToggle={() => setServerOpen(!serverOpen)}
        icon={getServerIcon()}
        label="Server Status"
        statusText={getServerStatusLabel()}
        testId="lna-server-accordion-header"
        contentTestId="lna-server-status"
      >
        {renderServerContent()}
      </Accordion>
    </div>
  );
}
