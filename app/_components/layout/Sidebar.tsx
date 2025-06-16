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
  Video, // Import the Video icon
} from 'lucide-react';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/history', label: 'History', icon: History },
  { href: '/brand-materials', label: 'Brand Materials', icon: FileText },
  { href: '/image-library', label: 'Image Library', icon: ImageIconLucide },
  { href: '/video-generator', label: 'Video Generator', icon: Video }, // New video generator link
  { href: '/profile', label: 'My Profile', icon: UserCircle2 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-16 hover:w-64 transition-all duration-300 ease-in-out bg-slate-800 text-slate-100 p-3 space-y-6 hidden md:flex md:flex-col group">
      <div className="py-3 border-b border-slate-700">
        <Link 
          href="/dashboard" 
          className="flex items-center h-10 justify-center group-hover:justify-start group-hover:px-1"
        >
          <span className="text-2xl font-bold text-white group-hover:hidden">C</span>
          <span className="hidden group-hover:block text-xl font-semibold text-white ml-1 whitespace-nowrap">
            ChemGen
          </span>
        </Link>
      </div>
      <nav className="flex-grow">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className={`flex items-center p-3 rounded-md hover:bg-slate-700 transition-colors 
                            justify-center group-hover:justify-start group-hover:space-x-3
                            ${pathname === item.href ? 'bg-slate-900 text-white font-semibold' : 'text-slate-300 hover:text-white'}`}
                title={item.label}
              >
                <item.icon size={20} className="flex-shrink-0" />
                <span className="hidden group-hover:inline whitespace-nowrap">{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto pb-2 border-t border-slate-700 pt-3">
        <p className="text-xs text-slate-400 text-center hidden group-hover:block">
          &copy; {new Date().getFullYear()}
        </p>
         <p className="text-xs text-slate-400 text-center group-hover:hidden">
          &copy;
        </p>
      </div>
    </aside>
  );
}
