import { Loader2 } from 'lucide-react';

export function LoadingSkeleton() {
  return (
    <div className="space-y-6" data-testid="loading-skeleton">
      {/* Header skeleton */}
      <div className="text-center animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-64 mx-auto mb-2" />
        <div className="h-4 bg-gray-200 rounded w-96 mx-auto" />
      </div>

      {/* Browser detection skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 rounded" />
            <div className="ml-3">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-24" />
            </div>
          </div>
          <div className="h-6 bg-gray-200 rounded-full w-20" />
        </div>
      </div>

      {/* OS detection skeleton */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 rounded" />
            <div className="ml-3">
              <div className="h-4 bg-gray-200 rounded w-40 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-20" />
            </div>
          </div>
          <div className="h-6 bg-gray-200 rounded-full w-20" />
        </div>
      </div>

      {/* Loading indicator */}
      <div className="flex items-center justify-center pt-4">
        <Loader2 className="w-5 h-5 text-blue-500 animate-spin mr-2" />
        <span className="text-sm text-gray-500">Detecting platform...</span>
      </div>
    </div>
  );
}
