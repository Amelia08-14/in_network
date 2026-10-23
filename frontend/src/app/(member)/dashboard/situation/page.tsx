'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// « Situation du compte » est devenue « Devis et factures » (processus v1.3).
export default function SituationRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/dashboard/documents'), [router]);
  return null;
}
