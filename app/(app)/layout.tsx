// Server Component wrapper: forces this whole section to render per-request
// instead of being statically prerendered at build time (these pages depend
// on a live user session, which doesn't exist during `next build`).
export const dynamic = 'force-dynamic';

import AppShell from './AppShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
