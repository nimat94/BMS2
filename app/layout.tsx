import type { Metadata } from "next";
import "./globals.css";

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
