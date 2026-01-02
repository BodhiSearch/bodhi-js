import { PlatformDropdown } from '@/components/common/PlatformDropdown';
import { createSupportedBrowser, createNotSupportedBrowser, createSupportedOS, createNotSupportedOS } from '@/test/mock-factories';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

describe('PlatformDropdown - Dropdown Toggle', () => {
  test('should open dropdown on button click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    // Dropdown should not be visible initially
    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('browser-dropdown'));

    // Dropdown should be visible after click
    expect(screen.getByTestId('browser-option-chrome')).toBeInTheDocument();
    expect(screen.getByTestId('browser-option-edge')).toBeInTheDocument();
  });

  test('should close dropdown on button click when already open', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    // Open dropdown
    await user.click(screen.getByTestId('browser-dropdown'));
    expect(screen.getByTestId('browser-option-chrome')).toBeInTheDocument();

    // Close dropdown
    await user.click(screen.getByTestId('browser-dropdown'));
    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();
  });

  test('should close dropdown on outside click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store')];

    render(
      <div>
        <div data-testid="outside">Outside</div>
        <PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />
      </div>
    );

    // Open dropdown
    await user.click(screen.getByTestId('browser-dropdown'));
    expect(screen.getByTestId('browser-option-chrome')).toBeInTheDocument();

    // Click outside
    await user.click(screen.getByTestId('outside'));
    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();
  });
});

describe('PlatformDropdown - Option Selection', () => {
  test('should call onChange with correct value when option is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));
    await user.click(screen.getByTestId('browser-option-edge'));

    expect(onChange).toHaveBeenCalledWith('edge');
  });

  test('should close dropdown after option click', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));
    await user.click(screen.getByTestId('browser-option-edge'));

    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();
  });
});

describe('PlatformDropdown - Selected Option Highlighting', () => {
  test('should highlight selected browser option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));

    const chromeOption = screen.getByTestId('browser-option-chrome');
    const edgeOption = screen.getByTestId('browser-option-edge');

    expect(chromeOption).toHaveClass('bg-blue-50', 'text-blue-900');
    expect(edgeOption).toHaveClass('text-gray-900');
    expect(edgeOption).not.toHaveClass('bg-blue-50');
  });

  test('should show checkmark icon on selected option', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));

    const chromeOption = screen.getByTestId('browser-option-chrome');
    // Select the checkmark icon in the right-side span, not the platform icon
    const checkmarkSpan = chromeOption.querySelector('span.absolute');
    const checkmark = checkmarkSpan?.querySelector('svg');

    expect(checkmark).toBeInTheDocument();
    expect(checkmark).toHaveClass('h-5', 'w-5');
  });
});

describe('PlatformDropdown - Coming Soon Label', () => {
  test('should show Coming Soon label for unsupported browser', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createNotSupportedBrowser('firefox', 'Firefox', 'https://github.com/issue')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));

    const firefoxOption = screen.getByTestId('browser-option-firefox');
    expect(firefoxOption).toHaveTextContent('Coming Soon');
  });

  test('should not show Coming Soon label for supported browser', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createSupportedBrowser('edge', 'Edge', 'https://edge.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} />);

    await user.click(screen.getByTestId('browser-dropdown'));

    const chromeOption = screen.getByTestId('browser-option-chrome');
    expect(chromeOption).not.toHaveTextContent('Coming Soon');
  });

  test('should show Coming Soon in button for unsupported selected option', () => {
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store'), createNotSupportedBrowser('firefox', 'Firefox', 'https://github.com/issue')];

    render(<PlatformDropdown type="browser" value="firefox" supportedOptions={browsers} onChange={onChange} />);

    const button = screen.getByTestId('browser-dropdown');
    expect(button).toHaveTextContent('Firefox');
    expect(button).toHaveTextContent('Coming Soon');
  });
});

describe('PlatformDropdown - Disabled State', () => {
  test('should not open dropdown when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} disabled={true} />);

    await user.click(screen.getByTestId('browser-dropdown'));

    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();
  });

  test('should apply disabled styling', () => {
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store')];

    render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} disabled={true} />);

    const button = screen.getByTestId('browser-dropdown');
    expect(button).toHaveClass('bg-gray-50', 'text-gray-500', 'cursor-not-allowed');
    expect(button).toBeDisabled();
  });

  test('should not render dropdown when disabled even if opened before', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const browsers = [createSupportedBrowser('chrome', 'Chrome', 'https://chrome.store')];

    const { rerender } = render(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} disabled={false} />);

    // Open dropdown when enabled
    await user.click(screen.getByTestId('browser-dropdown'));
    expect(screen.getByTestId('browser-option-chrome')).toBeInTheDocument();

    // Disable dropdown
    rerender(<PlatformDropdown type="browser" value="chrome" supportedOptions={browsers} onChange={onChange} disabled={true} />);

    // Dropdown should not be visible when disabled
    expect(screen.queryByTestId('browser-option-chrome')).not.toBeInTheDocument();
  });
});

describe('PlatformDropdown - OS Type', () => {
  test('should render OS dropdown correctly', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const osList = [createSupportedOS('macos', 'macOS', 'https://macos.download'), createSupportedOS('windows', 'Windows', 'https://windows.download')];

    render(<PlatformDropdown type="os" value="macos" supportedOptions={osList} onChange={onChange} />);

    expect(screen.getByTestId('os-dropdown')).toBeInTheDocument();
    expect(screen.getByText('macOS')).toBeInTheDocument();

    await user.click(screen.getByTestId('os-dropdown'));

    expect(screen.getByTestId('os-option-macos')).toBeInTheDocument();
    expect(screen.getByTestId('os-option-windows')).toBeInTheDocument();
  });

  test('should call onChange with OS value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const osList = [createSupportedOS('macos', 'macOS', 'https://macos.download'), createSupportedOS('windows', 'Windows', 'https://windows.download')];

    render(<PlatformDropdown type="os" value="macos" supportedOptions={osList} onChange={onChange} />);

    await user.click(screen.getByTestId('os-dropdown'));
    await user.click(screen.getByTestId('os-option-windows'));

    expect(onChange).toHaveBeenCalledWith('windows');
  });

  test('should show Coming Soon for unsupported OS', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const osList = [createSupportedOS('macos', 'macOS', 'https://macos.download'), createNotSupportedOS('linux', 'Linux', 'https://github.com/issue')];

    render(<PlatformDropdown type="os" value="macos" supportedOptions={osList} onChange={onChange} />);

    await user.click(screen.getByTestId('os-dropdown'));

    const linuxOption = screen.getByTestId('os-option-linux');
    expect(linuxOption).toHaveTextContent('Coming Soon');
  });
});
