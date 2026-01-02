import { BrowserType, OSType } from '@/types';
import { FaApple, FaDesktop, FaLinux, FaWindows } from 'react-icons/fa';
import { SiFirefox, SiGooglechrome, SiSafari } from 'react-icons/si';

/**
 * Get icon component for a browser type
 * @param browserId - Browser identifier
 * @param size - Tailwind size class (default: w-6 h-6)
 * @returns Icon component with appropriate styling
 */
export const getBrowserIcon = (browserId: BrowserType | string, size = 'w-6 h-6') => {
  switch (browserId) {
    case 'chrome':
      return <SiGooglechrome className={`${size} text-blue-500`} />;
    case 'edge':
      return <FaDesktop className={`${size} text-blue-600`} />;
    case 'firefox':
      return <SiFirefox className={`${size} text-orange-500`} />;
    case 'safari':
      return <SiSafari className={`${size} text-blue-400`} />;
    default:
      return <FaDesktop className={`${size} text-gray-500`} />;
  }
};

/**
 * Get icon component for an OS type
 * @param osId - OS identifier
 * @param size - Tailwind size class (default: w-6 h-6)
 * @returns Icon component with appropriate styling
 */
export const getOSIcon = (osId: OSType | string, size = 'w-6 h-6') => {
  switch (osId) {
    case 'macos':
      return <FaApple className={`${size} text-gray-700`} />;
    case 'windows':
      return <FaWindows className={`${size} text-blue-600`} />;
    case 'linux':
      return <FaLinux className={`${size} text-orange-600`} />;
    default:
      return <FaDesktop className={`${size} text-gray-500`} />;
  }
};
