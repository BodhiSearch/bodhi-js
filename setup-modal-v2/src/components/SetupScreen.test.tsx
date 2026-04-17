import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetupScreen } from './SetupScreen';
import type { SetupStateV2, MessageTypeV2, RequestPayloadV2, ResponsePayloadV2 } from '@/types';
import { DEFAULT_LOCAL_URL, CLOUD_URL } from '@/types';

type SendMessage = <T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>) => Promise<ResponsePayloadV2<T>>;

const baseState = (overrides: Partial<SetupStateV2> = {}): SetupStateV2 => ({
  probeStatus: 'idle',
  serverUrl: DEFAULT_LOCAL_URL,
  browser: { name: 'chrome', version: 142, supported: true },
  ...overrides,
});

let mockSend: SendMessage;

beforeEach(() => {
  mockSend = vi.fn().mockResolvedValue(undefined) as unknown as SendMessage;
});

describe('SetupScreen', () => {
  it('renders install radio selected when serverUrl is localhost', () => {
    render(<SetupScreen setupState={baseState()} sendMessage={mockSend} />);
    const installRadio = screen.getByTestId('radio-install-local').querySelector('input[type="radio"]') as HTMLInputElement;
    const cloudRadio = screen.getByTestId('radio-signup-cloud').querySelector('input[type="radio"]') as HTMLInputElement;
    expect(installRadio.checked).toBe(true);
    expect(cloudRadio.checked).toBe(false);
  });

  it('renders cloud radio selected when serverUrl is cloud URL', () => {
    render(<SetupScreen setupState={baseState({ serverUrl: CLOUD_URL })} sendMessage={mockSend} />);
    const cloudRadio = screen.getByTestId('radio-signup-cloud').querySelector('input[type="radio"]') as HTMLInputElement;
    expect(cloudRadio.checked).toBe(true);
  });

  it('clicking install radio fires modal:probe with localhost URL', () => {
    render(<SetupScreen setupState={baseState({ serverUrl: CLOUD_URL })} sendMessage={mockSend} />);
    fireEvent.click(screen.getByTestId('radio-install-local'));
    expect(mockSend).toHaveBeenCalledWith('modal:probe', { serverUrl: DEFAULT_LOCAL_URL });
  });

  it('clicking cloud radio fires modal:probe with cloud URL', () => {
    render(<SetupScreen setupState={baseState()} sendMessage={mockSend} />);
    fireEvent.click(screen.getByTestId('radio-signup-cloud'));
    expect(mockSend).toHaveBeenCalledWith('modal:probe', { serverUrl: CLOUD_URL });
  });

  it('install external link opens getbodhi.app', () => {
    render(<SetupScreen setupState={baseState()} sendMessage={mockSend} />);
    const link = screen.getByTestId('link-install-external');
    expect(link).toHaveAttribute('href', 'https://getbodhi.app');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('cloud external link opens cloud.getbodhi.app', () => {
    render(<SetupScreen setupState={baseState()} sendMessage={mockSend} />);
    const link = screen.getByTestId('link-signup-external');
    expect(link).toHaveAttribute('href', CLOUD_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('editing URL and clicking Connect fires modal:probe with typed URL', () => {
    render(<SetupScreen setupState={baseState()} sendMessage={mockSend} />);
    const input = screen.getByTestId('input-server-url');
    fireEvent.change(input, { target: { value: 'http://myserver:8080' } });
    fireEvent.click(screen.getByTestId('btn-connect'));
    expect(mockSend).toHaveBeenCalledWith('modal:probe', { serverUrl: 'http://myserver:8080' });
  });

  it('probing status shows spinner', () => {
    render(<SetupScreen setupState={baseState({ probeStatus: 'probing' })} sendMessage={mockSend} />);
    expect(screen.getByTestId('row-probe-status')).toBeInTheDocument();
    expect(screen.getByTestId('text-probe-status-message').textContent).toContain('Checking');
  });

  it('connected status shows green Continue button', () => {
    render(<SetupScreen setupState={baseState({ probeStatus: 'connected', serverStatus: 'ready' })} sendMessage={mockSend} />);
    expect(screen.getByTestId('text-probe-status-message').textContent).toContain('connected');
    const btn = screen.getByTestId('btn-continue');
    expect(btn.className).toContain('bg-green-600');
    fireEvent.click(btn);
    expect(mockSend).toHaveBeenCalledWith('modal:complete', undefined);
  });

  it('Continue button always visible, neutral when not connected', () => {
    render(<SetupScreen setupState={baseState({ probeStatus: 'idle' })} sendMessage={mockSend} />);
    const btn = screen.getByTestId('btn-continue');
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain('bg-gray-200');
  });

  it('not-ready status shows message and Refresh button', () => {
    render(<SetupScreen setupState={baseState({ probeStatus: 'not-ready', serverStatus: 'setup' })} sendMessage={mockSend} />);
    expect(screen.getByTestId('text-probe-status-message').textContent).toMatch(/needs initial setup/i);
    expect(screen.getByTestId('btn-refresh')).toBeInTheDocument();
    expect(screen.getByTestId('link-open-server-url')).toBeInTheDocument();
  });

  it('clicking Refresh fires modal:probe with current URL', () => {
    render(<SetupScreen setupState={baseState({ probeStatus: 'not-ready', serverStatus: 'setup' })} sendMessage={mockSend} />);
    fireEvent.click(screen.getByTestId('btn-refresh'));
    expect(mockSend).toHaveBeenCalledWith('modal:probe', { serverUrl: DEFAULT_LOCAL_URL });
  });

  it('error status shows error message', () => {
    render(
      <SetupScreen
        setupState={baseState({ probeStatus: 'error', error: { code: 'test', message: 'Server error' } })}
        sendMessage={mockSend}
      />
    );
    expect(screen.getByTestId('text-probe-status-message').textContent).toContain('Server error');
  });

  it('network-error status shows unreachable message', () => {
    render(
      <SetupScreen
        setupState={baseState({ probeStatus: 'network-error', error: { code: 'net', message: "Couldn't reach server." } })}
        sendMessage={mockSend}
      />
    );
    expect(screen.getByTestId('text-probe-status-message').textContent).toContain("Couldn't reach server");
  });

  it('unsupported browser shows warning banner', () => {
    render(<SetupScreen setupState={baseState({ browser: { name: 'firefox', version: 128, supported: false } })} sendMessage={mockSend} />);
    expect(screen.getByTestId('div-unsupported-banner')).toBeInTheDocument();
    expect(screen.getByTestId('text-unsupported-message').textContent).toMatch(/firefox/i);
  });

  it('unsupported browser + localhost + network-error shows LNA hint', () => {
    render(
      <SetupScreen
        setupState={baseState({
          probeStatus: 'network-error',
          serverUrl: DEFAULT_LOCAL_URL,
          browser: { name: 'firefox', version: 128, supported: false },
          error: { code: 'net', message: "Couldn't reach server." },
        })}
        sendMessage={mockSend}
      />
    );
    expect(screen.getByTestId('text-lna-hint')).toBeInTheDocument();
  });
});
