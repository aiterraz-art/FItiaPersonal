import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const metadata = {
  title: "Fitia - Clon Personal",
  description: "Seguimiento de calorías y macros con estética premium.",
  manifest: "/manifest.json",
  themeColor: "#d946ef",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${manrope.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
