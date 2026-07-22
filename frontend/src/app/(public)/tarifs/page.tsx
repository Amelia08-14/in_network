import Link from 'next/link';
import { Check } from 'lucide-react';
import { Container } from '@/components/ui/container';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/layout/PageHeader';
import { serverGet } from '@/lib/server-api';
import { cn } from '@/lib/utils';
import type { MembershipPlan } from '@/types';

export const revalidate = 3600;
export const metadata = { title: 'Tarifs & abonnements' };

const CYCLE_LABEL: Record<string, string> = {
  DAY_PASS: '/ jour',
  MONTHLY: '/ mois',
  ANNUAL: '/ an',
};

const CYCLE_ACCENT = {
  DAY_PASS: 'ink',
  MONTHLY: 'orange',
  ANNUAL: 'blue',
} as const;

export default async function TarifsPage() {
  const plans = await serverGet<MembershipPlan[]>('/api/plans', 3600, []);

  return (
    <Container className="section-padding">
      <PageHeader
        align="center"
        eyebrow="Tarifs"
        title={<>Des formules pensées pour chaque <span className="text-brand-orange">étape</span></>}
        description="Day-pass, mensuel ou bureau privé — choisis la formule qui correspond à ton rythme. Grille tarifaire indicative, susceptible d'ajustement."
      />

      {plans.length === 0 ? (
        <EmptyState title="Grille tarifaire en cours de finalisation" description="Contacte-nous pour connaître nos offres actuelles." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              accent={CYCLE_ACCENT[plan.billingCycle as keyof typeof CYCLE_ACCENT] ?? 'none'}
              className="flex flex-col"
            >
              <CardContent className="flex flex-1 flex-col gap-4 pl-6">
                <div>
                  <h3 className="font-heading text-lg font-bold text-ink-900">{plan.name}</h3>
                  <p className="mt-2 font-heading text-3xl font-bold text-brand-orange">
                    {plan.price} <span className="text-sm font-normal text-ink-500">{plan.currency}</span>
                  </p>
                  <p className="text-xs text-ink-500">{CYCLE_LABEL[plan.billingCycle]}</p>
                </div>
                <ul className="flex-1 space-y-2 text-sm text-ink-600">
                  {(plan.features ?? []).map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent-green" /> {feature}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={cn(buttonVariants({ variant: 'primary' }), 'w-full')}>
                  Choisir cette formule
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </Container>
  );
}
