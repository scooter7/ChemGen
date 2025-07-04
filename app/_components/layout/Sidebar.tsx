// app/_components/layout/Sidebar.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, // Changed from LayoutDashboard
  History,
  FileText,
  UserCircle2,
  Image as ImageIconLucide,
} from 'lucide-react';
import Image from 'next/image';

const navItems = [
  { href: '/home', label: 'Home', icon: Home }, // Changed this line
  { href: '/history', label: 'History', icon: History },
  { href: '/brand-materials', label: 'Brand Materials', icon: FileText },
  { href: '/image-library', label: 'Image Library', icon: ImageIconLucide },
  { href: '/profile', label: 'My Profile', icon: UserCircle2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 text-slate-100 hidden md:flex md:flex-col">
      {/* Logo section: full-bleed, no padding */}
      <div className="border-b border-slate-700">
        <Link href="/home" className="block">
          <Image
            src="/michaelailogo.png"
            alt="ChemGen logo"
            width={256}
            height={256}
            className="w-full h-auto"
            priority
          />
        </Link>
      </div>

      {/* Navigation and footer with padding */}
      <div className="flex flex-col flex-grow p-3 space-y-6">
        <nav className="flex-grow">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={`flex items-center p-3 rounded-md hover:bg-slate-700 transition-colors space-x-3 ${
                    pathname === item.href
                      ? 'bg-slate-900 text-white font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title={item.label}
                >
                  <item.icon size={20} className="flex-shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-400 text-center">
            &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </aside>
  );
}