import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IronFist 👊 | Developer-First Device Fingerprinting & Anti-Abuse Engine',
  description: 'Plug-and-play device fingerprinting, persistence, and anti-abuse engine with MCP link integration, Go backend, and atomic token buckets.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-dark-bg text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
