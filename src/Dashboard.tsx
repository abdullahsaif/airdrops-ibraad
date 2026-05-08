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
  serverTimestamp,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
  updateDoc
} from './lib/firebase';
import { useAuth } from './AuthWrapper';
import { motion } from 'motion/react';
import { Plus, ChevronRight, Activity, Clock, CheckCircle2, Trash2, Calendar, Shield, ExternalLink, ArrowUpRight, Settings, Pencil, Settings2, AppWindow } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, cn, getRelativeDays, getFaviconUrl } from './lib/utils';

export function Dashboard() {
  const { user } = useAuth();
  const { folderId } = useParams();
  const [airdrops, setAirdrops] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAirdrop, setEditingAirdrop] = useState<any>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch folders for categories and modal
    const foldersQ = query(collection(db, 'projectFolders'), where('ownerId', '==', user.uid));
    const unsubscribeFolders = onSnapshot(foldersQ, (snapshot) => {
      setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Main airdrops query
    const q = query(collection(db, 'airdrops'), where('ownerId', '==', user.uid));
    const unsubscribeAirdrops = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Filter based on route (if in folder view or unclassified)
        if (folderId) {
          setAirdrops(data.filter(a => a.folderId === folderId));
        } else {
          setAirdrops(data.filter(a => !a.folderId));
        }
        
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'airdrops')
    );

    return () => {
      unsubscribeFolders();
      unsubscribeAirdrops();
    };
  }, [user, folderId]);

  const currentFolder = folders.find(f => f.id === folderId);

const stats = {
    active: airdrops.filter(a => a.status === 'active').length,
    upcoming: airdrops.filter(a => a.status === 'upcoming').length,
    ended: airdrops.filter(a => a.status === 'ended').length,
  };

  const handleDeleteAirdrop = async (airdropId: string) => {
    if (!user) return;
    if (!confirm("Confirm data erasure? All associated sectors and tasks will be permanently removed.")) return;

    try {
      const batch = writeBatch(db);
      
      // Delete associated folders
      const folderSnap = await getDocs(query(
        collection(db, 'folders'), 
        where('airdropId', '==', airdropId),
        where('ownerId', '==', user.uid)
      ));
      folderSnap.docs.forEach(d => batch.delete(d.ref));
      
      // Delete associated tasks
      const taskSnap = await getDocs(query(
        collection(db, 'tasks'), 
        where('airdropId', '==', airdropId),
        where('ownerId', '==', user.uid)
      ));
      taskSnap.docs.forEach(d => batch.delete(d.ref));
      
      // Delete the airdrop itself
      batch.delete(doc(db, 'airdrops', airdropId));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `airdrops/${airdropId}`);
    }
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
          <h1 className="text-5xl font-display font-extrabold uppercase tracking-tighter text-white">
            {currentFolder ? currentFolder.name : 'Command Center'}
          </h1>
        </div>
        <button 
          onClick={() => setShowNewModal(true)}
          className="bg-premium-accent text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-premium-accent/20 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Deploy Mission
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] text-premium-muted italic">
            {currentFolder ? `Project Cluster: ${currentFolder.name}` : 'Neural Deployments'}
          </h2>
          <div className="text-[10px] font-mono text-premium-muted opacity-50 uppercase">{airdrops.length} Clusters Verified</div>
        </div>

        {airdrops.length === 0 ? (
          <div className="bg-premium-card border border-dashed border-premium-border p-20 rounded-3xl text-center space-y-6">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto">
              <Activity className="w-8 h-8 text-premium-muted opacity-20" />
            </div>
            <div className="space-y-2">
              <p className="text-white font-bold uppercase tracking-widest text-sm italic">Sector is Offline</p>
              <p className="text-premium-muted italic text-xs max-w-xs mx-auto">No neural connections detected in this coordinate. Deploy a mission or establish a sub-sector to begin tracking.</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <button 
                onClick={() => setShowNewModal(true)}
                className="bg-premium-accent text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-lg shadow-premium-accent/20"
              >
                Deploy Link
              </button>
              {!folderId && (
                <button 
                  onClick={async () => {
                    const name = prompt("Establish Sector Name:");
                    if (name && user) {
                      try {
                        await addDoc(collection(db, 'projectFolders'), {
                          name: name.trim(),
                          ownerId: user.uid,
                          createdAt: serverTimestamp()
                        });
                      } catch (error) {
                        handleFirestoreError(error, OperationType.CREATE, 'projectFolders');
                      }
                    }
                  }}
                  className="bg-white/5 border border-premium-border text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-white/10 transition-all"
                >
                  Create Sector
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {airdrops.map((airdrop, i) => (
              <AirdropCard 
                key={airdrop.id} 
                airdrop={airdrop} 
                index={i} 
                onEdit={() => setEditingAirdrop(airdrop)}
                onDelete={() => handleDeleteAirdrop(airdrop.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* New Airdrop Modal */}
      {showNewModal && (
        <AirdropModal 
          onClose={() => setShowNewModal(false)} 
          onSuccess={() => setShowNewModal(false)}
          folders={folders}
          initialFolderId={folderId}
        />
      )}

      {/* Edit Airdrop Modal */}
      {editingAirdrop && (
        <AirdropModal 
          airdrop={editingAirdrop}
          onClose={() => setEditingAirdrop(null)} 
          onSuccess={() => setEditingAirdrop(null)}
          folders={folders}
        />
      )}
    </div>
  );
}

function AirdropCard({ airdrop, index, onEdit, onDelete }: { airdrop: any, index: number, onEdit: () => void, onDelete: () => Promise<void> }) {
  const { user } = useAuth();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!user || !isExpanded) return;
    const q = query(
      collection(db, 'tasks'), 
      where('airdropId', '==', airdrop.id), 
      where('ownerId', '==', user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user, airdrop.id, isExpanded]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('airdropId', airdrop.id);
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.4 : 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "group relative h-full",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div 
        onClick={() => {
          if (airdrop.url) window.open(airdrop.url, '_blank');
          else navigate(`/airdrop/${airdrop.id}`);
        }}
        className="premium-gradient-card border border-premium-border rounded-2xl group hover:border-premium-accent transition-all duration-300 shadow-lg overflow-hidden h-full flex flex-col cursor-pointer"
      >
        <div className="p-6 space-y-5 flex-1">
          {/* Top Bar */}
          <div className="flex items-start justify-between">
            <div className={cn(
              "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border",
              airdrop.status === 'active' ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-premium-border text-premium-muted bg-white/5"
            )}>
              {airdrop.status}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="p-1.5 text-premium-muted hover:text-premium-accent transition-colors relative z-10"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                className="p-1.5 text-premium-muted hover:text-red-400 transition-colors relative z-10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Title & Icon Area */}
          <div className="flex items-center gap-4 group/handle">
            <div 
              className={cn(
                "w-12 h-12 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center overflow-hidden flex-shrink-0 transition-all",
                airdrop.url ? "group-hover:border-premium-accent/50 group-hover:bg-premium-accent/5" : ""
              )}
            >
              {airdrop.url ? (
                <img 
                  src={getFaviconUrl(airdrop.url) || ''} 
                  alt="" 
                  className="w-7 h-7 object-contain"
                  onError={(e) => (e.currentTarget.style.display = 'none')}
                />
              ) : (
                <Shield className="w-6 h-6 text-premium-muted opacity-20" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="block text-xl font-display font-black text-white uppercase tracking-tight group-hover:text-premium-accent transition-colors truncate">
                  {airdrop.name}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <Clock className="w-3 h-3 text-premium-muted" />
                <span className="text-[9px] text-premium-muted uppercase font-bold tracking-widest">{getRelativeDays(airdrop.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Mini Stats and Link Shortcut */}
          <div className="grid grid-cols-2 gap-4 py-2 border-y border-white/5 mx-[-1.5rem] px-6">
            <div className="space-y-0.5">
              <p className="text-[8px] font-black text-premium-muted uppercase tracking-widest">Modules</p>
              <div className="flex items-center gap-1.5 text-white">
                <Activity className="w-3 h-3 text-premium-accent" />
                <span className="text-[10px] font-bold">{tasks.length || 0} Ready</span>
              </div>
            </div>
            <div className="space-y-0.5 text-right">
              <p className="text-[8px] font-black text-premium-muted uppercase tracking-widest">Difficulty</p>
              <span className={cn(
                "text-[10px] font-bold uppercase tracking-widest",
                airdrop.difficulty === 'easy' ? "text-emerald-400" :
                airdrop.difficulty === 'hard' ? "text-red-400" : "text-amber-400"
              )}>
                {airdrop.difficulty || 'Med'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-3 bg-white/2 border-t border-white/5 flex items-center gap-2">
           {airdrop.url ? (
             <div className="flex-1 bg-premium-accent text-white py-3 rounded-lg flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-premium-accent/10 hover:bg-blue-500 group/launch">
               Launch Mission
               <ExternalLink className="w-3 h-3 group-hover/launch:translate-x-0.5 group-hover/launch:-translate-y-0.5 transition-transform" />
             </div>
           ) : (
             <div className="flex-1 bg-white/5 hover:bg-white/10 text-white py-3 rounded-lg flex items-center justify-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all">
               Manage Console
               <ChevronRight className="w-3 h-3" />
             </div>
           )}
           <Link 
             to={`/airdrop/${airdrop.id}`}
             title="Console Management"
             onClick={(e) => e.stopPropagation()}
             className="w-10 h-10 bg-white/5 border border-white/5 text-premium-muted hover:text-premium-accent hover:border-premium-accent/30 rounded-lg flex items-center justify-center transition-all relative z-10"
           >
             <Settings2 className="w-4 h-4" />
           </Link>
        </div>
      </div>
    </motion.div>
  );
}

function AirdropModal({ 
  onClose, 
  onSuccess, 
  folders, 
  initialFolderId,
  airdrop 
}: { 
  onClose: () => void, 
  onSuccess: () => void, 
  folders: any[], 
  initialFolderId?: string,
  airdrop?: any 
}) {
  const { user } = useAuth();
  const [name, setName] = useState(airdrop?.name || '');
  const [url, setUrl] = useState(airdrop?.url || '');
  const [status, setStatus] = useState(airdrop?.status || 'active');
  const [frequency, setFrequency] = useState(airdrop?.frequency || 'daily');
  const [difficulty, setDifficulty] = useState(airdrop?.difficulty || 'medium');
  const [selectedFolderId, setSelectedFolderId] = useState(airdrop?.folderId || initialFolderId || '');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const handleQuickFolder = async () => {
    if (!newFolderName.trim() || !user) return;
    try {
      const docRef = await addDoc(collection(db, 'projectFolders'), {
        name: newFolderName,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setSelectedFolderId(docRef.id);
      setIsCreatingFolder(false);
      setNewFolderName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'projectFolders');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const data = {
        name,
        url,
        status,
        frequency,
        difficulty,
        folderId: selectedFolderId || null,
        updatedAt: serverTimestamp(),
      };

      if (airdrop) {
        await updateDoc(doc(db, 'airdrops', airdrop.id), data);
      } else {
        await addDoc(collection(db, 'airdrops'), {
          ...data,
          ownerId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      onSuccess();
    } catch (error) {
      handleFirestoreError(error, airdrop ? OperationType.UPDATE : OperationType.CREATE, 'airdrops');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-xl overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-premium-card border border-premium-border p-10 max-w-2xl w-full relative rounded-2xl shadow-2xl my-auto"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-2xl font-bold text-premium-muted hover:text-white transition-colors">×</button>
        <h3 className="text-3xl font-display font-extrabold uppercase tracking-tighter mb-8 text-white">
          {airdrop ? 'Refine Protocol' : 'Initialize Mission'}
        </h3>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Airdrop Identifier</label>
              <input 
                required
                autoFocus
                className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent transition-all text-sm text-white placeholder:text-white/10"
                placeholder="e.g. MONAD"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Target Uplink (URL)</label>
              <input 
                required
                className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent transition-all text-sm text-white placeholder:text-white/10"
                placeholder="https://..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Neural Sector (Folder)</label>
                <button 
                  type="button"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="text-[9px] font-black uppercase text-premium-accent hover:underline"
                >
                  {isCreatingFolder ? "Cancel creation" : "New sector"}
                </button>
             </div>
             {isCreatingFolder ? (
               <div className="flex gap-2">
                 <input 
                   autoFocus
                   className="flex-1 bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none text-sm text-white"
                   placeholder="New sector name..."
                   value={newFolderName}
                   onChange={(e) => setNewFolderName(e.target.value)}
                   onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickFolder())}
                 />
                 <button 
                   type="button"
                   onClick={handleQuickFolder}
                   className="px-6 bg-premium-accent text-white rounded-xl font-bold uppercase text-[10px]"
                 >
                   Establish
                 </button>
               </div>
             ) : (
                <select 
                  className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent transition-all text-sm text-white appearance-none cursor-pointer"
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                >
                  <option value="" className="bg-premium-bg">Unclassified Sector</option>
                  {folders.map(f => (
                    <option key={f.id} value={f.id} className="bg-premium-bg">{f.name}</option>
                  ))}
                </select>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Sync Frequency</label>
              <div className="grid grid-cols-2 gap-2">
                {['daily', '3-day', 'weekly', 'one-time'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      "py-2.5 text-[9px] font-black uppercase tracking-widest border rounded-lg transition-all",
                      frequency === f ? "bg-premium-accent text-white border-premium-accent shadow-lg shadow-premium-accent/20" : "border-premium-border text-premium-muted hover:border-premium-muted"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
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
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Risk Assessment</label>
              <div className="grid grid-cols-3 gap-2">
                {['easy', 'medium', 'hard'].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDifficulty(d)}
                    className={cn(
                      "py-2.5 text-[9px] font-black uppercase tracking-widest border rounded-lg transition-all",
                      difficulty === d ? "bg-premium-accent text-white border-premium-accent shadow-lg shadow-premium-accent/20" : "border-premium-border text-premium-muted hover:border-premium-muted"
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            type="submit"
            className="w-full bg-premium-accent text-white py-5 rounded-xl font-black uppercase tracking-[0.3em] hover:bg-blue-500 shadow-xl hover:shadow-blue-500/20 transition-all active:scale-95"
          >
            {airdrop ? 'Update Protocol' : 'Deploy Mission'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
