import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plant.io — Mapeamento de áreas de plantio",
  description:
    "Delimite, meça e acompanhe áreas de plantio de mudas sobre o mapa.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-stone-900">{children}</body>
    </html>
  );
}
