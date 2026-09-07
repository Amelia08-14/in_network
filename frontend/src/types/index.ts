export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'OFFICE_MANAGER' | 'MEMBER';
export type MemberType = 'FREELANCE' | 'STARTUP' | 'ENTREPRISE';

export type PermissionLevel = 'read' | 'write';
export type DashboardPermissions = Record<string, PermissionLevel>;

// Blocs du backoffice pilotables par permission (miroir de
// backend/src/modules/admin/permissions.ts).
export const DASHBOARD_RESOURCES: { key: string; label: string }[] = [
  { key: 'stats', label: 'Statistiques & vue d’ensemble' },
  { key: 'validations', label: 'Validations' },
  { key: 'members', label: 'Membres' },
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
];

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
  permissions?: DashboardPermissions | null;
  displayName?: string | null;
}

export interface SystemUser {
  id: string;
  email: string;
  role: Role;
  permissions: DashboardPermissions | null;
  displayName: string | null;
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
  capacity: number;
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
