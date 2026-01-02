interface TroubleshootingBoxProps {
  items: string[];
}

export function TroubleshootingBox({ items }: TroubleshootingBoxProps) {
  return (
    <div className="p-3 bg-white border border-gray-200 rounded-md">
      <h5 className="text-sm font-medium text-gray-900 mb-2">Troubleshooting</h5>
      <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
