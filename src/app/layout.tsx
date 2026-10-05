import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Inter_Tight } from "next/font/google";
import { NativeShellProvider } from "@/components/mobile/NativeShellProvider";
import { SYSTEMS_ONLINE_SCRIPT } from "@/lib/ui/systems-online";
import "./globals.css";

/* Edge-to-edge hardware integration: the surface flows under the Dynamic
   Island and home indicator; safe-area utilities keep content reachable. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07080c",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Display face for large luxury headlines — tighter, more expensive feel.
const interTight = Inter_Tight({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  /* The authenticated product is Reserve Lab. The Reserve Method is a
     separate marketing property and must not appear on this one. */
  title: "Reserve Lab",
  description:
    "Premium physique transformation platform. Training, nutrition, recovery, and physique intelligence for serious athletes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${interTight.variable} h-full antialiased`}
      /* The head script and the ambient gate mark <html> on the client
         (data-systems-online, data-ambient); only this element's own
         attributes are exempt from the hydration comparison. */
      suppressHydrationWarning
    >
      <head>
        {/* Systems online: decided before first paint (src/lib/ui/systems-online.ts). */}
        <script dangerouslySetInnerHTML={{ __html: SYSTEMS_ONLINE_SCRIPT }} />
      </head>
      {/* The dev-only preview rAF shim lives in src/instrumentation-client.ts —
          it must run before any bundle captures requestAnimationFrame. */}
      <body className="min-h-full flex flex-col">
        {/* Inert on the web; installs the native app chrome inside the
            iOS/Android shell. Renders nothing. */}
        <NativeShellProvider />
        {children}
      </body>
    </html>
  );
}
