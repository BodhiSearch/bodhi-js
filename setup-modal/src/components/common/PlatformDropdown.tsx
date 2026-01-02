import { Browser, BrowserType, OS, OSType } from '@/types';
import { ChevronDown } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { getBrowserIcon, getOSIcon } from '@/lib/platform-icons';

interface PlatformOption {
  id: string;
  name: string;
  icon: React.ReactNode;
  isSupported?: boolean;
}

interface PlatformDropdownProps {
  type: 'browser' | 'os';
  value: BrowserType | OSType;
  supportedOptions: Browser[] | OS[];
  onChange: (value: BrowserType | OSType) => void;
  disabled?: boolean;
}

export function PlatformDropdown({ type, value, supportedOptions, onChange, disabled = false }: PlatformDropdownProps) {
  // Local state for dropdown open/closed - intentionally NOT in global store
  // This is transient UI state that doesn't need persistence or cross-component sharing
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Build options list from supportedOptions only
  const options: PlatformOption[] = supportedOptions.map(opt => ({
    id: opt.id,
    name: opt.name,
    icon: type === 'browser' ? getBrowserIcon(opt.id, 'w-8 h-8') : getOSIcon(opt.id, 'w-8 h-8'),
    isSupported: opt.status === 'supported',
  }));

  const selectedOption = options.find(opt => opt.id === value) || {
    id: value,
    name: type === 'browser' ? 'Unknown Browser' : 'Unknown OS',
    icon: type === 'browser' ? getBrowserIcon(value, 'w-8 h-8') : getOSIcon(value, 'w-8 h-8'),
    isSupported: false,
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (optionId: string) => {
    onChange(optionId as BrowserType | OSType);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        data-testid={`${type}-dropdown`}
        className={`relative w-full bg-white border border-gray-300 rounded-lg shadow-sm pl-3 pr-10 py-3 text-left cursor-default focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
          disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : 'hover:bg-gray-50'
        }`}
      >
        <div className="flex items-center">
          <div className="flex-shrink-0">{selectedOption.icon}</div>
          <div className="ml-3 flex-grow">
            <span className="block truncate font-medium">{selectedOption.name}</span>
            {!selectedOption.isSupported && <span className="text-xs text-amber-600">{type === 'browser' ? 'Coming Soon' : 'Coming Soon'}</span>}
          </div>
        </div>
        <span className="ml-3 absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
          <ChevronDown className="h-5 w-5 text-gray-400" aria-hidden="true" />
        </span>
      </button>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full bg-white shadow-lg max-h-56 rounded-lg py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {options.map(option => (
            <div
              key={option.id}
              data-testid={`${type}-option-${option.id}`}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-gray-50 ${option.id === value ? 'bg-blue-50 text-blue-900' : 'text-gray-900'}`}
              onClick={() => handleOptionClick(option.id)}
            >
              <div className="flex items-center">
                <div className="flex-shrink-0">{option.icon}</div>
                <div className="ml-3 flex-grow">
                  <span className={`block truncate font-medium ${option.id === value ? 'font-semibold' : 'font-normal'}`}>{option.name}</span>
                  {!option.isSupported && <span className="text-xs text-amber-600">{type === 'browser' ? 'Coming Soon' : 'Coming Soon'}</span>}
                </div>
              </div>
              {option.id === value && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-blue-600">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
