'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen w-full bg-[#050505] text-white flex flex-col justify-between overflow-hidden font-sans select-none">
      {/* Background Artwork */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/bg.png"
          alt="Hero background"
          fill
          priority
          className="object-cover object-center w-full h-full"
        />
        {/* Subtle dark ambient gradient at top for header legibility */}
        <div className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
        {/* Subtle dark ambient gradient at bottom for logo bar legibility */}
        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Header / Navigation Bar */}
      <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 py-7 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center group">
          <div className="w-8 h-8 flex items-center justify-center">
            <svg width="24" height="28" viewBox="0 0 24 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0L24 7V21L12 28L0 21V7L12 0Z" fill="white" fillOpacity="0.95" />
              <path d="M12 4L19 8.5V17.5L12 22L5 17.5V8.5L12 4Z" fill="black" />
              <path d="M12 7L16 9.5V14.5L12 17L8 14.5V9.5L12 7Z" fill="white" />
            </svg>
          </div>
        </Link>

        {/* Center Nav Links */}
        <nav className="hidden md:flex items-center gap-10 text-sm font-medium text-slate-300">
          <Link href="#about" className="hover:text-white transition-colors">
            About
          </Link>
          <Link href="#features" className="hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#faq" className="hover:text-white transition-colors">
            FAQ
          </Link>
          <Link href="#contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </nav>

        {/* Action Button */}
        <div className="hidden md:flex items-center">
          <Link
            href="/get-started"
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
        <div className="relative z-30 md:hidden bg-black/95 backdrop-blur-lg border-b border-slate-800 px-6 py-6 space-y-4">
          <Link href="#about" className="block text-slate-300 hover:text-white py-2">
            About
          </Link>
          <Link href="#features" className="block text-slate-300 hover:text-white py-2">
            Features
          </Link>
          <Link href="#faq" className="block text-slate-300 hover:text-white py-2">
            FAQ
          </Link>
          <Link href="#contact" className="block text-slate-300 hover:text-white py-2">
            Contact
          </Link>
          <Link
            href="/get-started"
            className="inline-block w-full text-center px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-slate-100"
          >
            Get Started
          </Link>
        </div>
      )}

      {/* Hero Body Content */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 my-auto py-12 md:py-24 flex flex-col justify-center items-start">
        <div className="max-w-xl text-left space-y-6">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl xl:text-[5.25rem] font-medium tracking-tight text-white leading-[1.06]">
            The Next Layer <br />
            of Intelligence
          </h1>

          <p className="text-slate-300 text-base sm:text-lg lg:text-xl font-normal leading-relaxed text-[#94a3b8] max-w-md pt-1">
            A unified infrastructure platform to help teams build, ship, and scale AI systems with confidence.
          </p>

          <div className="pt-4 flex items-center gap-6 sm:gap-8">
            <Link
              href="/get-started"
              className="px-7 py-3.5 rounded-full bg-white text-black font-semibold text-base hover:bg-slate-100 transition-all hover:scale-[1.03] shadow-xl"
            >
              Get Started
            </Link>

            <Link
              href="#architecture"
              className="text-white font-medium text-base hover:text-slate-300 transition-colors flex items-center gap-2"
            >
              View Architecture
            </Link>
          </div>
        </div>
      </main>

      {/* Bottom Brand Logo Bar */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-12 pb-8 sm:pb-12 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-8 md:gap-12 opacity-65 hover:opacity-95 transition-opacity">
          {/* Logo 1 */}
          <div className="flex items-center gap-2.5 text-slate-300 font-bold tracking-tight text-lg sm:text-xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-300">
              <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />
            </svg>
            <span>logoipsum</span>
          </div>

          {/* Logo 2 */}
          <div className="flex items-center gap-2.5 text-slate-300 font-bold tracking-tight text-lg sm:text-xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" className="text-slate-300">
              <path d="M4 20h16V9a7 7 0 10-14 0v11zm4-4h8v2H8v-2z" />
            </svg>
            <span>logoipsum<sup className="text-xs font-bold ml-0.5">*</sup></span>
          </div>

          {/* Logo 3 */}
          <div className="flex items-center gap-2.5 text-slate-300 font-bold tracking-tight text-lg sm:text-xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300">
              <circle cx="12" cy="12" r="9" />
              <path d="M8 12c2-3 6-3 8 0" strokeLinecap="round" />
            </svg>
            <span>logoipsum</span>
          </div>

          {/* Logo 4 */}
          <div className="flex items-center gap-2.5 text-slate-300 font-bold tracking-tight text-lg sm:text-xl">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-slate-300">
              <path d="M3 8c3-2 6 2 9 0s6-2 9 0" strokeLinecap="round" />
              <path d="M3 12c3-2 6 2 9 0s6-2 9 0" strokeLinecap="round" />
              <path d="M3 16c3-2 6 2 9 0s6-2 9 0" strokeLinecap="round" />
            </svg>
            <span>logoipsum</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
