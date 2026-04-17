import { X } from 'lucide-react';
import type { MessageTypeV2, RequestPayloadV2, ResponsePayloadV2 } from '@/types';
import iconBase64Data from '@/icon.txt?raw';

interface HeaderProps {
  sendMessage: <T extends MessageTypeV2>(type: T, payload: RequestPayloadV2<T>) => Promise<ResponsePayloadV2<T>>;
}

export function Header({ sendMessage }: HeaderProps) {
  const handleClose = () => {
    sendMessage('modal:close', undefined).catch(err => {
      console.error('[Header] modal:close failed:', err);
    });
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" data-testid="div-header">
      <div className="flex items-center gap-2">
        <img src={`data:image/png;base64,${iconBase64Data.trim()}`} alt="Bodhi" className="w-6 h-6" />
        <h1 className="text-sm font-semibold text-gray-900">Bodhi Setup</h1>
      </div>
      <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-gray-100 hover:bg-red-50" title="Close" data-testid="btn-close">
        <X className="w-4 h-4 text-gray-500 hover:text-red-600" aria-hidden="true" />
      </button>
    </div>
  );
}
