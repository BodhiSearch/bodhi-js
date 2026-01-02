import { ChevronDown, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface AccordionProps {
  isOpen: boolean;
  onToggle: () => void;
  icon: ReactNode;
  label: string;
  statusText: string;
  children: ReactNode;
  testId?: string;
  contentTestId?: string;
}

export function Accordion({ isOpen, onToggle, icon, label, statusText, children, testId, contentTestId }: AccordionProps) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4" data-testid={testId}>
        <div className="flex items-center">
          {icon}
          <span className="font-medium">{label}</span>
          <span className="ml-2 text-sm text-gray-500">{statusText}</span>
        </div>
        {isOpen ? <ChevronDown className="w-5 h-5 text-gray-500" /> : <ChevronRight className="w-5 h-5 text-gray-500" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4" data-testid={contentTestId}>
          {children}
        </div>
      )}
    </div>
  );
}
