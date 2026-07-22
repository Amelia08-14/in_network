import { z } from 'zod';
import { SuggestionStatus, ConnectionRequestStatus } from '@prisma/client';

export const updateSuggestionSchema = z.object({
  status: z.nativeEnum(SuggestionStatus),
});

export const createConnectionRequestSchema = z.object({
  toUserId: z.string().min(1),
  message: z.string().min(1).max(1000),
});

export const respondConnectionRequestSchema = z.object({
  status: z.enum([ConnectionRequestStatus.ACCEPTED, ConnectionRequestStatus.DECLINED]),
});
