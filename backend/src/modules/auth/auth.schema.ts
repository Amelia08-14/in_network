import { z } from 'zod';
import { MemberType } from '../../generated/prisma/client';
import { attributionSchema } from '../crm/attribution';

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  memberType: z.nativeEnum(MemberType).default(MemberType.FREELANCE),
  phone: z.string().optional(),
  // Obligatoires à l'inscription (audit 27/10/2026) : sans eux, la fiche de
  // l'annuaire est vide. Le domaine d'activité vient du référentiel (liste fermée).
  jobTitle: z.string().trim().min(2, 'Poste requis').max(200),
  sector: z.string().trim().min(1, 'Domaine d’activité requis').max(120),
  // Origine du visiteur (lien de campagne, réseau social) : canal du lead créé.
  attribution: attributionSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

// Parcours « Inscrire mon entreprise » — schéma défini avec le module
// companies (compte représentant + fiche Company), ré-exporté ici pour que
// les routes auth le consomment comme les autres schémas d'authentification.
export { registerCompanySchema } from '../companies/companies.schema';
export type { RegisterCompanyInput } from '../companies/companies.schema';

export const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
});
