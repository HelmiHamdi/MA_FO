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
  themeColor: "#07060f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var saved = localStorage.getItem('theme');
                var preferred = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                var theme = saved || preferred;
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            gutter={8}
            toastOptions={{
              style: {
                background: "var(--bg-elevated)",
                color: "var(--text-primary)",
                border: "1px solid var(--border-subtle)",
                backdropFilter: "blur(24px)",
                borderRadius: "14px",
                fontSize: "14px",
                fontFamily: "DM Sans, sans-serif",
                fontWeight: 500,
                padding: "10px 16px",
                boxShadow: "var(--shadow-md)",
                maxWidth: "380px",
              },
              duration: 3500,
              success: { iconTheme: { primary: "#34d399", secondary: "transparent" } },
              error:   { iconTheme: { primary: "#f87171", secondary: "transparent" } },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}