import { z } from 'zod';
import { MemberType } from '@prisma/client';

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z.string()
  .url('Le lien saisi n’est pas une adresse valide')
  .max(500, 'Le lien ne peut pas dépasser 500 caractères')
  .refine((url) => /^https?:\/\//i.test(url), 'Le lien doit utiliser http:// ou https://')
  .nullable()
  .optional());

const optionalText = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed || null;
  }, z.string().max(max, `Ce champ ne peut pas dépasser ${max} caractères`).nullable().optional());

const profileTags = (max: number, label: string) =>
  z.array(z.string().trim().min(1, `${label} contient une valeur vide`))
    .max(max, `Vous pouvez renseigner au maximum ${max} ${label.toLowerCase()}`)
    .optional();

export const listProfilesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  search: z.string().optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  tag: z.string().optional(),
});
export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1, 'Le prénom est obligatoire').max(100, 'Le prénom est trop long').optional(),
  lastName: z.string().trim().min(1, 'Le nom est obligatoire').max(100, 'Le nom est trop long').optional(),
  memberType: z.nativeEnum(MemberType).optional(),
  companyName: optionalText(200),
  jobTitle: optionalText(200),
  bio: optionalText(2000),
  avatarUrl: optionalUrl,
  website: optionalUrl,
  linkedinUrl: optionalUrl,
  isPublic: z.boolean().optional(),
  skillsOffered: profileTags(20, 'compétences proposées'),
  skillsWanted: profileTags(20, 'compétences recherchées'),
  sectors: profileTags(10, 'secteurs d’activité'),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
