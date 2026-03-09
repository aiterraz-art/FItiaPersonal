import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
});

export const viewport = {
  themeColor: "#0a0614",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export const metadata = {
  metadataBase: new URL("https://fitiaah.atapp.cl"),
  title: "Elite Nutrition | Elite Performance Tracker",
  description: "Seguimiento de nutrición, macros e inteligencia artificial.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Elite Nutrition",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${manrope.variable}`}>
      <body className="antialiased overflow-x-hidden">{children}</body>
    </html>
  );
}
