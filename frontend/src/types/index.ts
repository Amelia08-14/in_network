export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'MEMBER';
export type MemberType = 'FREELANCE' | 'STARTUP' | 'PME' | 'DIASPORA' | 'AUTRE';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  emailVerified: boolean;
}

export interface MemberProfileSummary {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  memberType: MemberType;
  avatarUrl: string | null;
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

export interface EventItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  type: 'CONFERENCE' | 'ATELIER' | 'NETWORKING' | 'MASTERCLASS';
  startAt: string;
  endAt: string;
  capacity: number;
  coverImage: string | null;
  _count?: { registrations: number };
}

export interface ServiceCatalogItem {
  id: string;
  title: string;
  slug: string;
  category: string;
  description: string;
  priceFrom: string | null;
}

export interface ExpertSummary {
  id: string;
  expertiseArea: string;
  servicesOffered: string[];
  hourlyRate: string | null;
  isVerified: boolean;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  companyName?: string | null;
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
