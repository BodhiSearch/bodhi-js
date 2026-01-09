/**
 * BodhiBadge - Marketing component displaying Bodhi App logo
 *
 * Inline badge component that links to https://getbodhi.app
 * with hover animations and configurable size/variant.
 */
import React from 'react';
import BodhiLogoSvg from './assets/bodhi-logo.svg?react';

export type BodhiBadgeSize = 'sm' | 'md' | 'lg';
export type BodhiBadgeVariant = 'light' | 'dark';

export interface BodhiBadgeProps {
  /** Size of the badge (sm=32px, md=48px, lg=64px). Default: 'md' */
  size?: BodhiBadgeSize;
  /** Visual variant for different backgrounds. Default: 'light' */
  variant?: BodhiBadgeVariant;
  /** Additional CSS classes for custom styling */
  className?: string;
  /** Inline styles for custom styling */
  style?: React.CSSProperties;
}

const SIZE_MAP: Record<BodhiBadgeSize, number> = {
  sm: 32,
  md: 48,
  lg: 64,
};

/**
 * BodhiBadge component - displays Bodhi App logo with link to getbodhi.app
 */
export function BodhiBadge({
  size = 'md',
  variant = 'light',
  className = '',
  style = {},
}: BodhiBadgeProps): React.ReactElement {
  const dimensions = SIZE_MAP[size];

  const containerStyle: React.CSSProperties = {
    display: 'inline-block',
    cursor: 'pointer',
    transition: 'all 250ms ease',
    borderRadius: '50%',
    ...(variant === 'dark' && {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
      padding: '8px',
    }),
    ...style,
  };

  return (
    <a
      href="https://getbodhi.app"
      target="_blank"
      rel="noopener noreferrer"
      title="Powered by Bodhi"
      aria-label="Powered by Bodhi - Visit getbodhi.app"
      className={className}
      style={containerStyle}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
        e.currentTarget.style.boxShadow = '0 0 20px rgba(255, 164, 184, 0.6)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = 'none';
      }}
    >
      <BodhiLogoSvg width={dimensions} height={dimensions} style={{ display: 'block' }} />
    </a>
  );
}
