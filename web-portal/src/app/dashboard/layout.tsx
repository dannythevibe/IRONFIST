'use client';

import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';
import { SessionProvider } from '@/lib/session';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen flex flex-col bg-cyber-bg text-slate-100">
        <Navbar />
        <div className="flex flex-1 flex-col md:flex-row">
          <Sidebar />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto max-w-7xl mx-auto w-full">{children}</main>
        </div>
      </div>
    </SessionProvider>
  );
}
