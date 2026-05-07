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
    <nav className="fixed top-0 left-0 h-screen w-20 md:w-64 bg-premium-card border-r border-premium-border z-50 flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-premium-border">
        <div className="bg-premium-accent p-1.5 rounded">
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <span className="hidden md:block font-display font-extrabold text-xl uppercase tracking-tighter text-white">TurboDrop</span>
      </div>

      <div className="flex-1 px-3 py-8 space-y-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-4 p-3.5 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all group",
                isActive 
                  ? "bg-premium-accent text-white shadow-lg shadow-premium-accent/20" 
                  : "text-premium-muted hover:text-white hover:bg-white/5"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive ? "text-white" : "text-premium-muted group-hover:text-premium-accent")} />
              <span className="hidden md:block">{item.name}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-6 border-t border-premium-border mt-auto space-y-6">
        <div className="hidden md:block space-y-1 px-1">
          <p className="text-[10px] text-premium-muted font-bold uppercase tracking-widest">Active Identity</p>
          <p className="text-[11px] font-bold text-white truncate">{user?.email}</p>
        </div>
        <button 
          onClick={logout}
          className="w-full flex items-center gap-4 p-3 text-[11px] font-black uppercase tracking-widest text-premium-muted hover:text-red-400 transition-colors group"
        >
          <LogOut className="w-5 h-5 flex-shrink-0 group-hover:rotate-12 transition-transform" />
          <span className="hidden md:block">Terminate</span>
        </button>
      </div>
    </nav>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-premium-bg text-premium-text font-sans selection:bg-premium-accent selection:text-white">
      <Navigation />
      <main className="pl-20 md:pl-64 min-h-screen relative">
        <div className="absolute top-0 right-0 w-1/3 h-64 bg-premium-accent/5 blur-[100px] pointer-events-none" />
        <div className="max-w-6xl mx-auto p-6 md:p-12 relative z-10">
          {children}
        </div>
      </main>
    </div>
  );
}
