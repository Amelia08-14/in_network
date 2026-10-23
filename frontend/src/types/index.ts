export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OFFICE_MANAGER' | 'SALES_MANAGER' | 'SALES_AGENT' | 'ADMIN_SUPPORT' | 'MEMBER';

/** Rôles du back-office (tout sauf MEMBER). */
export const STAFF_ROLES: Role[] = ['SUPER_ADMIN', 'ADMIN', 'OFFICE_MANAGER', 'SALES_MANAGER', 'SALES_AGENT', 'ADMIN_SUPPORT'];
export const isStaffRole = (role: string | undefined | null): boolean => STAFF_ROLES.includes(role as Role);

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super administrateur',
  ADMIN: 'Direction',
  OFFICE_MANAGER: 'Office Manager',
  SALES_MANAGER: 'Responsable commercial',
  SALES_AGENT: 'Commercial',
  ADMIN_SUPPORT: 'Support administratif',
  MEMBER: 'Membre',
};
export type MemberType = 'FREELANCE' | 'STARTUP' | 'ENTREPRISE';

export type PermissionLevel = 'read' | 'write';
export type DashboardPermissions = Record<string, PermissionLevel>;

// Blocs du backoffice pilotables par permission (miroir de
// backend/src/modules/admin/permissions.ts).
export const DASHBOARD_RESOURCES: { key: string; label: string }[] = [
  { key: 'stats', label: 'Statistiques & vue d’ensemble' },
  { key: 'validations', label: 'Validations' },
  { key: 'members', label: 'Membres' },
  { key: 'companies', label: 'Entreprises' },
  { key: 'service_requests', label: 'Demandes de service' },
  { key: 'services', label: 'Catalogue de services' },
  { key: 'bookings', label: 'Réservations' },
  { key: 'payments', label: 'Paiements' },
  { key: 'events', label: 'Événements' },
  { key: 'experts', label: 'Experts' },
  { key: 'partners', label: 'Partenaires' },
  { key: 'testimonials', label: 'Témoignages' },
  { key: 'galerie', label: 'Galerie du lieu & sites' },
  { key: 'spaces', label: 'Espaces' },
  { key: 'plans', label: 'Formules d’abonnement' },
  { key: 'contact', label: 'Messages de contact' },
  { key: 'crm', label: 'CRM commercial (leads, pipeline, agenda)' },
  { key: 'crm_all', label: 'CRM — voir les leads des deux circuits (sinon : selon le rôle)' },
  { key: 'crm_manage', label: 'CRM — aiguiller les leads entrants et attribuer ceux du circuit 1' },
  { key: 'quotes', label: 'Devis' },
  { key: 'invoices', label: 'Factures, proformas et justificatifs' },
  { key: 'fulfilment', label: 'Services clients (activation, livraison, échéances)' },
  { key: 'commissions', label: 'Commissions (lecture : les siennes ; modification : contrôle)' },
];

/** Blocs du back-office regroupés par thème (écran de gestion des accès). */
export const RESOURCE_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Pilotage', keys: ['stats', 'validations'] },
  { title: 'Commercial', keys: ['crm', 'crm_all', 'crm_manage', 'quotes', 'invoices', 'fulfilment', 'commissions', 'service_requests', 'contact', 'payments'] },
  { title: 'Communauté', keys: ['members', 'companies', 'bookings', 'events', 'experts', 'partners', 'testimonials'] },
  { title: 'Catalogue & site', keys: ['services', 'plans', 'spaces', 'galerie'] },
];

/** Clés de permission « oui / non » (pas de niveau lecture / écriture). */
export const FLAG_RESOURCES = ['crm_all', 'crm_manage'];

// Droits proposés à la création d'un compte (miroir de ROLE_PRESETS côté API).
export const ROLE_PRESETS: Record<string, DashboardPermissions> = {
  OFFICE_MANAGER: {
    stats: 'read',
    members: 'write',
    companies: 'read',
    service_requests: 'write',
    contact: 'write',
    bookings: 'write',
    events: 'write',
    crm: 'write',
    quotes: 'write',
    invoices: 'write',
    fulfilment: 'write',
    commissions: 'read',
  },
  SALES_MANAGER: { crm: 'write', quotes: 'write', invoices: 'read', fulfilment: 'read', service_requests: 'read', contact: 'read', commissions: 'write' },
  SALES_AGENT: { crm: 'write', quotes: 'write', commissions: 'read' },
  ADMIN_SUPPORT: { fulfilment: 'write' },
};

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  permissions?: DashboardPermissions | null;
  displayName?: string | null;
  // Rôle du compte dans le processus commercial (calculé par l'API, appliqué aussi côté serveur).
  crmAccess?: CrmAccess | null;
  // Rattachement à un compte entreprise (parcours « Inscrire mon entreprise »).
  // isOwner = ce compte a inscrit l'entreprise et gère les postes.
  company?: CompanySummary | null;
  // Espace membre actif ? false = avant le premier paiement : seuls la demande
  // de devis et « Devis et factures » sont ouverts.
  validated?: boolean;
}

export interface CrmAccess {
  /** Voit les leads des deux circuits (Direction, droit crm_all). */
  allLeads: boolean;
  /** Aiguille les leads entrants (responsable commercial, Office Manager). */
  manageLeads: boolean;
  /** Pilote la Sales Team (circuit 1). */
  salesManager: boolean;
  /** Pilote le circuit 2 et reçoit les dossiers transmis. */
  officeManager: boolean;
  /** Direction (administrateurs). */
  direction: boolean;
}

export interface CompanySummary {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  seatLimit: number;
  isActive: boolean;
  isOwner: boolean;
}

export interface CompanyMember {
  id: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  firstName: string | null;
  lastName: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  isOwner: boolean;
}

export interface CompanyDashboard {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  sector: string | null;
  website: string | null;
  seatLimit: number;
  isActive: boolean;
  usedSeats: number;
  members: CompanyMember[];
}

export interface AdminCompany {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  sector: string | null;
  website: string | null;
  seatLimit: number;
  usedSeats: number;
  isActive: boolean;
  createdAt: string;
  ownerEmail: string;
  ownerName: string | null;
}

export interface SystemUser {
  id: string;
  email: string;
  role: Role;
  permissions: DashboardPermissions | null;
  displayName: string | null;
  /** Commercial : sédentaire ou terrain ; isExternal = prestataire de la Sales Team. */
  salesProfile?: 'SEDENTARY' | 'FIELD' | null;
  isExternal?: boolean;
  isActive: boolean;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MemberProfileSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  memberType: MemberType;
  avatarUrl: string | null;
  companyLogoUrl: string | null;
  jobTitle: string | null;
  companyName: string | null;
  city?: string | null;
  phone?: string | null;
  siteId: string;
  sectors: string[];
  bio?: string | null;
  website?: string | null;
  linkedinUrl?: string | null;
  skillsOffered?: string[];
  skillsWanted?: string[];
  email?: string;
  isPublic?: boolean;
  updatedAt?: string;
  completeness?: ProfileCompleteness;
}

export interface ProfileCompleteness {
  isComplete: boolean;
  missing: string[];
  missingKeys: string[];
}

export interface MembershipPlan {
  id: string;
  name: string;
  billingCycle: 'DAY_PASS' | 'MONTHLY' | 'ANNUAL';
  price: string;
  currency: string;
  includedMeetingHours: number;
  features: string[];
}

export type EventOrigin = 'IN_EVENT' | 'EXTERNAL' | 'CO_ORGANIZED';
export type EventStatus = 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';

export interface GalleryImageItem {
  id: string;
  url: string;
  type: 'IMAGE' | 'VIDEO';
  altText: string | null;
  order: number;
}

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: 'CONFERENCE' | 'ATELIER' | 'NETWORKING' | 'MASTERCLASS';
  origin: EventOrigin;
  status?: EventStatus;
  location: string | null;
  startAt: string;
  endAt: string;
  capacity: number;
  coverImage: string | null;
  videoUrl: string | null;
  coOrganizerName: string | null;
  coOrganizerLogoUrl: string | null;
  gallery?: GalleryImageItem[];
  _count?: { registrations: number };
}

export interface PricingTier {
  label: string;
  price: number;
}

export interface ServiceCatalogItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  priceFrom: string | null;
  pricingTiers?: PricingTier[] | null;
  /** Pôle de livraison, filiale IN Group, durée de validité en mois (processus v1.3). */
  pole?: 'SPACES' | 'COMPANY_CREATION' | 'IN_GROUP';
  subsidiary?: string | null;
  durationMonths?: number | null;
}

export interface Site {
  id: string;
  name: string;
  city: string;
  address: string;
  isActive: boolean;
}

export interface SpaceResource {
  id: string;
  name: string;
  type: 'DESK' | 'PRIVATE_OFFICE' | 'MEETING_ROOM';
  /** « 6 à 8 personnes » : capacityMin 6, capacity 8. */
  capacity: number;
  capacityMin: number | null;
  description: string | null;
  monthlyRate: string | null;
  hourlyRateMember: string | null;
  halfDayRateMember: string | null;
  dailyRateMember: string | null;
  hourlyRateExternal: string | null;
  halfDayRateExternal: string | null;
  dailyRateExternal: string | null;
}

export interface ExpertSummary {
  id: string;
  displayName: string;
  photoUrl: string | null;
  bio?: string | null;
  expertiseArea: string;
  servicesOffered: string[];
  hourlyRate: string | null;
  isVerified: boolean;
  companyName?: string | null;
}

export interface EventMediaItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  altText: string | null;
  eventId: string;
  eventTitle: string;
  eventSlug: string;
  eventOrigin: EventOrigin;
}

export interface Partner {
  id: string;
  name: string;
  logoUrl: string;
  sector: string;
  websiteUrl: string | null;
  description: string | null;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiListResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiItemResponse<T> {
  data: T;
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}
