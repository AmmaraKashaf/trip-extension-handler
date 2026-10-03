"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Fleet" },
  { href: "/how-it-works", label: "How it works" },
];

// Loom is a placeholder until the demo video is recorded.
const EXTERNAL_LINKS = [
  { href: "https://github.com/AmmaraKashaf/trip-extension-handler", label: "GitHub" },
  { href: "https://www.loom.com/", label: "Loom" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="border-b border-zinc-200 bg-white">
      {/* On narrow screens the nav links drop to their own row and scroll sideways. */}
      <nav className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
        <Link href="/" className="leading-tight">
          <span className="block font-semibold">Trip Extension Handler</span>
          <span className="block text-xs text-zinc-500">Next.js | FastAPI | Supabase</span>
        </Link>

        <ul className="order-last flex w-full gap-1 overflow-x-auto sm:order-none sm:w-auto">
          {NAV_LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`block whitespace-nowrap rounded-full px-3 py-1 text-sm ${
                  pathname === href ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:text-zinc-900"
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex gap-4 text-sm">
          {EXTERNAL_LINKS.map(({ href, label }) => (
            <a key={label} href={href} target="_blank" rel="noopener noreferrer"
               className="text-zinc-600 hover:text-zinc-900">
              {label}
            </a>
          ))}
        </div>
      </nav>
    </header>
  );
}
