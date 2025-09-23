import type { Metadata } from "next";
import "./globals.css";
import { ConditionalTopBar } from '@/components/ConditionalTopBar';


export const metadata: Metadata = {
  title: "Treatment Helper",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="min-h-full bg-white text-black">
        <ConditionalTopBar />
        {children}
      </body>
    </html>
  );
}
