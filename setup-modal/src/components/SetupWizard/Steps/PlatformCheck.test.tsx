import { PlatformCheck } from '@/components/SetupWizard/Steps/PlatformCheck';
import { createMockState, createUnsupportedPlatformState } from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import { useSetupModalStore } from '@/store/setup-modal-store';
import { beforeEach } from 'vitest';

describe('PlatformCheck - Platform Detection Display', () => {
  beforeEach(() => {
    useSetupModalStore.setState({
      setupState: undefined,
    });
  });
  describe('Browser Detection Scenarios', () => {
    const browserDetectionCases = [
      {
        name: 'supported browser (Chrome) shows supported status',
        state: createMockState({
          env: { browser: 'chrome', os: 'macos' },
        }),
        expectedBrowserName: 'Chrome',
        expectedBrowserStatus: 'Supported',
        expectedStatusColor: 'text-green-600 bg-green-50',
        shouldShowWarning: false,
      },
      {
        name: 'unsupported browser (Firefox) shows not supported status',
        state: createUnsupportedPlatformState('firefox', 'macos'),
        expectedBrowserName: 'Firefox',
        expectedBrowserStatus: 'Not Supported',
        expectedStatusColor: 'text-red-600 bg-red-50',
        shouldShowWarning: true,
        expectedWarningText: 'This browser is not supported by Bodhi Platform.',
      },
      {
        name: 'unknown browser shows not supported status',
        state: createMockState({
          env: { browser: 'unknown', os: 'macos' },
        }),
        expectedBrowserName: 'Unknown Browser',
        expectedBrowserStatus: 'Not Supported',
        expectedStatusColor: 'text-red-600 bg-red-50',
        shouldShowWarning: true,
        expectedWarningText: 'This browser is not supported by Bodhi Platform.',
      },
    ];

    test.each(browserDetectionCases)('should handle $name', ({ state, expectedBrowserName, expectedBrowserStatus, shouldShowWarning, expectedWarningText }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should show platform compatibility check title
      expect(screen.getByTestId('platform-check-title')).toHaveTextContent('Platform Compatibility Check');

      // Should show detected browser name
      expect(screen.getByTestId('browser-name')).toHaveTextContent(expectedBrowserName);
      expect(screen.getByTestId('browser-section-title')).toHaveTextContent('Detected Browser');

      // Should show correct browser status
      expect(screen.getByTestId('browser-status-text')).toHaveTextContent(expectedBrowserStatus);

      // Should show warning message for unsupported browsers
      if (shouldShowWarning && expectedWarningText) {
        expect(screen.getByTestId('browser-warning-text')).toHaveTextContent(expectedWarningText);
      }
    });
  });

  describe('OS Detection Scenarios', () => {
    const osDetectionCases = [
      {
        name: 'supported OS (macOS) shows supported status',
        state: createMockState({
          env: { browser: 'chrome', os: 'macos' },
        }),
        expectedOSName: 'macOS',
        expectedOSStatus: 'Supported',
        shouldShowWarning: false,
      },
      {
        name: 'unsupported OS (Linux) shows not supported status',
        state: createUnsupportedPlatformState('chrome', 'linux'),
        expectedOSName: 'Linux',
        expectedOSStatus: 'Not Supported',
        shouldShowWarning: true,
        expectedWarningText: 'This operating system is not supported by Bodhi Platform.',
      },
      {
        name: 'unknown OS shows not supported status',
        state: createMockState({
          env: { browser: 'chrome', os: 'unknown' },
        }),
        expectedOSName: 'Unknown OS',
        expectedOSStatus: 'Not Supported',
        shouldShowWarning: true,
        expectedWarningText: 'This operating system is not supported by Bodhi Platform.',
      },
    ];

    test.each(osDetectionCases)('should handle $name', ({ state, expectedOSName, expectedOSStatus, shouldShowWarning, expectedWarningText }) => {
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should show detected OS name
      expect(screen.getByTestId('os-name')).toHaveTextContent(expectedOSName);
      expect(screen.getByTestId('os-section-title')).toHaveTextContent('Detected Operating System');

      // Should show correct OS status
      expect(screen.getByTestId('os-status-text')).toHaveTextContent(expectedOSStatus);

      // Should show warning message for unsupported OS
      if (shouldShowWarning && expectedWarningText) {
        expect(screen.getByTestId('os-warning-text')).toHaveTextContent(expectedWarningText);
      }
    });
  });

  describe('GitHub Issue Links', () => {
    test('should show GitHub issue link for unsupported browser with github_issue_url', () => {
      const state = createUnsupportedPlatformState('firefox', 'macos');
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should show "Request support" link for Firefox
      const supportLink = screen.getByTestId('browser-support-link');
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'https://github.com/bodhi/issues/firefox-support');
    });

    test('should show GitHub issue link for unsupported OS with github_issue_url', () => {
      const state = createUnsupportedPlatformState('chrome', 'linux');
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should show "Request support" link for Linux
      const supportLink = screen.getByTestId('os-support-link');
      expect(supportLink).toBeInTheDocument();
      expect(supportLink).toHaveAttribute('href', 'https://github.com/bodhi/issues/linux-support');
    });

    test('should not show GitHub issue link for unknown platforms without github_issue_url', () => {
      const state = createMockState({
        env: { browser: 'unknown', os: 'unknown' },
      });
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should not show "Request support" link for unknown platforms
      expect(screen.queryByTestId('browser-support-link')).not.toBeInTheDocument();
      expect(screen.queryByTestId('os-support-link')).not.toBeInTheDocument();
    });
  });

  describe('Mixed Platform Support', () => {
    test('should handle supported browser with unsupported OS', () => {
      const state = createUnsupportedPlatformState('chrome', 'linux');
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Browser should show supported
      expect(screen.getByTestId('browser-name')).toHaveTextContent('Chrome');
      expect(screen.getByTestId('browser-status-text')).toHaveTextContent('Supported');

      // OS should show not supported
      expect(screen.getByTestId('os-name')).toHaveTextContent('Linux');
      expect(screen.getByTestId('os-status-text')).toHaveTextContent('Not Supported');

      // Should show OS warning but not browser warning
      expect(screen.getByTestId('os-warning-text')).toHaveTextContent('This operating system is not supported by Bodhi Platform.');
      expect(screen.queryByTestId('browser-warning-section')).not.toBeInTheDocument();
    });

    test('should handle unsupported browser with supported OS', () => {
      const state = createUnsupportedPlatformState('firefox', 'macos');
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Browser should show not supported
      expect(screen.getByTestId('browser-name')).toHaveTextContent('Firefox');
      expect(screen.getByTestId('browser-status-text')).toHaveTextContent('Not Supported');

      // OS should show supported
      expect(screen.getByTestId('os-name')).toHaveTextContent('macOS');
      expect(screen.getByTestId('os-status-text')).toHaveTextContent('Supported');

      // Should show browser warning but not OS warning
      expect(screen.getByTestId('browser-warning-text')).toHaveTextContent('This browser is not supported by Bodhi Platform.');
      expect(screen.queryByTestId('os-warning-section')).not.toBeInTheDocument();
    });
  });

  describe('Detection Reliability Warning', () => {
    test('should always show "Detection can be unreliable" warning', () => {
      const state = createMockState();
      useSetupModalStore.setState({ setupState: state });
      render(<PlatformCheck />);

      // Should show reliability warning for both browser and OS
      expect(screen.getByTestId('browser-reliability-warning')).toHaveTextContent('Detection can be unreliable');
      expect(screen.getByTestId('os-reliability-warning')).toHaveTextContent('Detection can be unreliable');
    });
  });
});
