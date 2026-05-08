// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "Matchmaking App · Frontoffice",
  description: "Plateforme de networking B2B intelligente",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0d0818",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: "rgba(22,13,42,0.95)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.12)",
                backdropFilter: "blur(16px)",
                borderRadius: "12px",
                fontSize: "14px",
              },
              duration: 3500,
            }}
          />
        </Providers>
      </body>
    </html>
  );
}