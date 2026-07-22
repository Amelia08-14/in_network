import { z } from 'zod';
import { MemberType } from '@prisma/client';

export const listProfilesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  tag: z.string().optional(),
});
export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  companyName: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  avatarUrl: z.string().url().nullable().optional(),
  website: z.string().url().nullable().optional(),
  linkedinUrl: z.string().url().nullable().optional(),
  isPublic: z.boolean().optional(),
  skillsOffered: z.array(z.string().min(1)).max(20).optional(),
  skillsWanted: z.array(z.string().min(1)).max(20).optional(),
  sectors: z.array(z.string().min(1)).max(10).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
