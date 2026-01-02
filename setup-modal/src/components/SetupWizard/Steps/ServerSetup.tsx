import { PlatformDropdown } from '@/components/common/PlatformDropdown';
import { OSType } from '@/types';
import { isSupportedOS, isNotSupportedOS } from '@/types/type-guards';
import { Download, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { selectEffectiveOS } from '@/store/selectors';

export function ServerSetup() {
  const setupState = useSetupModalStore(state => state.setupState);
  const setOSOverride = useSetupModalStore(state => state.setOSOverride);
  const sendMessage = useSetupModalStore(state => state.sendMessage);
  const selectedOS = useSetupModalStore(selectEffectiveOS);

  const { env, os: osArray } = setupState!;

  // Reset OS override when detected OS changes
  // Override is temporary UI state - should reset when platform detection updates
  useEffect(() => {
    setOSOverride(null);
  }, [env.os, setOSOverride]);

  const setSelectedOS = (os: OSType) => {
    setOSOverride(os);
  };

  const selectedOSData = osArray.find(o => o.id === selectedOS);

  const handleDownloadServer = () => {
    const targetOS = osArray.find(o => o.id === selectedOS);
    if (targetOS && isSupportedOS(targetOS)) {
      window.open(targetOS.download_url, '_blank');
    }
  };

  const handleViewGitHubIssue = () => {
    const targetOS = osArray.find(o => o.id === selectedOS);
    if (targetOS && isNotSupportedOS(targetOS) && targetOS.github_issue_url) {
      window.open(targetOS.github_issue_url, '_blank');
    }
  };

  return (
    <div className="space-y-6 min-h-0" data-testid="server-setup-step">
      <div className="bg-gray-50 p-4 rounded-lg min-h-0">
        {/* OS selection dropdown */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Operating System (for server download)</label>
          <PlatformDropdown type="os" value={selectedOS} supportedOptions={osArray} onChange={os => setSelectedOS(os as OSType)} />
          <p className="mt-1 text-xs text-gray-500">Auto-selected: {osArray.find(o => o.id === env.os)?.name || 'Unknown OS'}. Change selection to view other OS options.</p>
        </div>

        {/* Installation Actions */}
        {selectedOSData?.status === 'supported' ? (
          <div className="space-y-4">
            <button
              onClick={handleDownloadServer}
              className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Bodhi App Server for {selectedOSData.name}
            </button>

            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-blue-900 mb-2">Installation Instructions for {selectedOSData.name}</h5>
              <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                <li>Click the download button above to get the installer</li>
                <li>Run the downloaded installer</li>
                <li>Follow the installation wizard</li>
                <li>Launch the Bodhi App Server</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <div className="flex items-start">
                <div className="ml-3">
                  <h5 className="text-sm font-medium text-amber-900">{selectedOSData?.name || 'Selected OS'} - Coming Soon</h5>
                  <p className="mt-1 text-sm text-amber-800">Support for {selectedOSData?.name || 'this operating system'} is in development.</p>
                  {selectedOSData?.github_issue_url && (
                    <button onClick={handleViewGitHubIssue} className="mt-2 inline-flex items-center text-sm text-amber-700 hover:text-amber-900">
                      Track Progress <ExternalLink className="w-3 h-3 ml-1" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Server installation confirmation */}
        <div className="mt-6 p-4 bg-white border border-gray-200 rounded-lg">
          <label className="flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={setupState.userConfirmations?.serverInstall ?? false}
              onChange={e => {
                sendMessage('modal:confirm-server-install', { confirmed: e.target.checked }).catch(err => {
                  console.error('[ServerSetup] Confirm server install failed:', err);
                });
              }}
              className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
              data-testid="server-confirm-checkbox"
            />
            <span className="ml-3 text-sm font-medium text-gray-700">I have installed the Bodhi App Server</span>
          </label>
        </div>
      </div>
    </div>
  );
}
