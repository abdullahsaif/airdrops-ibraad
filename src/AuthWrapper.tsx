import React, { createContext, useContext, useEffect, useState } from 'react';
import { cn } from './lib/utils';
import { 
  auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged, 
  signOut,
  User 
} from './lib/firebase';
import { LogIn, LogOut, Terminal, ShieldAlert } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-premium-bg flex items-center justify-center font-mono">
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-premium-accent text-xs font-black uppercase tracking-[0.4em] italic"
        >
          Initializing Secure Satellite Link...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-premium-bg flex flex-col items-center justify-center font-sans p-4 overflow-hidden relative">
        {/* Animated Background Element */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-600/5 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full bg-premium-card border border-premium-border p-10 space-y-10 relative z-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)]"
        >
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="bg-premium-accent p-2">
                 <Terminal className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-display font-extrabold uppercase tracking-tight text-white">TurboDrop</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-[1px] flex-1 bg-premium-border" />
              <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-premium-accent">Systems Online</div>
              <div className="h-[1px] flex-1 bg-premium-border" />
            </div>
          </div>
          
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
              <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isRegistering ? "bg-amber-400" : "bg-emerald-400")} />
              <span className="text-[10px] font-bold uppercase tracking-widest text-premium-muted">
                Mode: {isRegistering ? "New Operator" : "Authorized Link"}
              </span>
            </div>
            <p className="text-sm text-premium-muted leading-relaxed font-medium">
              Access is strictly restricted to established operators. Identity verification required for session initiation.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="group space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 group-focus-within:text-premium-accent transition-colors">Operator Identity</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-lg focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent/20 transition-all text-sm placeholder:text-white/10"
                  placeholder="operator@turbodrop.io"
                />
              </div>
              <div className="group space-y-1.5">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-white/40 group-focus-within:text-premium-accent transition-colors">Access Cipher</label>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-lg focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent/20 transition-all text-sm placeholder:text-white/10"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg flex items-center gap-3 text-red-400 text-xs font-bold uppercase tracking-tight"
              >
                <ShieldAlert className="w-5 h-5 flex-shrink-0" />
                {error}
              </motion.div>
            )}

            <button 
              type="submit"
              className="w-full bg-premium-accent text-white py-5 px-4 flex items-center justify-center gap-3 hover:bg-blue-500 transition-all uppercase text-xs font-black tracking-[0.3em] rounded-lg shadow-lg hover:shadow-blue-500/20 active:scale-[0.98]"
            >
              <LogIn className="w-4 h-4" />
              {isRegistering ? "Register ID" : "Start Session"}
            </button>
          </form>

          <div className="pt-8 flex justify-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[10px] font-bold uppercase tracking-[0.2em] text-premium-muted hover:text-white transition-colors"
            >
              {isRegistering ? "Return to Login Console" : "Request New Credentials"}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
