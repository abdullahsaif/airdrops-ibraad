import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  db, 
  handleFirestoreError, 
  OperationType,
  addDoc,
  serverTimestamp 
} from './lib/firebase';
import { useAuth } from './AuthWrapper';
import { motion } from 'motion/react';
import { Plus, ChevronRight, Activity, Clock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from './lib/utils';

export function Dashboard() {
  const { user } = useAuth();
  const [airdrops, setAirdrops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(collection(db, 'airdrops'), where('ownerId', '==', user.uid));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAirdrops(data);
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'airdrops')
    );

    return () => unsubscribe();
  }, [user]);

  const stats = {
    active: airdrops.filter(a => a.status === 'active').length,
    upcoming: airdrops.filter(a => a.status === 'upcoming').length,
    ended: airdrops.filter(a => a.status === 'ended').length,
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-premium-border pb-10">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-premium-accent text-[10px] font-black uppercase tracking-[0.3em] italic">
            <div className="w-1.5 h-1.5 bg-premium-accent rounded-full animate-pulse" />
            Operational Hub
          </div>
          <h1 className="text-5xl font-display font-extrabold uppercase tracking-tighter text-white">Command Center</h1>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-premium-accent text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-premium-accent/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          New Deployment
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Missions', value: stats.active, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-400/5' },
          { label: 'On Standby', value: stats.upcoming, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/5' },
          { label: 'Archived', value: stats.ended, icon: CheckCircle2, color: 'text-premium-muted', bg: 'bg-white/5' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="premium-gradient-card border border-premium-border p-8 rounded-2xl group hover:border-premium-accent transition-all duration-500"
          >
            <div className="flex items-center justify-between mb-8">
              <div className={cn("p-4 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <span className="text-4xl font-display font-extrabold text-white tracking-tighter">{stat.value}</span>
            </div>
            <p className="text-[10px] uppercase font-black tracking-[0.2em] text-premium-muted group-hover:text-white transition-colors">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Airdrops Data Layer */}
      <div className="bg-premium-card border border-premium-border rounded-2xl overflow-hidden">
        <div className="grid grid-cols-6 p-6 border-b border-premium-border bg-white/[0.02] text-[10px] font-black uppercase tracking-[0.2em] text-premium-muted italic">
          <div className="col-span-2">Airdrop Identifier</div>
          <div>Status</div>
          <div>Efficiency</div>
          <div>Time logged</div>
          <div className="text-right">Access</div>
        </div>

        {airdrops.length === 0 ? (
          <div className="p-24 text-center">
            <p className="text-premium-muted italic text-sm py-4">No active deployments detected within your sector.</p>
            <button onClick={() => setShowNewModal(true)} className="text-premium-accent text-xs font-black uppercase tracking-widest hover:underline">Initialize First Mission</button>
          </div>
        ) : (
          airdrops.map((airdrop, i) => (
            <Link 
              to={`/airdrop/${airdrop.id}`}
              key={airdrop.id}
              className="grid grid-cols-6 p-6 border-b border-premium-border hover:bg-white/[0.03] transition-all group items-center"
            >
              <div className="col-span-2 flex items-center gap-4">
                <div className={cn("w-2 h-2 rounded-full", airdrop.status === 'active' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-premium-muted')} />
                <span className="font-bold text-white uppercase tracking-tight group-hover:text-premium-accent transition-colors">{airdrop.name}</span>
              </div>
              <div className="text-[10px] font-black uppercase tracking-[0.2em]">
                <span className={cn(
                  "px-2 py-1 rounded border",
                  airdrop.status === 'active' ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/10" : "border-premium-border text-premium-muted"
                )}>
                  {airdrop.status}
                </span>
              </div>
              <div className="pr-10">
                <div className="flex items-center justify-between gap-3 mb-1.5">
                   <span className="text-[9px] font-mono font-bold text-premium-muted">SYNC: 45%</span>
                </div>
                <div className="h-1.5 bg-premium-bg rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-premium-accent rounded-full transition-all group-hover:shadow-[0_0_10px_rgba(59,130,246,0.5)]" style={{ width: '45%' }} />
                </div>
              </div>
              <div className="text-[10px] font-mono text-premium-muted">
                {formatDate(airdrop.createdAt)}
              </div>
              <div className="text-right">
                <ChevronRight className="w-5 h-5 ml-auto text-premium-muted group-hover:text-white transition-all transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))
        )}
      </div>

      {/* New Airdrop Modal */}
      {showNewModal && (
        <NewAirdropModal 
          onClose={() => setShowNewModal(false)} 
          onSuccess={() => setShowNewModal(false)}
        />
      )}
    </div>
  );
}

function NewAirdropModal({ onClose, onSuccess }: { onClose: () => void, onSuccess: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [status, setStatus] = useState('active');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'airdrops'), {
        name,
        status,
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'airdrops');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050505]/90 backdrop-blur-md">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-premium-card border border-premium-border p-10 max-w-md w-full relative rounded-2xl shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-2xl font-bold text-premium-muted hover:text-white transition-colors">×</button>
        <h3 className="text-3xl font-display font-extrabold uppercase tracking-tighter mb-8 text-white">Initialize Mission</h3>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Airdrop Descriptor</label>
            <input 
              required
              autoFocus
              className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent focus:ring-1 focus:ring-premium-accent/20 transition-all text-sm text-white placeholder:text-white/10"
              placeholder="e.g. MONAD INCENTIVIZED TESTNET"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-4">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Inaugural Status</label>
            <div className="grid grid-cols-3 gap-3">
              {['active', 'upcoming', 'ended'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "py-3 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all",
                    status === s ? "bg-premium-accent text-white border-premium-accent shadow-lg shadow-premium-accent/20" : "border-premium-border text-premium-muted hover:border-premium-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-premium-accent text-white py-5 rounded-xl font-black uppercase tracking-[0.3em] hover:bg-blue-500 shadow-xl hover:shadow-blue-500/20 transition-all active:scale-95"
          >
            Deploy Mission
          </button>
        </form>
      </motion.div>
    </div>
  );
}

import { cn } from './lib/utils';
