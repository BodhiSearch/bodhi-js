import { PlatformDropdown } from '@/components/common/PlatformDropdown';
import { Accordion } from '@/components/common/Accordion';
import { TroubleshootingBox } from '@/components/common/TroubleshootingBox';
import { DEFAULT_SERVER_URL, getServerSetupUrl, getServerAdminUrl } from '@/lib/constants';
import { BrowserType } from '@/types';
import { isSupportedBrowser, isNotSupportedBrowser } from '@/types/type-guards';
import { AlertCircle, CheckCircle2, Copy, ExternalLink } from 'lucide-react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { selectEffectiveBrowser } from '@/store/selectors';
import { useEffect, useState } from 'react';

export function ExtensionSetup() {
  const setupState = useSetupModalStore(state => state.setupState);
  const extensionOpen = useSetupModalStore(state => state.ui.extensionStep.extensionAccordionOpen);
  const serverOpen = useSetupModalStore(state => state.ui.extensionStep.serverAccordionOpen);
  const setBrowserOverride = useSetupModalStore(state => state.setBrowserOverride);
  const setExtensionOpen = useSetupModalStore(state => state.setExtensionAccordionOpen);
  const setServerOpen = useSetupModalStore(state => state.setExtensionServerAccordionOpen);
  const selectedBrowser = useSetupModalStore(selectEffectiveBrowser);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const { extension, server, env, browsers } = setupState!;

  const setSelectedBrowser = (browser: BrowserType) => {
    setBrowserOverride(browser);
  };

  // UX: Auto-expand accordions to guide users through sequential setup
  // Opens extension section first, then server section once extension is ready
  // Implements progressive disclosure to avoid overwhelming users
  useEffect(() => {
    if (extension.status !== 'ready') {
      setExtensionOpen(true);
      setServerOpen(false);
    } else {
      setExtensionOpen(false);
      if (server.status !== 'ready' && server.status !== 'pending-extension-ready') {
        setServerOpen(true);
      }
    }
  }, [extension.status, server.status, setExtensionOpen, setServerOpen]);

  const selectedBrowserData = browsers.find(b => b.id === selectedBrowser);

  const handleCopyUrl = async () => {
    const targetBrowser = browsers.find(b => b.id === selectedBrowser);
    if (targetBrowser && isSupportedBrowser(targetBrowser)) {
      try {
        await navigator.clipboard.writeText(targetBrowser.extension_url);
        setCopyStatus('copied');
        setTimeout(() => setCopyStatus('idle'), 2000);
      } catch {
        setCopyStatus('failed');
        setTimeout(() => setCopyStatus('idle'), 4000);
      }
    }
  };

  const handleViewGitHubIssue = () => {
    const targetBrowser = browsers.find(b => b.id === selectedBrowser);
    if (targetBrowser && isNotSupportedBrowser(targetBrowser) && targetBrowser.github_issue_url) {
      window.open(targetBrowser.github_issue_url, '_blank', 'noopener');
    }
  };

  const renderExtensionContent = () => {
    return (
      <div className="space-y-4">
        {/* Extension status message */}
        {extension.status === 'ready' ? (
          <div className="flex items-center text-green-600 py-2">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span>Extension version {extension.version} is connected and ready.</span>
          </div>
        ) : (
          <div className="flex items-start text-amber-600 py-2">
            <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium" data-testid="p-ext-error-message">
                {extension.error.message}
              </p>
              <p className="text-sm text-gray-500" data-testid="p-ext-error-code">
                Error Code: {extension.error.code}
              </p>
            </div>
          </div>
        )}

        {/* Browser selection dropdown */}
        <div data-testid="browser-selection-section">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Browser (for extension store link)</label>
          <PlatformDropdown type="browser" value={selectedBrowser} supportedOptions={browsers} onChange={browser => setSelectedBrowser(browser as BrowserType)} />
          <p className="mt-1 text-xs text-gray-500">
            Auto-selected: {browsers.find(b => b.id === env.browser)?.name || 'Unknown Browser'}. Change selection to view other browser options.
          </p>
        </div>

        {/* Installation Actions */}
        {selectedBrowserData?.status === 'supported' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <input
                type="text"
                readOnly
                value={selectedBrowserData.extension_url}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-50 cursor-pointer select-all focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={e => e.currentTarget.select()}
              />
              <button
                onClick={handleCopyUrl}
                className={`w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  copyStatus === 'copied' ? 'bg-green-600 hover:bg-green-700' : copyStatus === 'failed' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Copy className="w-4 h-4 mr-2" />
                {copyStatus === 'copied'
                  ? 'Copied!'
                  : copyStatus === 'failed'
                    ? 'Copy failed, select above text and copy manually'
                    : `Copy Extension URL for ${selectedBrowserData.name}`}
              </button>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Installation Instructions for {selectedBrowserData.name}</h5>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Copy the URL above and open it in a new tab</li>
                <li>Click "Add to {selectedBrowserData.name}" or "Install"</li>
                <li>Accept the permissions when prompted</li>
                <li>Look for the Bodhi icon in your browser toolbar</li>
                <li>Refresh this page and open this setup window again</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start">
                <div className="ml-3">
                  <h5 className="text-sm font-medium text-amber-900">{selectedBrowserData?.name || 'Selected Browser'} - Coming Soon</h5>
                  <p className="mt-1 text-sm text-amber-800">Support for {selectedBrowserData?.name || 'this browser'} is in development.</p>
                  {selectedBrowserData?.github_issue_url && (
                    <button onClick={handleViewGitHubIssue} className="mt-2 inline-flex items-center text-sm text-amber-700 hover:text-amber-900">
                      Track Progress <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting for extension */}
        {extension.status !== 'ready' && (
          <TroubleshootingBox
            items={[
              "Make sure you're using a supported browser version",
              'Check that the extension is enabled in your browser settings',
              'Try refreshing this page after installing the extension',
              "Restart your browser if the extension isn't detected",
            ]}
          />
        )}
      </div>
    );
  };

  const renderServerContent = () => {
    if (extension.status !== 'ready') {
      return <div className="text-sm text-gray-500 py-2">Server connection will be verified once extension is installed.</div>;
    }

    if (server.status === 'ready') {
      return (
        <div className="flex items-center text-green-600 py-2">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          <span>Server v{server.version} connected successfully</span>
        </div>
      );
    }

    // Server has issues - show troubleshooting
    return (
      <div className="space-y-4">
        <div className="flex items-start text-amber-600">
          <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium" data-testid="p-server-error-message">
              {server.error?.message || 'Server connection failed'}
            </p>
            {server.error?.code && (
              <p className="text-sm text-gray-500" data-testid="p-server-error-code">
                Error: {server.error.code}
              </p>
            )}
          </div>
        </div>

        {/* State-specific guidance */}
        {server.status === 'setup' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800 mb-2">Server needs initial configuration.</p>
            <a href={getServerSetupUrl(DEFAULT_SERVER_URL)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              Open Server Setup →
            </a>
          </div>
        )}

        {server.status === 'resource_admin' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-sm text-blue-800 mb-2">Server requires admin approval.</p>
            <a href={getServerAdminUrl(DEFAULT_SERVER_URL)} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
              Open Admin Panel →
            </a>
          </div>
        )}

        {(server.status === 'unreachable' || server.status === 'error') && (
          <TroubleshootingBox
            items={[
              'Make sure the Bodhi App Server is running',
              "Check that your firewall isn't blocking the server",
              'Verify the server is running on port 1135',
              'Try restarting the server application',
            ]}
          />
        )}
      </div>
    );
  };

  const getExtensionStatusLabel = () => {
    if (extension.status === 'ready') return 'Ready';
    return 'Action Required';
  };

  const getExtensionIcon = () => {
    return extension.status === 'ready' ? <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" /> : <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />;
  };

  const getServerIcon = () => {
    if (server.status === 'ready') {
      return <CheckCircle2 className="w-5 h-5 text-green-500 mr-2" />;
    } else if (extension.status !== 'ready') {
      return <span className="w-5 h-5 mr-2 text-gray-400 flex items-center justify-center">—</span>;
    } else {
      return <AlertCircle className="w-5 h-5 text-amber-500 mr-2" />;
    }
  };

  const getServerStatusLabel = () => {
    if (server.status === 'ready') return 'Connected';
    if (extension.status !== 'ready') return 'Pending Extension';
    return 'Action Required';
  };

  return (
    <div className="space-y-4" data-testid="extension-setup-step">
      {/* Extension Installation Accordion */}
      <Accordion
        isOpen={extensionOpen}
        onToggle={() => setExtensionOpen(!extensionOpen)}
        icon={getExtensionIcon()}
        label="Extension Installation"
        statusText={getExtensionStatusLabel()}
        testId="extension-accordion-header"
        contentTestId="extension-accordion-content"
      >
        {renderExtensionContent()}
      </Accordion>

      {/* Server Status Accordion */}
      <Accordion
        isOpen={serverOpen}
        onToggle={() => setServerOpen(!serverOpen)}
        icon={getServerIcon()}
        label="Server Status"
        statusText={getServerStatusLabel()}
        testId="server-accordion-header"
        contentTestId="server-accordion-content"
      >
        {renderServerContent()}
      </Accordion>
    </div>
  );
}
