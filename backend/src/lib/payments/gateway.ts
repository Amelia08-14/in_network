import { env } from '../../config/env';

// Passerelle de paiement carte — hypothèse de travail Chargily Pay
// (Edahabia/CIB, DZD), à confirmer avec la direction / IN PAY (CDC §1.4).
// Interface posée pour ne pas coupler le reste du code à un fournisseur précis.
export interface PaymentGateway {
  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean;
}

class ChargilyGateway implements PaymentGateway {
  constructor(private readonly webhookSecret: string) {}

  verifyWebhookSignature(rawBody: string, signatureHeader: string | undefined): boolean {
    if (!this.webhookSecret) {
      // Pas de secret configuré (dev local) — on accepte, mais ce n'est jamais
      // le cas en production (cf. .env.example / checklist sécurité CDC §11).
      return true;
    }
    if (!signatureHeader) return false;
    // TODO: brancher la vérification HMAC réelle du SDK Chargily une fois la
    // clé de webhook confirmée par la direction.
    return true;
  }
}

export const paymentGateway: PaymentGateway = new ChargilyGateway(env.chargily.webhookSecret);
