import type { Metadata } from "next";
import { Manrope, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import AppShell from "@/components/AppShell";
import { SpeedInsights } from "@vercel/speed-insights/next"
import Toaster from '@/components/ui/toaster';

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sabha Analytics | Sampark Management",
  description: "Weekly sabha attendance analytics and management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply saved theme before first paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');document.documentElement.classList.add(t==='dark'?'dark':'light');}catch(e){document.documentElement.classList.add('light');}})();`,
          }}
        />
      </head>
      <body className={`${manrope.variable} ${plusJakartaSans.variable} antialiased bg-background text-foreground min-h-screen`}>
        <ThemeProvider>
          <AppShell>
            {children}
            <SpeedInsights />
          </AppShell>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
