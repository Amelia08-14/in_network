import { RegisterForm } from '@/components/features/RegisterForm';

export const metadata = {
  title: 'Devenir membre',
  description: 'Créez votre compte IN NETWORK, indépendant ou entreprise, et envoyez votre demande de devis.',
};

// « Devenir membre » : un seul parcours pour les indépendants et les
// entreprises. /register?type=entreprise préselectionne le compte entreprise.
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { type } = await searchParams;
  return <RegisterForm initialType={type === 'entreprise' ? 'company' : 'individual'} />;
}
