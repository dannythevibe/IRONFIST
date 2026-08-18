'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Background Visual Artwork - Positioned to center the white door portal in the 2nd/3rd vertical grid */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/bg.png"
          alt="Hero background"
          fill
          priority
          className="object-cover object-[68%_center] w-full h-full"
        />
        {/* Dark ambient gradient overlays for header & footer readability */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/85 via-black/30 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Header / Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-7 flex items-center justify-between">
        {/* Brand Logo - Using user's logo.jpg */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-9 h-9 flex items-center justify-center overflow-hidden rounded-lg">
            <Image
              src="/logo.jpg"
              alt="IronFist Logo"
              width={36}
              height={36}
              className="object-contain w-full h-full rounded-md group-hover:scale-105 transition-transform"
            />
          </div>
          <span className="font-extrabold text-xl tracking-wider text-white font-mono group-hover:text-slate-200 transition-colors">
            IRONFIST
          </span>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-10 text-sm font-medium text-slate-300">
          <Link href="#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#sdks" className="hover:text-white transition-colors">
            SDKs
          </Link>
          <Link href="#architecture" className="hover:text-white transition-colors">
            Architecture
          </Link>
          <Link href="/dashboard" className="hover:text-white transition-colors">
            Console
          </Link>
        </nav>

        {/* Action Button */}
        <div className="hidden md:flex items-center">
          <Link
            href="/dashboard"
            className="px-6 py-2.5 rounded-full bg-white text-black font-semibold text-sm hover:bg-slate-100 transition-all hover:scale-[1.03] shadow-md"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-slate-300 hover:text-white focus:outline-none"
          aria-label="Toggle Navigation Menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="relative z-30 md:hidden bg-black/95 backdrop-blur-lg border-b border-slate-800 px-6 py-6 space-y-4 font-mono">
          <Link href="#features" className="block text-slate-300 hover:text-white py-2">
            Features
          </Link>
          <Link href="#sdks" className="block text-slate-300 hover:text-white py-2">
            SDKs
          </Link>
          <Link href="#architecture" className="block text-slate-300 hover:text-white py-2">
            Architecture
          </Link>
          <Link href="/dashboard" className="block text-slate-300 hover:text-white py-2">
            Console
          </Link>
          <Link
            href="/dashboard"
            className="inline-block w-full text-center px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-slate-100"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Hero Body Content - Strictly locked to Rule of 1/3rds (Left 30-33% column) to avoid the white rectangle portal */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 my-auto py-12 md:py-24 flex flex-col justify-center items-start">
        <div className="w-full max-w-[340px] sm:max-w-[380px] md:max-w-[410px] lg:max-w-[440px] text-left space-y-6">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.5rem] xl:text-[4rem] font-medium tracking-tight text-white leading-[1.08]">
            <span className="block whitespace-nowrap">The Next Layer</span>
            <span className="block">of Anti-Abuse</span>
          </h1>

          <p className="text-slate-300 text-sm sm:text-base lg:text-lg font-normal leading-relaxed text-[#94a3b8] max-w-[360px] sm:max-w-[390px] pt-1">
            A unified hardware persistence platform to help teams stop trial farming, multi-account fraud, and rate limit abuse with confidence.
          </p>

          <div className="pt-4 flex items-center gap-5 sm:gap-7">
            <Link
              href="/dashboard"
              className="px-7 py-3.5 rounded-full bg-white text-black font-semibold text-base hover:bg-slate-100 transition-all hover:scale-[1.03] shadow-xl whitespace-nowrap"
            >
              Get Started
            </Link>

            <Link
              href="/dashboard/simulator"
              className="text-white font-medium text-base hover:text-slate-300 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              View Architecture
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom Ecosystem Platforms */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 pb-8 sm:pb-12 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-8 md:gap-12 opacity-65 hover:opacity-95 transition-opacity font-mono text-xs sm:text-sm tracking-wider uppercase">
          {/* iOS SDK */}
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.32c.67-.82 1.13-1.96.99-3.11-.97.04-2.17.65-2.86 1.46-.61.72-1.15 1.88-.99 3.01 1.09.08 2.21-.54 2.86-1.36z" />
            </svg>
            <span>iOS / Swift</span>
          </div>

          {/* Android SDK */}
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300">
              <path d="M17.523 15.3414C17.06 15.3414 16.691 14.9664 16.691 14.5024C16.691 14.0384 17.06 13.6694 17.523 13.6694C17.987 13.6694 18.361 14.0384 18.361 14.5024C18.361 14.9664 17.987 15.3414 17.523 15.3414ZM6.477 15.3414C6.013 15.3414 5.639 14.9664 5.639 14.5024C5.639 14.0384 6.013 13.6694 6.477 13.6694C6.941 13.6694 7.31 14.0384 7.31 14.5024C7.31 14.9664 6.941 15.3414 6.477 15.3414ZM17.848 10.6694L19.553 7.7164C19.715 7.4354 19.619 7.0764 19.338 6.9144C19.057 6.7524 18.698 6.8484 18.536 7.1294L16.793 10.1474C15.337 9.4874 13.717 9.1174 12 9.1174C10.283 9.1174 8.663 9.4874 7.207 10.1474L5.464 7.1294C5.302 6.8484 4.943 6.7524 4.662 6.9144C4.381 7.0764 4.285 7.4354 4.447 7.7164L6.152 10.6694C2.706 12.5514 0.354 16.0354 0 20.1174H24C23.646 16.0354 21.294 12.5514 17.848 10.6694Z" />
            </svg>
            <span>Android / Kotlin</span>
          </div>

          {/* Rust Desktop */}
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-300">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            <span>Desktop / Rust</span>
          </div>

          {/* MCP Link */}
          <div className="flex items-center gap-2.5 text-slate-300 font-semibold">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-300">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span>MCP Protocol</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
