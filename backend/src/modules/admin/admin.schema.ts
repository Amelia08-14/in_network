import { z } from 'zod';
import { SpaceType, PlanBillingCycle, ServiceCategory, EventType, ServiceRequestStatus } from '@prisma/client';

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
  hourlyRate: z.number().nonnegative().optional(),
  dailyRate: z.number().nonnegative().optional(),
  monthlyRate: z.number().nonnegative().optional(),
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

export const createServiceCatalogSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  category: z.nativeEnum(ServiceCategory),
  description: z.string().min(1),
  priceFrom: z.number().nonnegative().optional(),
});
export const updateServiceCatalogSchema = createServiceCatalogSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const updateServiceRequestSchema = z.object({
  status: z.nativeEnum(ServiceRequestStatus),
  notes: z.string().optional(),
});

export const createEventSchema = z.object({
  siteId: z.string().min(1),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  type: z.nativeEnum(EventType),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  capacity: z.number().int().min(1),
  coverImage: z.string().url().optional(),
});
export const updateEventSchema = createEventSchema.partial().extend({ isPublished: z.boolean().optional() });

export const createTestimonialSchema = z.object({
  authorName: z.string().min(1),
  authorRole: z.string().optional(),
  content: z.string().min(1),
});
export const updateTestimonialSchema = createTestimonialSchema.partial().extend({
  isPublished: z.boolean().optional(),
});
