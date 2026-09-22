export const dynamic = 'force-dynamic';

import AppShell from './AppShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
