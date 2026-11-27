import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IronFist | Device fingerprinting and anti-abuse API',
  description:
    'Stop trial farming and multi-account fraud. IronFist recognises returning devices across reinstalls and storage wipes, with rate limiting and an MCP endpoint for AI agents.',
  icons: { icon: '/logo.jpg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-cyber-bg text-slate-100 min-h-screen">{children}</body>
    </html>
  );
}
