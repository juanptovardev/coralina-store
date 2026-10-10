import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { getTokens } from "@/lib/queries";
import "./globals.css";

export const metadata: Metadata = {
  title: "Coralina — Swimwear hecho para el oleaje",
  description:
    "Swimwear tropical–elegante hecho a mano en Colombia. Tops, enterizos y bikinis en terracota y ámbar.",
};

export const viewport: Viewport = {
  themeColor: "#FAF3E4",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  let tokens: Record<string, string> = {};
  try {
    tokens = await getTokens();
  } catch {
    tokens = {};
  }

  const styleVars = {
    "--color-primary": tokens["color/primary"] ?? "#C9643C",
    "--color-accent": tokens["color/accent"] ?? "#E8A44A",
    "--color-surface-warm": tokens["color/surface-warm"] ?? "#F5DFA0",
    "--color-surface-base": tokens["color/surface-base"] ?? "#FAF3E4",
    "--color-ink": tokens["color/ink"] ?? "#241a10",
  } as React.CSSProperties;

  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500;1,600;1,700&family=Raleway:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400&display=swap"
          rel="stylesheet"
        />
        <link
          rel="icon"
          href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'%3E%3Ccircle cx='24' cy='24' r='22' fill='%23C9643C'/%3E%3Ccircle cx='24' cy='19' r='7' fill='%23E8A44A'/%3E%3Cpath d='M8 28c4-3 8-3 12 0s8 3 12 0 8-3 8 0' stroke='%23FAF3E4' stroke-width='2.5' fill='none' stroke-linecap='round'/%3E%3Cpath d='M10 34c3.5-2.5 7-2.5 10.5 0s7 2.5 10.5 0 6-2.5 7 0' stroke='%23FAF3E4' stroke-width='2' fill='none' stroke-linecap='round' opacity='0.7'/%3E%3C/svg%3E"
        />
      </head>
      <body className="antialiased" style={styleVars}>
        {children}
      </body>
    </html>
  );
}
