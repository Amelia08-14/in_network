import { RegisterForm } from '@/components/features/RegisterForm';

// « Devenir membre » : un seul parcours pour les indépendants et les
// entreprises. /register?type=entreprise préselectionne le compte entreprise.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <RegisterForm initialType={type === 'entreprise' ? 'company' : 'individual'} />;
}
