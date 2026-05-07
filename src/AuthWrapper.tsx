import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, signInWithPopup } from './lib/firebase';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { LogIn, LogOut, Terminal } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
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
      <div className="min-h-screen bg-[#E4E3E0] flex items-center justify-center font-mono">
        <motion.div 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-black text-sm uppercase tracking-widest"
        >
          Initializing Satellite Link...
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#E4E3E0] flex flex-col items-center justify-center font-mono p-4">
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-md w-full bg-white border border-[#141414] p-8 space-y-6"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-8 h-8" />
            <h1 className="text-2xl font-bold uppercase tracking-tight">TurboDrop</h1>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed italic">
            Speedrun your airdrop farm. Organize tasks, set custom shortcuts, and automate your workflow.
            Access restricted to authorized operators.
          </p>
          <button 
            onClick={login}
            className="w-full bg-[#141414] text-[#E4E3E0] py-3 px-4 flex items-center justify-center gap-2 hover:bg-black transition-colors uppercase text-sm font-bold tracking-widest"
          >
            <LogIn className="w-4 h-4" />
            Authenticate with Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
