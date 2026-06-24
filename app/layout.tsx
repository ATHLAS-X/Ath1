import type { Metadata } from "next";
import { Inter, Space_Grotesk, Instrument_Sans } from "next/font/google";
import "./globals.css";
import "./athlasx.css";
import Providers from "@/components/Providers";
import ConditionalNavbar from "@/components/ConditionalNavbar";
import AppBackground from "@/components/AppBackground";
import { Toaster } from "sonner";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AthlasX — Every Sport. Every Talent. One Platform.",
  description: "India's multi-sport talent discovery platform. Verified player profiles, grassroots to global, across every sport.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable} ${instrumentSans.variable}`}>
      <body style={{ background: "#000000" }}>
        <Providers>
          <AppBackground />
          <div style={{ position: "relative", zIndex: 1 }}>
            <ConditionalNavbar />
            {children}
          </div>
          {/* Global toast surface. Pages opt in by importing
              { toast } from "sonner". */}
          <Toaster
            position="bottom-right"
            theme="dark"
            richColors
            closeButton
            toastOptions={{
              style: { fontFamily: "'Instrument Sans', system-ui, sans-serif" },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
