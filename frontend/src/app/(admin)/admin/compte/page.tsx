'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, Crown, FileCheck2, KeyRound, ShieldCheck, Target, Trash2, UserCog, UserPlus, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { api, ApiRequestError } from '@/lib/admin-api';
import { useAdminAuthStore } from '@/store/admin-auth';
import { cn } from '@/lib/utils';
import {
  DASHBOARD_RESOURCES,
  FLAG_RESOURCES,
  RESOURCE_GROUPS,
  ROLE_LABEL,
  ROLE_PRESETS,
  type DashboardPermissions,
  type SystemUser,
} from '@/types';

// Rôles à droits bornés : l'administrateur décide, par compte, ce qu'ils voient et modifient.
const BOUND_ROLES = ['OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'ADMIN_SUPPORT'];
const PROFILE_LABEL = { SEDENTARY: 'Sédentaire', FIELD: 'Terrain' } as const;
type SalesProfile = keyof typeof PROFILE_LABEL;
const LABEL_BY_KEY = Object.fromEntries(DASHBOARD_RESOURCES.map((r) => [r.key, r.label]));

interface RoleInfo {
  icon: LucideIcon;
  title: string;
  tagline: string;
  tone: string;
  points: string[];
}

// Rôles du processus commercial v1.3.
const ROLE_INFO: Record<string, RoleInfo> = {
  SALES_MANAGER: {
    icon: Target,
    title: 'Responsable commercial',
    tagline: 'Pilote la Sales Team (circuit 1)',
    tone: 'text-violet-700 bg-violet-600/10 border-violet-600/30',
    points: ['Filtre les leads et les attribue à un sédentaire ou un terrain', 'Valide les devis sur mesure du circuit 1', 'Contrôle les commissions de la Sales Team'],
  },
  SALES_AGENT: {
    icon: UserRound,
    title: 'Commercial',
    tagline: 'Sédentaire ou terrain, souvent prestataire',
    tone: 'text-brand-blue bg-brand-blue/10 border-brand-blue/30',
    points: ['Qualifie, relance et obtient la visite ou la visio', 'Transmet le dossier à l’Office Manager', 'Suit ses dossiers et ses commissions'],
  },
  OFFICE_MANAGER: {
    icon: UserCog,
    title: 'Office Manager',
    tagline: 'Circuit 2, paiement et activation',
    tone: 'text-amber-700 bg-accent-yellow/20 border-accent-yellow/60',
    points: ['Prend en charge les leads du circuit 2 et les dossiers transmis', 'Encaisse, active les membres, livre le pôle Espaces', 'Référent membre par défaut'],
  },
  ADMIN_SUPPORT: {
    icon: FileCheck2,
    title: 'Support administratif',
    tagline: 'Pôle Création d’entreprise',
    tone: 'text-green-800 bg-accent-green/20 border-accent-green/50',
    points: ['Voit uniquement les dossiers de création et de domiciliation', 'Coche les démarches (CNRC, DGI, CASNOS…)', 'Signale le livrable prêt'],
  },
  ADMIN: {
    icon: Crown,
    title: 'Direction',
    tagline: 'Accès total',
    tone: 'text-brand-orange bg-brand-orange/10 border-brand-orange/30',
    points: ['Voit les deux circuits, valide les devis du circuit 2', 'Valide et verse les commissions', 'Gère les utilisateurs système et les paramètres'],
  },
};

/** Profil d'un commercial : sédentaire ou terrain, prestataire externe ou non. */
function SalesProfileFields({ profile, external, onChange }: { profile: SalesProfile | null; external: boolean; onChange: (patch: { salesProfile?: SalesProfile; isExternal?: boolean }) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl bg-ink-900/[0.04] px-4 py-3 text-sm">
      <span className="font-medium text-ink-800">Profil :</span>
      {(Object.keys(PROFILE_LABEL) as SalesProfile[]).map((p) => (
        <label key={p} className="inline-flex items-center gap-2">
          <input type="radio" name="sales-profile" checked={profile === p} onChange={() => onChange({ salesProfile: p })} /> {PROFILE_LABEL[p]}
        </label>
      ))}
      <label className="inline-flex items-center gap-2">
        <input type="checkbox" checked={external} onChange={(e) => onChange({ isExternal: e.target.checked })} /> Prestataire externe
      </label>
    </div>
  );
}

function errorText(e: unknown) {
  return e instanceof ApiRequestError ? e.message : 'Une erreur est survenue.';
}

const initials = (name: string) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

/* -------------------------------------------------------------------------- */
/*  Contrôle segmenté : Aucun / Lecture / Modification                         */
/* -------------------------------------------------------------------------- */
const LEVELS: { value: '' | 'read' | 'write'; label: string }[] = [
  { value: '', label: 'Aucun' },
  { value: 'read', label: 'Lecture' },
  { value: 'write', label: 'Modification' },
];

// Catalogue (services, formules, espaces) : modifié par la Direction seulement,
// les autres comptes peuvent au plus le consulter (règle appliquée par le serveur).
const READ_ONLY_RESOURCES = ['services', 'plans', 'spaces'];

function LevelControl({ label, value, onChange, readOnlyMax = false }: { label: string; value: '' | 'read' | 'write'; onChange: (v: '' | 'read' | 'write') => void; readOnlyMax?: boolean }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex shrink-0 rounded-lg border border-ink-900/10 bg-ink-900/[0.03] p-0.5">
      {LEVELS.filter((level) => !readOnlyMax || level.value !== 'write').map((level) => {
        const on = value === level.value;
        return (
          <button
            key={level.label}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(level.value)}
            className={cn(
              'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors',
              on && level.value === '' && 'bg-white text-ink-500 shadow-soft',
              on && level.value === 'read' && 'bg-brand-blue text-white shadow-soft',
              on && level.value === 'write' && 'bg-brand-orange text-white shadow-soft',
              !on && 'text-ink-500 hover:text-ink-900',
            )}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Matrice d'accès, groupée par thème                                         */
/* -------------------------------------------------------------------------- */
function PermissionMatrix({ value, onChange }: { value: DashboardPermissions; onChange: (next: DashboardPermissions) => void }) {
  const setLevel = (key: string, level: '' | 'read' | 'write') => {
    const next = { ...value };
    if (level === '') delete next[key];
    else next[key] = level;
    onChange(next);
  };

  return (
    <div className="space-y-5">
      {RESOURCE_GROUPS.map((group) => {
        const levelKeys = group.keys.filter((k) => !FLAG_RESOURCES.includes(k));
        const flagKeys = group.keys.filter((k) => FLAG_RESOURCES.includes(k));
        const granted = levelKeys.filter((k) => value[k]).length;
        return (
          <section key={group.title} className="overflow-hidden rounded-2xl border border-ink-900/10 bg-white">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-900/8 bg-ink-900/[0.03] px-4 py-2.5">
              <h4 className="font-heading text-sm font-bold text-ink-900">
                {group.title} <span className="ml-1 text-xs font-medium text-ink-500">{granted} / {levelKeys.length} accessibles</span>
              </h4>
              <div className="flex gap-1 text-xs">
                <button type="button" onClick={() => onChange({ ...value, ...Object.fromEntries(levelKeys.map((k) => [k, 'read'])) })} className="rounded-md px-2 py-1 font-semibold text-brand-blue hover:bg-brand-blue/10">
                  Tout en lecture
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = { ...value };
                    levelKeys.forEach((k) => delete next[k]);
                    onChange(next);
                  }}
                  className="rounded-md px-2 py-1 font-semibold text-ink-500 hover:bg-ink-900/5"
                >
                  Tout retirer
                </button>
              </div>
            </header>
            <ul className="divide-y divide-ink-900/8">
              {levelKeys.map((key) => (
                <li key={key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                  <span className="text-sm text-ink-800">
                    {LABEL_BY_KEY[key]}
                    {READ_ONLY_RESOURCES.includes(key) && <span className="block text-xs text-ink-500">Modification réservée à la Direction</span>}
                  </span>
                  <LevelControl
                    label={LABEL_BY_KEY[key]}
                    readOnlyMax={READ_ONLY_RESOURCES.includes(key)}
                    value={READ_ONLY_RESOURCES.includes(key) && value[key] ? 'read' : ((value[key] as '' | 'read' | 'write') ?? '')}
                    onChange={(level) => setLevel(key, level)}
                  />
                </li>
              ))}
              {flagKeys.map((key) => (
                <li key={key} className="bg-violet-600/[0.04]">
                  <label className="flex cursor-pointer items-start justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block text-sm font-medium text-ink-900">{LABEL_BY_KEY[key]}</span>
                      <span className="block text-xs text-ink-500">
                        {key === 'crm_all' ? 'Sans ce droit, le compte ne voit que ses leads assignés.' : 'Réservé en principe au responsable commercial.'}
                      </span>
                    </span>
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5 shrink-0 accent-[#001042]"
                      checked={Boolean(value[key])}
                      onChange={(e) => setLevel(key, e.target.checked ? 'write' : '')}
                    />
                  </label>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Résumé en une ligne des accès d'un compte. */
function accessSummary(role: string, permissions: DashboardPermissions | null | undefined) {
  if (!BOUND_ROLES.includes(role)) return 'Accès total';
  const keys = Object.keys(permissions ?? {}).filter((k) => !FLAG_RESOURCES.includes(k));
  const writable = keys.filter((k) => permissions?.[k] === 'write').length;
  return keys.length === 0 ? 'Aucun bloc accessible' : `${keys.length} bloc${keys.length > 1 ? 's' : ''} (${writable} en modification)`;
}

/* -------------------------------------------------------------------------- */
/*  Cartes de choix du rôle                                                    */
/* -------------------------------------------------------------------------- */
function RoleCards({ value, onChange, roles }: { value: string; onChange: (role: string) => void; roles: string[] }) {
  return (
    <div role="radiogroup" aria-label="Rôle" className="grid gap-3 md:grid-cols-2">
      {roles.map((role) => {
        const info = ROLE_INFO[role];
        const on = value === role;
        return (
          <button
            key={role}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(role)}
            className={cn('relative flex flex-col gap-3 rounded-2xl border-2 p-4 text-left transition-all', on ? 'border-ink-900 bg-white shadow-soft-lg' : 'border-ink-900/10 bg-white hover:border-ink-900/30')}
          >
            {on && (
              <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white">
                <Check className="h-3.5 w-3.5" />
              </span>
            )}
            <span className="flex items-center gap-3">
              <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', info.tone)}>
                <info.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-heading text-base font-bold text-ink-900">{info.title}</span>
                <span className="block text-xs text-ink-500">{info.tagline}</span>
              </span>
            </span>
            <ul className="space-y-1.5 text-sm text-ink-600">
              {info.points.map((point) => (
                <li key={point} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" /> {point}
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink-900 font-heading text-sm font-bold text-white">
        {n}
      </span>
      <div>
        <h3 className="font-heading text-lg font-bold text-ink-900">{title}</h3>
        {hint && <p className="text-sm text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Création d'un utilisateur : 3 étapes                                       */
/* -------------------------------------------------------------------------- */
function CreateSystemUserForm({ canCreateAdmin, onClose }: { canCreateAdmin: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: '', displayName: '', phone: '', role: 'SALES_AGENT', salesProfile: 'SEDENTARY' as SalesProfile, isExternal: true });
  const [permissions, setPermissions] = useState<DashboardPermissions>({ ...ROLE_PRESETS.SALES_AGENT });
  const [message, setMessage] = useState<{ text: string; kind: 'success' | 'error' } | null>(null);

  const roles = ['SALES_MANAGER', 'SALES_AGENT', 'OFFICE_MANAGER', 'ADMIN_SUPPORT', ...(canCreateAdmin ? ['ADMIN'] : [])];
  const bound = BOUND_ROLES.includes(form.role);

  const create = useMutation({
    mutationFn: () =>
      api.post('/api/admin/system-users', {
        email: form.email.trim(),
        displayName: form.displayName.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        permissions: bound ? permissions : undefined,
        ...(form.role === 'SALES_AGENT' ? { salesProfile: form.salesProfile, isExternal: form.isExternal } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
      setMessage({ text: `Compte créé : les accès ont été envoyés à ${form.email.trim()}.`, kind: 'success' });
      setForm({ email: '', displayName: '', phone: '', role: 'SALES_AGENT', salesProfile: 'SEDENTARY', isExternal: true });
      setPermissions({ ...ROLE_PRESETS.SALES_AGENT });
    },
    onError: (e) => setMessage({ text: errorText(e), kind: 'error' }),
  });

  const ready = form.email.trim() && form.displayName.trim();

  return (
    <Card>
      <CardContent className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-ink-900">Nouvel utilisateur</h2>
            <p className="text-sm text-ink-500">Trois étapes : qui, quel rôle, quels accès. Le mot de passe est généré et envoyé par email.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-lg p-2 text-ink-500 hover:bg-ink-900/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section>
          <StepTitle n={1} title="Qui est-ce ?" />
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="su-name">Nom affiché *</Label>
              <Input id="su-name" placeholder="Ex. Samira Benali" value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="su-email">Email professionnel *</Label>
              <Input id="su-email" type="email" placeholder="prenom@entreprise.dz" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <p className="mt-1 text-xs text-ink-500">C&apos;est son identifiant de connexion.</p>
            </div>
            <div>
              <Label htmlFor="su-phone">Téléphone</Label>
              <Input id="su-phone" type="tel" placeholder="Optionnel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
          </div>
        </section>

        <section>
          <StepTitle n={2} title="Quel rôle ?" hint="Le rôle donne des droits de départ ; vous les ajustez à l’étape suivante." />
          <RoleCards
            roles={roles}
            value={form.role}
            onChange={(role) => {
              setForm({ ...form, role });
              setPermissions({ ...(ROLE_PRESETS[role] ?? {}) });
            }}
          />
          {form.role === 'SALES_AGENT' && (
            <div className="mt-3">
              <SalesProfileFields profile={form.salesProfile} external={form.isExternal} onChange={(patch) => setForm({ ...form, ...patch })} />
            </div>
          )}
        </section>

        <section>
          <StepTitle n={3} title="Quels accès ?" hint={bound ? 'Pour chaque bloc du back-office : aucun accès, lecture seule, ou lecture et modification.' : undefined} />
          {bound ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl bg-ink-900/[0.04] px-4 py-2.5 text-sm text-ink-700">
                <span>
                  Droits préremplis pour <strong>{ROLE_LABEL[form.role]}</strong>.
                </span>
                <button type="button" onClick={() => setPermissions({ ...(ROLE_PRESETS[form.role] ?? {}) })} className="font-semibold text-brand-blue hover:underline">
                  Revenir aux droits par défaut
                </button>
              </div>
              <PermissionMatrix value={permissions} onChange={setPermissions} />
            </>
          ) : (
            <p className="flex items-center gap-2 rounded-xl border border-brand-orange/30 bg-brand-orange/5 px-4 py-3 text-sm text-ink-800">
              <ShieldCheck className="h-4 w-4 text-brand-orange" /> Un administrateur a accès à tous les blocs du back-office, y compris la gestion des utilisateurs.
            </p>
          )}
        </section>

        <footer className="sticky bottom-0 -mx-6 -mb-6 flex flex-wrap items-center justify-between gap-4 rounded-b-3xl border-t border-ink-900/10 bg-white/95 px-6 py-4 backdrop-blur">
          <p className="text-sm text-ink-600">
            {form.displayName.trim() ? <strong className="text-ink-900">{form.displayName.trim()}</strong> : 'Nouvel utilisateur'} · {ROLE_LABEL[form.role]} · {accessSummary(form.role, permissions)}
          </p>
          <div className="flex items-center gap-3">
            {message && (
              <span role={message.kind === 'error' ? 'alert' : 'status'} className={cn('text-sm', message.kind === 'success' ? 'text-green-700' : 'text-brand-orange')}>
                {message.text}
              </span>
            )}
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button variant="primary" size="lg" disabled={create.isPending || !ready} onClick={() => create.mutate()}>
              {create.isPending ? 'Création…' : 'Créer et envoyer les accès'}
            </Button>
          </div>
        </footer>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/*  Ligne utilisateur                                                          */
/* -------------------------------------------------------------------------- */
function SystemUserRow({ user, currentUserId, canDelete }: { user: SystemUser; currentUserId: string | undefined; canDelete: boolean }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [permissions, setPermissions] = useState<DashboardPermissions>(user.permissions ?? {});
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null);

  const isSelf = user.id === currentUserId;
  const locked = isSelf || user.role === 'SUPER_ADMIN';
  const bound = BOUND_ROLES.includes(user.role);
  const info = ROLE_INFO[user.role];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-system-users'] });
  const done = (text: string) => setMessage({ text, kind: 'ok' });
  const fail = (e: unknown) => setMessage({ text: errorText(e), kind: 'err' });

  const update = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch(`/api/admin/system-users/${user.id}`, body),
    onSuccess: () => {
      done('Enregistré.');
      invalidate();
    },
    onError: fail,
  });
  const remove = useMutation({ mutationFn: () => api.delete(`/api/admin/system-users/${user.id}`), onSuccess: invalidate, onError: fail });
  const resetPassword = useMutation({
    mutationFn: () => api.post(`/api/admin/system-users/${user.id}/reset-password`),
    onSuccess: () => done('Nouveau mot de passe envoyé par email.'),
    onError: fail,
  });

  return (
    <li className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <span aria-hidden className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-heading text-sm font-bold', user.isActive ? 'bg-ink-900 text-white' : 'bg-ink-900/15 text-ink-500')}>
          {initials(user.displayName || user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-900">
            {user.displayName || user.email}
            {isSelf && <span className="text-xs font-normal text-ink-400">(vous)</span>}
            <span className={cn('inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 text-xs font-semibold', info?.tone ?? 'border-ink-900/15 bg-ink-900/5 text-ink-700')}>
              {info && <info.icon className="h-3 w-3" />} {ROLE_LABEL[user.role] ?? user.role}
            </span>
            {user.role === 'SALES_AGENT' && user.salesProfile && <span className="rounded-pill bg-ink-900/6 px-2 py-0.5 text-xs font-semibold text-ink-700">{PROFILE_LABEL[user.salesProfile]}</span>}
            {user.isExternal && <span className="rounded-pill bg-ink-900/6 px-2 py-0.5 text-xs font-semibold text-ink-700">Prestataire</span>}
            {!user.isActive && <span className="rounded-pill bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Désactivé</span>}
          </p>
          <p className="text-sm text-ink-500">
            {user.email} · {accessSummary(user.role, user.permissions)}
          </p>
        </div>
        {!locked && (
          <div className="flex flex-wrap items-center gap-2">
            {bound && (
              <Button size="sm" variant={expanded ? 'secondary' : 'outline'} onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                Gérer les accès <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              disabled={resetPassword.isPending}
              onClick={() => {
                if (window.confirm(`Réinitialiser le mot de passe de ${user.email} ? Un nouveau mot de passe lui sera envoyé par email.`)) resetPassword.mutate();
              }}
            >
              <KeyRound className="h-4 w-4" /> Mot de passe
            </Button>
            <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ isActive: !user.isActive })}>
              {user.isActive ? 'Désactiver' : 'Réactiver'}
            </Button>
            {/* Suppression réservée au super administrateur (les autres désactivent). */}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Supprimer ${user.email}`}
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Supprimer définitivement le compte ${user.email} ?`)) remove.mutate();
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
      </div>

      {expanded && bound && !locked && (
        <div className="mt-5 space-y-5 rounded-2xl border border-ink-900/10 bg-ink-900/[0.02] p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-900">Rôle</p>
            <RoleCards
              roles={['SALES_MANAGER', 'SALES_AGENT', 'OFFICE_MANAGER', 'ADMIN_SUPPORT']}
              value={user.role}
              onChange={(role) => {
                if (role === user.role) return;
                if (!window.confirm(`Passer ${user.displayName || user.email} en « ${ROLE_LABEL[role]} » ? Ses droits seront remplacés par ceux du rôle (modifiables ensuite).`)) return;
                setPermissions({ ...(ROLE_PRESETS[role] ?? {}) });
                update.mutate({ role, permissions: ROLE_PRESETS[role] ?? {} });
              }}
            />
            {user.role === 'SALES_AGENT' && (
              <div className="mt-3">
                <SalesProfileFields profile={user.salesProfile ?? null} external={Boolean(user.isExternal)} onChange={(patch) => update.mutate(patch)} />
              </div>
            )}
          </div>
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-ink-900">Accès aux blocs</p>
              <button type="button" onClick={() => setPermissions({ ...(ROLE_PRESETS[user.role] ?? {}) })} className="text-sm font-semibold text-brand-blue hover:underline">
                Revenir aux droits par défaut du rôle
              </button>
            </div>
            <PermissionMatrix value={permissions} onChange={setPermissions} />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" disabled={update.isPending} onClick={() => update.mutate({ permissions })}>
              Enregistrer les accès
            </Button>
            {message && <span className={cn('text-sm', message.kind === 'ok' ? 'text-green-700' : 'text-brand-orange')}>{message.text}</span>}
          </div>
        </div>
      )}
      {message && !expanded && <p className={cn('mt-2 text-xs', message.kind === 'ok' ? 'text-green-700' : 'text-brand-orange')}>{message.text}</p>}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */
export default function AdminSystemUsersPage() {
  const currentUser = useAdminAuthStore((s) => s.user);
  const canManage = currentUser?.role === 'ADMIN' || currentUser?.role === 'SUPER_ADMIN';
  const [creating, setCreating] = useState(false);

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-system-users'],
    queryFn: () => api.get<{ data: SystemUser[] }>('/api/admin/system-users').then((r) => r.data),
    enabled: canManage,
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold text-ink-900">Utilisateurs système</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-500">
            L&apos;équipe du back-office : chaque compte a un rôle et des accès bloc par bloc. Le mot de passe est généré et envoyé par email à la création.
          </p>
        </div>
        {canManage && !creating && (
          <Button variant="primary" size="lg" onClick={() => setCreating(true)}>
            <UserPlus className="h-4 w-4" /> Ajouter un utilisateur
          </Button>
        )}
      </div>

      {canManage && (
        <section className="space-y-4">
          {creating && <CreateSystemUserForm canCreateAdmin={currentUser?.role === 'SUPER_ADMIN'} onClose={() => setCreating(false)} />}

          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <p className="p-5 text-sm text-ink-500">Chargement...</p>
              ) : !users || users.length === 0 ? (
                <EmptyState title="Aucun utilisateur système" />
              ) : (
                <ul className="divide-y divide-ink-900/8">
                  {users.map((u) => (
                    <SystemUserRow key={u.id} user={u} currentUserId={currentUser?.id} canDelete={currentUser?.role === 'SUPER_ADMIN'} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      )}

    </div>
  );
}
