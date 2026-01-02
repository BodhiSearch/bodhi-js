import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Accordion } from './Accordion';
import { CheckCircle2 } from 'lucide-react';

describe('Accordion', () => {
  it('should render with label and status text', () => {
    render(
      <Accordion isOpen={false} onToggle={() => {}} icon={<CheckCircle2 data-testid="test-icon" />} label="Test Label" statusText="Test Status">
        <div>Test Content</div>
      </Accordion>
    );

    expect(screen.getByText('Test Label')).toBeInTheDocument();
    expect(screen.getByText('Test Status')).toBeInTheDocument();
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should show children when open', () => {
    render(
      <Accordion isOpen={true} onToggle={() => {}} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status">
        <div data-testid="test-content">Test Content</div>
      </Accordion>
    );

    expect(screen.getByTestId('test-content')).toBeInTheDocument();
  });

  it('should hide children when closed', () => {
    render(
      <Accordion isOpen={false} onToggle={() => {}} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status">
        <div data-testid="test-content">Test Content</div>
      </Accordion>
    );

    expect(screen.queryByTestId('test-content')).not.toBeInTheDocument();
  });

  it('should call onToggle when button clicked', async () => {
    const handleToggle = vi.fn();
    const user = userEvent.setup();

    render(
      <Accordion isOpen={false} onToggle={handleToggle} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status">
        <div>Test Content</div>
      </Accordion>
    );

    const button = screen.getByRole('button');
    await user.click(button);

    expect(handleToggle).toHaveBeenCalledOnce();
  });

  it('should render with custom testIds', () => {
    render(
      <Accordion isOpen={true} onToggle={() => {}} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status" testId="custom-header" contentTestId="custom-content">
        <div>Test Content</div>
      </Accordion>
    );

    expect(screen.getByTestId('custom-header')).toBeInTheDocument();
    expect(screen.getByTestId('custom-content')).toBeInTheDocument();
  });

  it('should show ChevronDown when open', () => {
    const { container } = render(
      <Accordion isOpen={true} onToggle={() => {}} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status">
        <div>Test Content</div>
      </Accordion>
    );

    // ChevronDown is visible when open
    const chevronDown = container.querySelector('svg[class*="lucide-chevron-down"]');
    expect(chevronDown).toBeInTheDocument();
  });

  it('should show ChevronRight when closed', () => {
    const { container } = render(
      <Accordion isOpen={false} onToggle={() => {}} icon={<CheckCircle2 />} label="Test Label" statusText="Test Status">
        <div>Test Content</div>
      </Accordion>
    );

    // ChevronRight is visible when closed
    const chevronRight = container.querySelector('svg[class*="lucide-chevron-right"]');
    expect(chevronRight).toBeInTheDocument();
  });
});
