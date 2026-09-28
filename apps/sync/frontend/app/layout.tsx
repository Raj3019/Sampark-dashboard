import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sabha Sync",
  description: "Attendance sync automation for Chirag Nagar Sabha",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
