import type { Metadata, Viewport } from "next";
import "./globals.css";

// Every route in this app depends on a live Supabase session (auth state),
// so nothing here should be statically prerendered at build time.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: "Контроль монтажа — МФК Фрунзенская наб.",
  description: "Учёт монтажа кабелей, оборудования, щитов и посещаемости объекта",
  // Значок на рабочем столе iPhone/Android: приложение открывается без адресной строки
  appleWebApp: { capable: true, title: "Монтаж", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1e3a8a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
