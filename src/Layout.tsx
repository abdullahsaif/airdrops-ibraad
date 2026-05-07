import React from 'react';
import { useAuth } from './AuthWrapper';
import { LogOut, Terminal, LayoutDashboard, Plus, Settings } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from './lib/utils';

export function Navigation() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="fixed top-0 left-0 h-screen w-16 md:w-64 bg-white border-r border-[#141414] z-50 flex flex-col">
      <div className="p-4 border-bottom border-[#141414] flex items-center gap-3">
        <Terminal className="w-10 h-10 md:w-8 md:h-8 flex-shrink-0" />
        <span className="hidden md:block font-bold text-xl uppercase tracking-tighter">TurboDrop</span>
      </div>

      <div className="flex-1 px-2 py-4 space-y-2">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 p-3 text-sm font-bold uppercase tracking-wider transition-all",
              location.pathname === item.path 
                ? "bg-[#141414] text-white" 
                : "hover:bg-gray-100"
            )}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="hidden md:block">{item.name}</span>
          </Link>
        ))}
      </div>

      <div className="p-4 border-t border-[#141414] mt-auto space-y-4">
        <div className="hidden md:block">
          <p className="text-[10px] text-gray-400 font-mono uppercase">Operator</p>
          <p className="text-xs font-bold truncate">{user?.displayName || user?.email}</p>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 p-3 text-sm font-bold uppercase tracking-wider hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="hidden md:block">Sign Out</span>
        </button>
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-mono">
      <Navigation />
      <main className="pl-16 md:pl-64 pt-4 min-h-screen">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
