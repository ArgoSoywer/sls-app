import type { Metadata, Viewport } from "next";
import { GameProvider } from "@/components/game/game-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Solo Leveling System",
  description: "A personal progression system for the paths you choose.",
  manifest: "/manifest.webmanifest",
  applicationName: "SLS",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "SLS" },
};

export const viewport: Viewport = {
  themeColor: "#05060b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <GameProvider>{children}</GameProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: "if ('serviceWorker' in navigator) window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function (error) { console.error('SLS service worker registration failed:', error); }); });",
          }}
        />
      </body>
    </html>
  );
}
