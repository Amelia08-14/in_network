// Fournisseur SMS non déterminé (CDC §1.4 / §9 — dépendance ouverte).
// Interface posée pour ne pas bloquer le reste du développement (confirmations
// de réservation) : brancher un vrai fournisseur ici une fois choisi.
export interface SmsSender {
  send(to: string, message: string): Promise<void>;
}

class NoopSmsSender implements SmsSender {
  async send(to: string, message: string): Promise<void> {
    console.log(`[sms:noop] fournisseur non configuré — à=${to} message="${message}"`);
  }
}

export const smsSender: SmsSender = new NoopSmsSender();
