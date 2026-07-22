import { prisma } from '../../lib/prisma';
import { hashPassword, comparePassword } from '../../lib/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  randomToken,
} from '../../lib/jwt';
import { sendEmail } from '../../lib/email';
import { ApiError } from '../../utils/apiResponse';
import { env } from '../../config/env';
import type { RegisterInput, LoginInput } from './auth.schema';

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function publicUser(user: { id: string; email: string; role: string; emailVerified: Date | null }) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerified),
  };
}

async function issueTokenPair(userId: string, role: string) {
  const accessToken = signAccessToken({ sub: userId, role: role as never });
  const refreshToken = signRefreshToken({ sub: userId });

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict("Un compte existe déjà avec cet email");

  const site = await prisma.site.findFirst({ where: { isActive: true } });
  if (!site) throw new Error('Aucun site actif configuré — lance le seed avant de tester');

  const passwordHash = await hashPassword(input.password);
  const emailVerifyToken = randomToken();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      phone: input.phone,
      emailVerifyToken,
      emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
      profile: {
        create: {
          firstName: input.firstName,
          lastName: input.lastName,
          memberType: input.memberType,
          siteId: site.id,
        },
      },
    },
    include: { profile: true },
  });

  await sendEmail({
    to: user.email,
    subject: 'Bienvenue sur IN NETWORK — confirme ton email',
    html: `<p>Bonjour ${input.firstName},</p><p>Confirme ton adresse email en suivant ce lien : <a href="${verifyLink(emailVerifyToken)}">${verifyLink(emailVerifyToken)}</a></p><p>Ce lien expire dans 24h.</p>`,
  });

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: publicUser(user), ...tokens };
}

function verifyLink(token: string) {
  return `${env.corsOrigin}/auth/verify-email?token=${token}`;
}

export async function login(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive) throw ApiError.unauthorized('Email ou mot de passe incorrect');

  const validPassword = await comparePassword(input.password, user.passwordHash);
  if (!validPassword) throw ApiError.unauthorized('Email ou mot de passe incorrect');

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: publicUser(user), ...tokens };
}

export async function refresh(refreshToken: string) {
  let payload: { sub: string };
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized('Refresh token invalide');
  }

  const tokenHash = hashToken(refreshToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Session expirée, reconnecte-toi');
  }

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) throw ApiError.unauthorized();

  // Rotation: on révoque l'ancien refresh token et on en émet un nouveau
  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date() },
  });

  const tokens = await issueTokenPair(user.id, user.role);
  return { user: publicUser(user), ...tokens };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function verifyEmail(token: string) {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token, emailVerifyExpires: { gt: new Date() } },
  });
  if (!user) throw ApiError.badRequest('Lien de vérification invalide ou expiré');

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), emailVerifyToken: null, emailVerifyExpires: null },
  });
}

export async function resendVerification(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound();
  if (user.emailVerified) return;

  const emailVerifyToken = randomToken();
  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerifyToken, emailVerifyExpires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS) },
  });

  await sendEmail({
    to: user.email,
    subject: 'IN NETWORK — confirme ton email',
    html: `<p>Confirme ton adresse email : <a href="${verifyLink(emailVerifyToken)}">${verifyLink(emailVerifyToken)}</a></p>`,
  });
}

export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  // On ne révèle jamais si l'email existe ou non (évite l'énumération de comptes)
  if (!user) return;

  const passwordResetToken = randomToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken,
      passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
    },
  });

  await sendEmail({
    to: user.email,
    subject: 'IN NETWORK — réinitialisation de mot de passe',
    html: `<p>Réinitialise ton mot de passe : <a href="${env.corsOrigin}/auth/reset-password?token=${passwordResetToken}">lien de réinitialisation</a></p><p>Ce lien expire dans 1h.</p>`,
  });
}

export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: { passwordResetToken: token, passwordResetExpires: { gt: new Date() } },
  });
  if (!user) throw ApiError.badRequest('Lien de réinitialisation invalide ou expiré');

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
  });

  // Toute session existante est invalidée par sécurité
  await prisma.refreshToken.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, expertProfile: true },
  });
  if (!user) throw ApiError.notFound();
  const { passwordHash, emailVerifyToken, passwordResetToken, ...safe } = user;
  return safe;
}
