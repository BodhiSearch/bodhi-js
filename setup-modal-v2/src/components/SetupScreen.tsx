import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { SetupStateV2, MessageTypeV2, RequestPayloadV2, ResponsePayloadV2 } from '@/types';
import { CLOUD_URL, DEFAULT_LOCAL_URL, INSTALL_URL } from '@/types';

interface SetupScreenProps {
  setupState: SetupStateV2;
  sendMessage: <T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>) => Promise<ResponsePayloadV2<T>>;
}

export function SetupScreen({ setupState, sendMessage }: SetupScreenProps) {
  const [serverUrl, setServerUrl] = useState(setupState.serverUrl || DEFAULT_LOCAL_URL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevServerUrlRef = useRef(setupState.serverUrl);

  useEffect(() => {
    if (setupState.serverUrl !== prevServerUrlRef.current) {
      setServerUrl(setupState.serverUrl);
      prevServerUrlRef.current = setupState.serverUrl;
    }
  }, [setupState.serverUrl]);

  const isCloud = serverUrl === CLOUD_URL;
  const { probeStatus, browser } = setupState;

  const handleRadioInstall = async () => {
    setServerUrl(DEFAULT_LOCAL_URL);
    setIsSubmitting(true);
    try {
      await sendMessage('modal:probe', { serverUrl: DEFAULT_LOCAL_URL });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRadioCloud = async () => {
    setServerUrl(CLOUD_URL);
    setIsSubmitting(true);
    try {
      await sendMessage('modal:probe', { serverUrl: CLOUD_URL });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConnect = async () => {
    setIsSubmitting(true);
    try {
      await sendMessage('modal:probe', { serverUrl });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsSubmitting(true);
    try {
      await sendMessage('modal:probe', { serverUrl });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    sendMessage('modal:complete', undefined).catch(err => {
      console.error('[SetupScreen] modal:complete failed:', err);
    });
  };

  const statusMessages: Record<string, string> = {
    setup: 'Bodhi is running but needs initial setup.',
    resource_admin: 'Bodhi needs an admin user configured.',
    error: 'Bodhi returned an error during status check.',
  };

  return (
    <div className="flex flex-col px-5 py-4" data-testid="div-setup-screen">
      {/* Title */}
      <p className="text-sm font-medium text-gray-700 mb-3">Choose how to connect:</p>

      {/* Unsupported browser warning */}
      {!browser.supported && (
        <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg" data-testid="div-unsupported-banner">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-amber-700" data-testid="text-unsupported-message">
              {browser.name !== 'unknown' ? browser.name : 'This browser'}
              {browser.version > 0 ? ` ${browser.version}` : ''} doesn't support Local Network Access. Use Chrome 130+ or Edge 143+ to
              connect locally, or sign up for a cloud account.
            </p>
          </div>
        </div>
      )}

      {/* Radio group — side by side */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {/* Install locally */}
        <label
          className={`flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
            !isCloud ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
          }`}
          data-testid="radio-install-local"
        >
          <input type="radio" name="connection-type" checked={!isCloud} onChange={handleRadioInstall} className="mt-0.5 accent-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900">Install locally</div>
            <div className="text-[11px] text-gray-500">Private, on your hardware</div>
            <a
              href={INSTALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-800 mt-0.5"
              data-testid="link-install-external"
              onClick={e => e.stopPropagation()}
            >
              getbodhi.app <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
            </a>
          </div>
        </label>

        {/* Sign up on cloud */}
        <label
          className={`flex items-start gap-2 p-2.5 border rounded-lg cursor-pointer transition-colors ${
            isCloud ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'
          }`}
          data-testid="radio-signup-cloud"
        >
          <input type="radio" name="connection-type" checked={isCloud} onChange={handleRadioCloud} className="mt-0.5 accent-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-gray-900">Sign up on cloud</div>
            <div className="text-[11px] text-gray-500">Free tier, no install</div>
            <a
              href={CLOUD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-[11px] text-blue-600 hover:text-blue-800 mt-0.5"
              data-testid="link-signup-external"
              onClick={e => e.stopPropagation()}
            >
              cloud.getbodhi.app <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
            </a>
          </div>
        </label>
      </div>

      {/* Server URL */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 mb-1" htmlFor="server-url-input">
          Server URL
        </label>
        <div className="flex gap-2">
          <input
            id="server-url-input"
            type="url"
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={DEFAULT_LOCAL_URL}
            data-testid="input-server-url"
          />
          <button
            onClick={handleConnect}
            disabled={isSubmitting || !serverUrl}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50"
            data-testid="btn-connect"
          >
            {isSubmitting && probeStatus === 'probing' ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
            )}
            {isSubmitting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>

      {/* Status row — left-aligned */}
      {probeStatus === 'probing' && (
        <div className="flex items-center gap-2 py-2" data-testid="row-probe-status">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-blue-800" data-testid="text-probe-status-message">
            Checking {setupState.serverUrl}…
          </p>
        </div>
      )}

      {probeStatus === 'connected' && (
        <div className="flex items-center gap-2 py-2" data-testid="row-probe-status">
          <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-green-800" data-testid="text-probe-status-message">
            Server is connected
          </p>
        </div>
      )}

      {probeStatus === 'not-ready' && (
        <div className="py-2" data-testid="row-probe-status">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
              <p className="text-sm text-amber-800" data-testid="text-probe-status-message">
                {statusMessages[setupState.serverStatus ?? 'error'] ?? 'Bodhi server is not ready.'}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-800 bg-amber-100 rounded-md hover:bg-amber-200 disabled:opacity-50 flex-shrink-0 ml-2"
              data-testid="btn-refresh"
            >
              <RefreshCw className={`w-3 h-3 ${isSubmitting ? 'animate-spin' : ''}`} aria-hidden="true" />
              Refresh
            </button>
          </div>
          <a
            href={setupState.serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 underline ml-6 mt-1 inline-block"
            data-testid="link-open-server-url"
          >
            Open {setupState.serverUrl}
          </a>
        </div>
      )}

      {probeStatus === 'error' && (
        <div className="flex items-center gap-2 py-2" data-testid="row-probe-status">
          <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-800" data-testid="text-probe-status-message">
            {setupState.error?.message ?? 'Server returned an error.'}
          </p>
        </div>
      )}

      {probeStatus === 'network-error' && (
        <div className="py-2" data-testid="row-probe-status">
          <div className="flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm text-red-800" data-testid="text-probe-status-message">
              {setupState.error?.message ?? "Couldn't reach server."}
            </p>
          </div>
          {!browser.supported && setupState.serverUrl.includes('localhost') && (
            <p className="text-xs text-red-600 mt-1 ml-6" data-testid="text-lna-hint">
              Your browser may not support Local Network Access for localhost connections.
            </p>
          )}
        </div>
      )}

      {/* Continue button — always visible, green when connected, neutral otherwise */}
      <div className="flex justify-center pt-3">
        <button
          onClick={handleContinue}
          className={`px-6 py-2 text-sm font-medium rounded-md ${
            probeStatus === 'connected' ? 'text-white bg-green-600 hover:bg-green-700' : 'text-gray-700 bg-gray-200 hover:bg-gray-300'
          }`}
          data-testid="btn-continue"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
