import { redirect } from 'next/navigation';

// The authenticated app starts at the orders list (dashboard lands in phase 7).
export default function HomePage() {
  redirect('/dashboard');
}
