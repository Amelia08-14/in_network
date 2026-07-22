import cron from 'node-cron';
import { app } from './app';
import { env } from './config/env';
import { runMatchingJob } from './lib/matching/job';

app.listen(env.port, () => {
  console.log(`[in-network-api] démarré sur http://localhost:${env.port} (${env.nodeEnv})`);
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
