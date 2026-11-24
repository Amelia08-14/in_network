import { redirect } from 'next/navigation';

// L'administration consulte le tableau de bord ; elle n'a plus de « Ma journée »
// (retour du 24/11/2026). L'ancienne adresse renvoie au tableau de bord.
export default function MyDayPage() {
  redirect('/admin');
}
