import { CheckCircle, ExternalLink, XCircle } from 'lucide-react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { selectDetectedBrowser, selectDetectedOS, selectIsBrowserSupported, selectIsOSSupported, selectBrowserName, selectOSName } from '@/store/selectors';
import { getBrowserIcon, getOSIcon } from '@/lib/platform-icons';

export function PlatformCheck() {
  const setupState = useSetupModalStore(state => state.setupState);
  const detectedBrowser = useSetupModalStore(selectDetectedBrowser);
  const detectedOS = useSetupModalStore(selectDetectedOS);
  const isBrowserSupported = useSetupModalStore(selectIsBrowserSupported);
  const isOSSupported = useSetupModalStore(selectIsOSSupported);
  const browserName = useSetupModalStore(selectBrowserName);
  const osName = useSetupModalStore(selectOSName);

  const { env } = setupState!;

  const getBrowserStatusColor = () => {
    if (isBrowserSupported) return 'text-green-600 bg-green-50';
    if (detectedBrowser?.status === 'not-supported') return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  const getOSStatusColor = () => {
    if (isOSSupported) return 'text-green-600 bg-green-50';
    if (detectedOS?.status === 'not-supported') return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  const getBrowserStatusText = () => {
    if (isBrowserSupported) return 'Supported';
    return 'Not Supported'; // Treat all non-supported as not supported
  };

  const getOSStatusText = () => {
    if (isOSSupported) return 'Supported';
    return 'Not Supported'; // Treat all non-supported as not supported
  };

  return (
    <div className="space-y-6" data-testid="platform-check-step">
      <div className="text-center" data-testid="platform-check-header">
        <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="platform-check-title">
          Platform Compatibility Check
        </h3>
        <p className="text-gray-600" data-testid="platform-check-description">
          Verifying your browser and operating system compatibility
        </p>
      </div>

      {/* Detected Browser */}
      <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="browser-detection-section">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0" data-testid="browser-icon">
              {getBrowserIcon(env.browser)}
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900" data-testid="browser-section-title">
                Detected Browser
              </h4>
              <p className="text-sm text-gray-500" data-testid="browser-name">
                {browserName}
              </p>
              <p className="text-xs text-gray-400 mt-1" data-testid="browser-reliability-warning">
                Detection can be unreliable
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getBrowserStatusColor()}`} data-testid="browser-status-badge">
              {isBrowserSupported ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  <span data-testid="browser-status-text">{getBrowserStatusText()}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  <span data-testid="browser-status-text">{getBrowserStatusText()}</span>
                </>
              )}
            </span>
          </div>
        </div>
        {!isBrowserSupported && (
          <div className={`mt-3 p-3 rounded-md ${detectedBrowser?.status === 'not-supported' ? 'bg-red-50' : 'bg-amber-50'}`} data-testid="browser-warning-section">
            <p className={`text-sm ${detectedBrowser?.status === 'not-supported' ? 'text-red-800' : 'text-amber-800'}`} data-testid="browser-warning-text">
              {detectedBrowser?.status === 'not-supported'
                ? 'This browser is not supported by Bodhi Platform.'
                : "We couldn't detect your browser reliably. Your browser might still be supported - try proceeding with setup."}
              {detectedBrowser?.status === 'not-supported' && detectedBrowser.github_issue_url && (
                <>
                  {' '}
                  <a
                    href={detectedBrowser.github_issue_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center underline ${detectedBrowser?.status === 'not-supported' ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}
                    data-testid="browser-support-link"
                  >
                    Request support <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Detected Operating System */}
      <div className="bg-white rounded-lg border border-gray-200 p-4" data-testid="os-detection-section">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex-shrink-0" data-testid="os-icon">
              {getOSIcon(env.os)}
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-gray-900" data-testid="os-section-title">
                Detected Operating System
              </h4>
              <p className="text-sm text-gray-500" data-testid="os-name">
                {osName}
              </p>
              <p className="text-xs text-gray-400 mt-1" data-testid="os-reliability-warning">
                Detection can be unreliable
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getOSStatusColor()}`} data-testid="os-status-badge">
              {isOSSupported ? (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  <span data-testid="os-status-text">{getOSStatusText()}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-3 h-3 mr-1" />
                  <span data-testid="os-status-text">{getOSStatusText()}</span>
                </>
              )}
            </span>
          </div>
        </div>
        {!isOSSupported && (
          <div className={`mt-3 p-3 rounded-md ${detectedOS?.status === 'not-supported' ? 'bg-red-50' : 'bg-amber-50'}`} data-testid="os-warning-section">
            <p className={`text-sm ${detectedOS?.status === 'not-supported' ? 'text-red-800' : 'text-amber-800'}`} data-testid="os-warning-text">
              {detectedOS?.status === 'not-supported'
                ? 'This operating system is not supported by Bodhi Platform.'
                : "We couldn't detect your OS reliably. Your operating system might still be supported - try proceeding with setup."}
              {detectedOS?.status === 'not-supported' && detectedOS.github_issue_url && (
                <>
                  {' '}
                  <a
                    href={detectedOS.github_issue_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center underline ${detectedOS?.status === 'not-supported' ? 'text-red-700 hover:text-red-900' : 'text-amber-700 hover:text-amber-900'}`}
                    data-testid="os-support-link"
                  >
                    Request support <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
