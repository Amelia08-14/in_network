'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { captureAttribution } from '@/lib/attribution';

/** Mémorise l'origine du visiteur (réseau social, lien de campagne) à chaque arrivée sur une page. */
function AttributionTracker() {
  const pathname = usePathname();
  useEffect(() => captureAttribution(), [pathname]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AttributionTracker />
      {children}
    </QueryClientProvider>
  );
}
