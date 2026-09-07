import { Router } from 'express';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import {
  addMemberSchema,
  memberIdParamSchema,
  setMemberActiveSchema,
  updateMyCompanySchema,
} from './companies.schema';
import {
  addMemberHandler,
  getMyCompanyHandler,
  removeMemberHandler,
  resendMemberAccessHandler,
  setMemberActiveHandler,
  updateMyCompanyHandler,
} from './companies.controller';

// Espace « Mon équipe » du dashboard — réservé au représentant qui a inscrit
// l'entreprise (le service vérifie qu'un Company.ownerId correspond).
export const companiesRouter = Router();

companiesRouter.use(requireAuth);

companiesRouter.get('/mine', getMyCompanyHandler);
companiesRouter.patch('/mine', validate({ body: updateMyCompanySchema }), updateMyCompanyHandler);
companiesRouter.post('/mine/members', validate({ body: addMemberSchema }), addMemberHandler);
companiesRouter.post(
  '/mine/members/:id/resend',
  validate({ params: memberIdParamSchema }),
  resendMemberAccessHandler,
);
companiesRouter.patch(
  '/mine/members/:id',
  validate({ params: memberIdParamSchema, body: setMemberActiveSchema }),
  setMemberActiveHandler,
);
companiesRouter.delete(
  '/mine/members/:id',
  validate({ params: memberIdParamSchema }),
  removeMemberHandler,
);
