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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-[#141414] pb-6">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-1 italic">Mission Control</h2>
          <h1 className="text-4xl font-black uppercase tracking-tighter">Operational Overview</h1>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-[#141414] text-white px-6 py-3 flex items-center justify-center gap-2 hover:bg-black transition-all font-bold uppercase text-sm tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] active:shadow-none active:translate-x-1 active:translate-y-1"
        >
          <Plus className="w-4 h-4" />
          Deploy New Airdrop
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Active Tasks', value: stats.active, icon: Activity, color: 'text-green-600' },
          { label: 'Upcoming', value: stats.upcoming, icon: Clock, color: 'text-blue-600' },
          { label: 'Completed', value: stats.ended, icon: CheckCircle2, color: 'text-gray-500' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white border border-[#141414] p-6 group hover:bg-[#141414] transition-colors"
          >
            <div className="flex items-center justify-between">
              <stat.icon className={cn("w-6 h-6", stat.color, "group-hover:text-white")} />
              <span className="text-3xl font-black group-hover:text-white tracking-tighter">{stat.value}</span>
            </div>
            <p className="mt-4 text-[10px] uppercase font-bold tracking-widest text-[#141414] group-hover:text-white/70 italic">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Airdrops Table */}
      <div className="bg-white border border-[#141414] overflow-hidden">
        <div className="grid grid-cols-6 p-4 border-b border-[#141414] bg-gray-50 font-serif italic text-xs uppercase tracking-widest text-gray-500">
          <div className="col-span-2">Airdrop Name</div>
          <div>Status</div>
          <div>Progress</div>
          <div>Deployed</div>
          <div className="text-right">Action</div>
        </div>

        {airdrops.length === 0 ? (
          <div className="p-12 text-center text-gray-400 italic">
            No active operations detected. Click "Deploy" to begin.
          </div>
        ) : (
          airdrops.map((airdrop, i) => (
            <Link 
              to={`/airdrop/${airdrop.id}`}
              key={airdrop.id}
              className="grid grid-cols-6 p-4 border-b border-[#141414] hover:bg-[#141414] hover:text-white transition-all group items-center"
            >
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-bold uppercase tracking-tight">{airdrop.name}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-widest opacity-70">
                {airdrop.status}
              </div>
              <div className="flex items-center gap-2 pr-4">
                <div className="flex-1 h-1 bg-gray-200 group-hover:bg-gray-700">
                  <div className="h-full bg-[#141414] group-hover:bg-white transition-all" style={{ width: '45%' }} />
                </div>
                <span className="text-[10px] font-mono">45%</span>
              </div>
              <div className="text-[10px] font-mono opacity-50">
                {formatDate(airdrop.createdAt)}
              </div>
              <div className="text-right">
                <ChevronRight className="w-4 h-4 ml-auto" />
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white border-2 border-[#141414] p-8 max-w-md w-full relative"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl font-bold hover:scale-110 transition-transform">×</button>
        <h3 className="text-2xl font-black uppercase tracking-tighter mb-6">New Operation</h3>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest italic">Airdrop Name</label>
            <input 
              required
              autoFocus
              className="w-full border-b-2 border-[#141414] py-2 focus:outline-none focus:border-blue-600 transition-colors bg-transparent placeholder:text-gray-300"
              placeholder="e.g. MONAD INCENTIVIZED TESTNET"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest italic">Initial Status</label>
            <div className="grid grid-cols-3 gap-2">
              {['active', 'upcoming', 'ended'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                    status === s ? "bg-[#141414] text-white border-[#141414]" : "border-gray-200 hover:border-[#141414]"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-[#141414] text-white py-4 font-black uppercase tracking-[0.2em] hover:bg-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:shadow-none active:translate-x-1 active:translate-y-1 transition-all"
          >
            Deploy Mission
          </button>
        </form>
      </motion.div>
    </div>
  );
}

import { cn } from './lib/utils';
