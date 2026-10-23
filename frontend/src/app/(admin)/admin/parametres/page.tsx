'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Pill } from '@/components/admin/crm-ui';
import { EmptyState } from '@/components/ui/empty-state';
import { errorMessage, ErrorNote, PageTitle, useCrmAccess } from '@/components/admin/crm-ui';
import { api } from '@/lib/admin-api';

// Paramètres du processus commercial v1.3 : les délais et seuils que la
// Direction règle sans développement. Une valeur vide (« non fixée ») désactive
// la règle correspondante (protection des leads, seuil de validation).

type SettingValue = number | boolean | number[] | null;
interface Setting {
  key: string;
  label: string;
  value: SettingValue;
  defaultValue: SettingValue;
}

const HINTS: Record<string, string> = {
  followUpMaxAttempts: 'Au-delà, le lead revient au responsable commercial (circuit 1) ou attend la décision de l’Office Manager (circuit 2).',
  followUpIntervalDays: 'Date proposée pour la relance suivante.',
  trialFollowUpDays: 'Un appel de suivi est programmé après une journée d’essai.',
  checkInDays: 'Appels programmés dans l’agenda du référent après l’activation (ex. 7, 30).',
  expiryAlertDays: 'Le membre et son référent sont prévenus avant l’échéance (ex. 60, 30, 7).',
  expiryGraceDays: 'Délai avant de passer un service « Expiré » après son échéance.',
  leadProtectionDays: 'À fixer par IN NETWORK. Vide : pas de règle.',
  quoteDirectionThreshold: 'À fixer par IN NETWORK. Vide : pas de seuil.',
  directionApprovesOfficeManagerQuotes: 'Sinon, le responsable commercial valide aussi les devis sur mesure du circuit 2.',
};

const toText = (value: SettingValue) => (Array.isArray(value) ? value.join(', ') : value === null ? '' : String(value));

interface Integrations {
  leadWebhook: { enabled: boolean; url: string };
  siteUrl: string;
}

// Réseaux proposés dans le générateur de liens : la valeur utm_source est
// celle que le serveur reconnaît (crm/attribution.ts). WhatsApp reste un canal
// saisi à la main, mais un lien partagé sur WhatsApp peut quand même être suivi.
const NETWORKS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'newsletter', label: 'E-mailing / newsletter' },
  { value: 'whatsapp', label: 'WhatsApp (partage d’un lien)' },
];
const PAGES = [
  { value: '/devis', label: 'Demande de devis' },
  { value: '/register', label: 'Devenir membre' },
  { value: '/services', label: 'Services et tarifs' },
  { value: '/contact', label: 'Contact' },
  { value: '/', label: 'Accueil' },
];

const slug = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Lien à publier sur un réseau : le lead qui en vient arrive avec son canal et sa campagne. */
function CampaignLinkBuilder({ siteUrl }: { siteUrl: string }) {
  const [network, setNetwork] = useState('linkedin');
  const [paid, setPaid] = useState(false);
  const [page, setPage] = useState('/devis');
  const [campaign, setCampaign] = useState('');
  const [copied, setCopied] = useState(false);
  const params = new URLSearchParams({ utm_source: network, utm_medium: network === 'newsletter' ? 'email' : paid ? 'paid_social' : 'social' });
  if (campaign.trim()) params.set('utm_campaign', slug(campaign));
  const link = `${siteUrl.replace(/\/$/, '')}${page}?${params}`;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select aria-label="Réseau" value={network} onChange={(e) => setNetwork(e.target.value)}>
          {NETWORKS.map((n) => (
            <option key={n.value} value={n.value}>
              {n.label}
            </option>
          ))}
        </Select>
        <Select aria-label="Page d’arrivée" value={page} onChange={(e) => setPage(e.target.value)}>
          {PAGES.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
        <Input aria-label="Nom de la campagne" placeholder="Nom de la campagne (ex. Rentrée 2026)" value={campaign} onChange={(e) => setCampaign(e.target.value)} />
      </div>
      <label className="inline-flex items-center gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} /> Publication sponsorisée (le lead sera classé « Publicité », sauf LinkedIn)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 break-all rounded-xl bg-ink-900/[0.05] px-3 py-2 text-xs text-ink-800">{link}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            navigator.clipboard?.writeText(link).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
        >
          {copied ? 'Copié' : 'Copier'}
        </Button>
      </div>
    </div>
  );
}

function SocialLeadsCard() {
  const { data } = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get<{ data: Integrations }>('/api/admin/settings/integrations').then((r) => r.data),
  });
  if (!data) return null;
  return (
    <Card>
      <CardContent className="space-y-5">
        <div>
          <h2 className="font-heading text-base font-bold text-ink-900">Leads des réseaux sociaux</h2>
          <p className="mt-1 text-sm text-ink-500">WhatsApp reste saisi à la main dans le CRM, avec le canal « WhatsApp ».</p>
        </div>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink-900">1 · Liens de campagne</h3>
          <p className="text-sm text-ink-600">
            Publiez sur les réseaux un lien généré ici. Le visiteur qui s’inscrit, demande un devis ou écrit via le formulaire de contact (dans les 60 jours) arrive dans « À aiguiller » avec son réseau et sa campagne, au lieu de « Site web ».
          </p>
          <CampaignLinkBuilder siteUrl={data.siteUrl} />
        </section>

        <section className="space-y-2 border-t border-ink-900/8 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-ink-900">2 · Formulaires publicitaires (Facebook, Instagram, LinkedIn)</h3>
            <Pill tone={data.leadWebhook.enabled ? 'green' : 'amber'}>{data.leadWebhook.enabled ? 'Réception active' : 'À configurer'}</Pill>
          </div>
          <p className="text-sm text-ink-600">
            Avec Make ou Zapier : un scénario « nouveau lead » (Facebook Lead Ads ou LinkedIn Lead Gen Forms) envoie chaque lead à l’adresse ci-dessous. Il arrive dans « À aiguiller », classé LinkedIn ou Publicité, avec sa campagne ; un contact déjà suivi n’ouvre pas de seconde fiche.
          </p>
          <dl className="space-y-1.5 rounded-xl bg-ink-900/[0.04] px-4 py-3 text-sm">
            <div>
              <dt className="text-xs text-ink-500">Adresse (POST, JSON)</dt>
              <dd className="break-all font-mono text-xs text-ink-900">{data.leadWebhook.url}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">En-tête d’authentification</dt>
              <dd className="font-mono text-xs text-ink-900">X-Webhook-Token : valeur de LEAD_WEBHOOK_SECRET (fichier .env du serveur)</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-500">Champs</dt>
              <dd className="text-xs text-ink-700">
                platform (facebook, instagram, linkedin…), full_name (ou first_name et last_name), email, phone_number, company_name, campaign_name, form_name, ad_name, message. Les autres réponses du formulaire sont reprises dans les notes du lead.
              </dd>
            </div>
          </dl>
          {!data.leadWebhook.enabled && (
            <p className="text-xs text-amber-800">Pour activer la réception, renseignez LEAD_WEBHOOK_SECRET dans le fichier .env du serveur (une longue valeur aléatoire), puis redémarrez l’API.</p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const access = useCrmAccess();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string | boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['process-settings'],
    queryFn: () => api.get<{ data: Setting[] }>('/api/admin/settings').then((r) => r.data),
    enabled: access.direction,
  });

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, SettingValue> = {};
      for (const setting of settings ?? []) {
        if (!(setting.key in draft)) continue;
        const raw = draft[setting.key];
        if (typeof setting.defaultValue === 'boolean') body[setting.key] = Boolean(raw);
        else if (Array.isArray(setting.defaultValue)) body[setting.key] = String(raw).split(/[,;\s]+/).filter(Boolean).map(Number);
        else body[setting.key] = String(raw).trim() === '' ? null : Number(raw);
      }
      return api.patch('/api/admin/settings', body);
    },
    onSuccess: () => {
      setDraft({});
      setError(null);
      setSaved(true);
      queryClient.invalidateQueries({ queryKey: ['process-settings'] });
    },
    onError: (e) => {
      setSaved(false);
      setError(errorMessage(e, 'Une valeur est invalide.'));
    },
  });

  if (!access.direction) return <EmptyState title="Réservé à la Direction" />;

  return (
    <div className="space-y-6">
      <PageTitle hue="gray" title="Paramètres du processus" description="Délais, alertes et seuils du processus commercial. Ils s’appliquent dès l’enregistrement, aux automatisations comme aux écrans." />
      {isLoading || !settings ? (
        <p className="text-sm text-ink-500">Chargement…</p>
      ) : (
        <Card>
          <CardContent className="divide-y divide-ink-900/8">
            {settings.map((s) => {
              const current = s.key in draft ? draft[s.key] : typeof s.value === 'boolean' ? s.value : toText(s.value);
              return (
                <div key={s.key} className="grid gap-2 py-4 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div>
                    <label htmlFor={`s-${s.key}`} className="text-sm font-medium text-ink-900">
                      {s.label}
                    </label>
                    <p className="text-xs text-ink-500">
                      {HINTS[s.key]} Par défaut : {typeof s.defaultValue === 'boolean' ? (s.defaultValue ? 'oui' : 'non') : toText(s.defaultValue) || 'non fixé'}.
                    </p>
                  </div>
                  {typeof s.defaultValue === 'boolean' ? (
                    <input id={`s-${s.key}`} type="checkbox" className="h-5 w-5 justify-self-start sm:justify-self-end" checked={Boolean(current)} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.checked }))} />
                  ) : (
                    <Input id={`s-${s.key}`} value={String(current)} placeholder="Non fixé" onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <ErrorNote message={error} />
      {saved && <p className="text-sm text-green-700">Paramètres enregistrés.</p>}
      <div className="flex justify-end">
        <Button disabled={save.isPending || Object.keys(draft).length === 0} onClick={() => save.mutate()}>
          {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </div>
      <SocialLeadsCard />
    </div>
  );
}
