import fs from 'node:fs';
import path from 'node:path';
import { env } from '../src/config/env';
import { emailButton, emailPanel, renderEmail } from '../src/lib/emailLayout';

// Aperçu des e-mails chartés, SANS ENVOI : écrit des fichiers HTML à ouvrir
// dans un navigateur.   npm run emails:preview -- <dossier de sortie>
const out = path.resolve(process.argv[2] ?? 'email-previews');
fs.mkdirSync(out, { recursive: true });

const samples: { file: string; subject: string; html: string }[] = [
  {
    file: 'bienvenue.html',
    subject: "Bienvenue dans l'espace IN NETWORK",
    html: `<p>Bonjour Amina,</p><p>Merci pour votre inscription. Depuis votre espace IN NETWORK, choisissez vos services et envoyez votre demande de devis : notre équipe vous recontacte rapidement. Votre espace membre s’active entièrement dès votre premier paiement.</p>${emailButton('Composer ma demande de devis', `${env.appUrl}/dashboard/catalogue`)}<p>À très vite,<br/>L’équipe IN NETWORK</p>`,
  },
  {
    file: 'acces.html',
    subject: 'IN NETWORK — Votre espace membre',
    html: `<p>Bonjour Amina,</p><p>Votre paiement est confirmé : votre espace membre IN NETWORK est ouvert. Vous y suivez vos services, vos documents et vos échéances.</p>${emailPanel('<p style="margin:0;"><strong>Identifiant :</strong> amina@exemple.dz<br><strong>Mot de passe :</strong> exemple-1234</p>')}${emailButton('Me connecter', `${env.appUrl}/login`)}<p>Nous vous recommandons de changer ce mot de passe après votre première connexion.</p><p>L’équipe IN NETWORK</p>`,
  },
  {
    file: 'kit-bienvenue.html',
    subject: 'Bienvenue chez IN NETWORK',
    html: `<p>Bonjour Amina,</p><p>Bienvenue dans la communauté IN NETWORK ! Votre paiement est confirmé et votre espace membre est entièrement actif.</p><p>Pour bien démarrer :</p><ul><li><a href="#">Mes services</a> : l’avancement de chaque service, ses dates et ses documents ;</li><li><a href="#">Le calendrier des événements</a> : workshops, portes ouvertes, IN Talk ;</li></ul>${emailButton('Accéder à mon espace', `${env.appUrl}/dashboard`)}<p>À très vite,<br>L’équipe IN NETWORK</p>`,
  },
];

for (const sample of samples) {
  fs.writeFileSync(path.join(out, sample.file), renderEmail(sample));
  console.log(path.join(out, sample.file));
}
