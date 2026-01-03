/**
 * BodhiProvider preset for web applications
 * Auto-creates WebUIClient internally for simplified developer experience
 */
import { useMemo, useRef } from 'react';
import { WebUIClient, type WebUIClientParams } from '@bodhiapp/bodhi-js';
import { BodhiProvider as CoreBodhiProvider, type BodhiProviderProps as CoreBodhiProviderProps, type UIClient } from '@bodhiapp/bodhi-js-react-core';

export interface BodhiProviderProps extends Omit<CoreBodhiProviderProps, 'client'> {
  authClientId?: string;
  clientConfig?: WebUIClientParams;
  client?: UIClient;
}

export function BodhiProvider({ children, authClientId, clientConfig, client: providedClient, basePath, ...restProps }: BodhiProviderProps) {
  if (!providedClient && !authClientId) {
    throw new Error('BodhiProvider requires either "client" or "authClientId" prop');
  }

  const clientRef = useRef<UIClient | null>(null);

  const client = useMemo(() => {
    // If client is provided, use it directly
    if (providedClient) return providedClient;

    // If client already created, reuse it
    if (clientRef.current) return clientRef.current;

    // Merge basePath from props if not set in clientConfig
    const mergedConfig: WebUIClientParams = {
      ...clientConfig,
      basePath: clientConfig?.basePath ?? basePath,
    };

    // Create new WebUIClient
    clientRef.current = new WebUIClient(authClientId!, mergedConfig);
    return clientRef.current;
  }, [providedClient, authClientId, clientConfig, basePath]);

  return (
    <CoreBodhiProvider client={client} basePath={basePath} {...restProps}>
      {children}
    </CoreBodhiProvider>
  );
}
