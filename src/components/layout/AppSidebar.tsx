'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Sparkles,
  Layers,
  FolderKanban,
  Settings,
  ShieldCheck,
} from 'lucide-react';

export function AppSidebar() {
  const pathname = usePathname();

  const navItems = [
    { label: 'Painel Operacional', href: '/', icon: LayoutDashboard },
    { label: 'Criação', href: '/create', icon: Sparkles },
    { label: 'Produções', href: '/projects', icon: FolderKanban },
    { label: 'Clientes', href: '/clients', icon: Users },
  ];

  return (
    <aside className="w-full md:w-64 bg-fa-dark text-white p-6 flex flex-col justify-between shrink-0 border-r border-fa-border min-h-screen">
      <div>
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-3 mb-8 group">
          <div className="w-8 h-8 rounded bg-fa-green flex items-center justify-center font-bold text-black text-sm tracking-tight transition-transform group-hover:scale-105">
            FA
          </div>
          <div>
            <h1 className="font-bold tracking-tight text-white text-base">Studio FA</h1>
            <p className="text-xs text-gray-400">Estúdio Criativo com IA</p>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isActive
                    ? 'bg-white/10 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-fa-green' : 'text-gray-400'
                  }`}
                />
                <span>{item.label}</span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-fa-green ml-auto" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="pt-6 border-t border-fa-border text-xs text-gray-400 space-y-1.5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-fa-green" />
          <span className="text-gray-300 font-medium">FA Multi-Tenant</span>
        </div>
        <div className="text-[11px] text-gray-500 font-mono">
          Ref: rfdossffdlayntmyqpnl
        </div>
      </div>
    </aside>
  );
}
