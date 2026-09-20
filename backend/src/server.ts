import cron from 'node-cron';
import { app } from './app';
import { env } from './config/env';
import { runMatchingJob } from './lib/matching/job';
import { runAutomations } from './modules/crm/automations.service';

app.listen(env.port, () => {
  console.log(`[in-network-api] démarré sur http://localhost:${env.port} (${env.nodeEnv})`);
});

// Automatisations commerciales (relances devis/factures, alertes leads et
// rendez-vous) — toutes les heures, à la minute 5. Idempotentes (cf. automations.service.ts).
cron.schedule('5 * * * *', async () => {
  try {
    const result = await runAutomations();
    const total = Object.values(result).reduce((sum, n) => sum + n, 0);
    if (total > 0) console.log('[crm] automatisations :', JSON.stringify(result));
  } catch (err) {
    console.error('[crm] échec des automatisations', err);
  }
});

// CDC §8.3 — recalcul planifié des suggestions de matching chaque nuit à 2h
cron.schedule('0 2 * * *', async () => {
  console.log('[matching] exécution du job planifié...');
  try {
    const result = await runMatchingJob();
    console.log(`[matching] terminé: ${result.usersProcessed} membres, ${result.suggestionsWritten} suggestions`);
  } catch (err) {
    console.error('[matching] échec du job planifié', err);
  }
});
