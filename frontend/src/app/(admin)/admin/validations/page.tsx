'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Ancienne page « Validations » : son contenu est désormais à sa place dans le
// processus v1.3 — justificatifs dans « Proformas et factures », demandes du
// site et inscriptions dans « À aiguiller », événements à modérer dans
// « Événements » (signalés sur « Ma journée »). Les comptes membres
// s'activent au paiement. Les anciens liens mènent à « Ma journée ».
export default function ValidationsRedirect() {
  const router = useRouter();
  useEffect(() => router.replace('/admin'), [router]);
  return null;
}
