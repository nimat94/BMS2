import type { Metadata } from "next";
import "./globals.css";

// Every route in this app depends on a live Supabase session (auth state),
// so nothing here should be statically prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Контроль монтажа — МФК Фрунзенская наб.",
  description: "Учёт монтажа кабелей, оборудования, щитов и посещаемости объекта",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
