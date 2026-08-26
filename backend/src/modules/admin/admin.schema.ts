import { z } from 'zod';
import {
  SpaceType,
  PlanBillingCycle,
  ServiceCategory,
  EventType,
  EventOrigin,
  EventStatus,
  ServiceRequestStatus,
  BookingStatus,
} from '../../generated/prisma/client';

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const toggleActiveSchema = z.object({ isActive: z.boolean() });

export const createSpaceSchema = z.object({
  siteId: z.string().min(1),
  type: z.nativeEnum(SpaceType),
  name: z.string().min(1),
  capacity: z.number().int().min(1).default(1),
  monthlyRate: z.number().nonnegative().optional(),
  hourlyRateMember: z.number().nonnegative().optional(),
  halfDayRateMember: z.number().nonnegative().optional(),
  dailyRateMember: z.number().nonnegative().optional(),
  hourlyRateExternal: z.number().nonnegative().optional(),
  halfDayRateExternal: z.number().nonnegative().optional(),
  dailyRateExternal: z.number().nonnegative().optional(),
  photos: z.array(z.string().url()).optional(),
});
export const updateSpaceSchema = createSpaceSchema.partial().extend({ isActive: z.boolean().optional() });

export const createPlanSchema = z.object({
  name: z.string().min(1),
  billingCycle: z.nativeEnum(PlanBillingCycle),
  price: z.number().nonnegative(),
  currency: z.string().default('DZD'),
  includedMeetingHours: z.number().int().min(0).default(0),
  features: z.array(z.string()).default([]),
});
export const updatePlanSchema = createPlanSchema.partial().extend({ isActive: z.boolean().optional() });

const pricingTierSchema = z.object({ label: z.string().min(1), price: z.number().nonnegative() });

export const createServiceCatalogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.nativeEnum(ServiceCategory),
  description: z.string().min(1),
  priceFrom: z.number().nonnegative().optional(),
  pricingTiers: z.array(pricingTierSchema).optional(),
});
export const updateServiceCatalogSchema = createServiceCatalogSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const updateServiceRequestSchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus),
  notes: z.string().optional(),
});

export const updateBookingStatusSchema = z.object({
  status: z.nativeEnum(BookingStatus),
});

export const updateContactMessageSchema = z.object({
  isRead: z.boolean(),
});

export const replyContactMessageSchema = z.object({
  reply: z.string().trim().min(1).max(5000),
});

export const addSiteImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional(),
  order: z.number().int().min(0).default(0),
});

export const createEventSchema = z.object({
  siteId: z.string().min(1).optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(EventType),
  origin: z.nativeEnum(EventOrigin).default('IN_EVENT'),
  location: z.string().optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  capacity: z.number().int().min(1),
  coverImage: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  coOrganizerName: z.string().optional(),
  coOrganizerLogoUrl: z.string().url().optional(),
});
export const updateEventSchema = createEventSchema.partial().extend({ status: z.nativeEnum(EventStatus).optional() });

export const addEventImageSchema = z.object({
  url: z.string().url(),
  altText: z.string().optional(),
  order: z.number().int().min(0).default(0),
});

export const createTestimonialSchema = z
  .object({
    authorName: z.string().min(1),
    authorRole: z.string().optional(),
    content: z.string().min(1).optional(),
    videoUrl: z.string().url().optional(),
    thumbnailUrl: z.string().url().optional(),
  })
  .refine((data) => !!data.content || !!data.videoUrl, {
    message: 'Un témoignage doit avoir un texte ou une vidéo',
    path: ['content'],
  });
export const updateTestimonialSchema = z.object({
  authorName: z.string().min(1).optional(),
  authorRole: z.string().optional(),
  content: z.string().min(1).optional(),
  videoUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  isPublished: z.boolean().optional(),
});

export const createExpertSchema = z.object({
  displayName: z.string().min(1),
  photoUrl: z.string().url().optional(),
  bio: z.string().optional(),
  expertiseArea: z.string().min(1),
  servicesOffered: z.array(z.string()).default([]),
  hourlyRate: z.number().nonnegative().optional(),
  order: z.number().int().min(0).default(0),
});
export const updateExpertSchema = createExpertSchema.partial().extend({
  isVerified: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const createPartnerSchema = z.object({
  name: z.string().min(1),
  logoUrl: z.string().url(),
  sector: z.string().min(1),
  websiteUrl: z.string().url().optional(),
  description: z.string().optional(),
  order: z.number().int().min(0).default(0),
});
export const updatePartnerSchema = createPartnerSchema.partial().extend({ isPublished: z.boolean().optional() });
