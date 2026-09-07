import { z } from 'zod';

const optionalUrl = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}, z
  .string()
  .url('Le lien saisi n’est pas une adresse valide')
  .max(500)
  .nullable()
  .optional());

// Parcours « Inscrire mon entreprise » — crée en une transaction le compte du
// représentant (owner), son profil, et la fiche Company.
export const registerCompanySchema = z.object({
  // Compte représentant
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(100),
  lastName: z.string().trim().min(1, 'Nom requis').max(100),
  phone: z.string().trim().max(40).optional(),
  jobTitle: z.string().trim().max(200).optional(),
  // Entreprise
  companyName: z.string().trim().min(2, 'Raison sociale requise').max(200),
  sector: z.string().trim().max(120).optional(),
  website: optionalUrl,
  logoUrl: optionalUrl,
  // Représentant inclus : 1 = solo, min 1.
  seatLimit: z.coerce.number().int().min(1, 'Au moins 1 poste').max(200, 'Maximum 200 postes'),
});
export type RegisterCompanyInput = z.infer<typeof registerCompanySchema>;

export const updateMyCompanySchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  sector: z.string().trim().max(120).nullable().optional(),
  website: optionalUrl,
  logoUrl: optionalUrl,
  seatLimit: z.coerce.number().int().min(1).max(200).optional(),
});
export type UpdateMyCompanyInput = z.infer<typeof updateMyCompanySchema>;

export const addMemberSchema = z.object({
  email: z.string().email('Email invalide'),
  firstName: z.string().trim().min(1, 'Prénom requis').max(100),
  lastName: z.string().trim().min(1, 'Nom requis').max(100),
  phone: z.string().trim().max(40).optional(),
  jobTitle: z.string().trim().max(200).optional(),
});
export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const setMemberActiveSchema = z.object({
  isActive: z.boolean(),
});

export const memberIdParamSchema = z.object({
  id: z.string().min(1),
});

// Backoffice — édition d'une fiche entreprise par un admin.
export const adminUpdateCompanySchema = z.object({
  seatLimit: z.coerce.number().int().min(1).max(500).optional(),
  isActive: z.boolean().optional(),
});
