import React, { createContext, useContext, useEffect, useState } from 'react';
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
          className="max-w-md w-full bg-white border-2 border-[#141414] p-8 space-y-8 shadow-[12px_12px_0px_0px_rgba(20,20,20,1)]"
        >
          <div className="flex items-center gap-3">
            <Terminal className="w-8 h-8" />
            <h1 className="text-2xl font-bold uppercase tracking-tight">TurboDrop</h1>
          </div>
          
          <div className="space-y-4">
            <div className="bg-[#141414] text-[#E4E3E0] px-3 py-1 text-[10px] w-fit font-bold uppercase tracking-widest">
              Security Protocol: {isRegistering ? "Registration" : "Authentication"}
            </div>
            <p className="text-xs text-gray-500 leading-relaxed italic">
              Restricted to personal operational use. Unauthorized access attempts are logged.
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest italic">Email Identity</label>
                <input 
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full border-b-2 border-[#141414] py-2 focus:outline-none focus:border-blue-600 bg-transparent"
                  placeholder="operator@turbodrop.io"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest italic">Encrypted Key</label>
                <input 
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border-b-2 border-[#141414] py-2 focus:outline-none focus:border-blue-600 bg-transparent"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 p-3 flex items-center gap-2 text-red-600 text-[10px] font-bold uppercase italic">
                <ShieldAlert className="w-4 h-4" />
                {error}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-[#141414] text-[#E4E3E0] py-4 px-4 flex items-center justify-center gap-2 hover:bg-black transition-all uppercase text-sm font-black tracking-[0.2em] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:translate-x-1 active:translate-y-1 active:shadow-none"
            >
              <LogIn className="w-4 h-4" />
              {isRegistering ? "CREATE OPERATOR" : "ESTABLISH LINK"}
            </button>
          </form>

          <div className="pt-4 border-t border-gray-100 flex justify-center">
            <button 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-[#141414] transition-colors"
            >
              {isRegistering ? "Already registered? Login" : "First time? Register account"}
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
