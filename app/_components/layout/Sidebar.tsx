// app/_components/layout/Sidebar.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  History,
  FileText,
  UserCircle2,
  Image as ImageIconLucide,
  Video,
  Mic,
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'History', icon: History },
  { href: '/brand-materials', label: 'Brand Materials', icon: FileText },
  { href: '/image-library', label: 'Image Library', icon: ImageIconLucide },
  { href: '/video-generator', label: 'Video Generator', icon: Video },
  { href: '/podcast-generator', label: 'Podcast Generator', icon: Mic },
  { href: '/profile', label: 'My Profile', icon: UserCircle2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 text-slate-100 p-3 space-y-6 hidden md:flex md:flex-col">
      <div className="pb-3 border-b border-slate-700">
        <Link href="/dashboard" className="block">
          <img
            src="/michaelailogo.png"
            alt="ChemGen logo"
            className="w-full h-auto"
          />
        </Link>
      </div>
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
      <div className="mt-auto pb-2 border-t border-slate-700 pt-3">
        <p className="text-xs text-slate-400 text-center">
          &copy; {new Date().getFullYear()}
        </p>
      </div>
    </aside>
  );
}
