import React, { useEffect, useState, useRef } from 'react';
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
import { Plus, ChevronRight, Activity, Clock, CheckCircle2, Trash2, Calendar, Shield, ExternalLink, ArrowUpRight, Settings, Pencil, Settings2, AppWindow, GripVertical, MoveRight } from 'lucide-react';
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
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);
  const [isChainMode, setIsChainMode] = useState(false);
  const sessionWinRef = useRef<Window | null>(null);
  const [isOpening, setIsOpening] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSetActive = (id: string, autoOpen = false, win: Window | null = null) => {
    // Avoid double-setting if already active and we just want to update the ref
    if (win && sessionWinRef.current === win) return;
    
    setLastActiveId(id);
    
    // Auto-scroll the selected card into view
    setTimeout(() => {
      const element = document.getElementById(`airdrop-card-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 50);
    
    if (win) {
      sessionWinRef.current = win;
    }
    
    if (autoOpen) {
      // Prevent multiple concurrent launch attempts
      if (isOpening) return;
      
      const airdrop = airdrops.find(a => a.id === id);
      if (airdrop) {
        if (airdrop.url) {
          // Check if we already have an open window for THIS target to prevent double opening
          if (sessionWinRef.current && !sessionWinRef.current.closed && lastActiveId === id) {
             console.log("Mission already active in specialized uplink");
             return;
          }

          setIsOpening(true);
          const newWin = window.open(airdrop.url, '_blank');
          
          if (newWin) {
            sessionWinRef.current = newWin;
            setNextReady(false);
            // Small delay to let browser register the window
            setTimeout(() => setIsOpening(false), 800);
          } else {
            console.log("Auto-open blocked or failed");
            setNextReady(true);
            setIsOpening(false);
          }
        } else {
          navigate(`/airdrop/${airdrop.id}`);
          setIsOpening(false);
        }
      }
    }
  };

  const [nextReady, setNextReady] = useState(false);

  const toggleChainMode = () => {
    if (isChainMode) {
      setIsChainMode(false);
      setNextReady(false);
      sessionWinRef.current = null;
      return;
    }

    const targetId = lastActiveId || (airdrops.length > 0 ? airdrops[0].id : null);
    if (targetId) {
      sessionWinRef.current = null;
      setNextReady(false);
      setIsChainMode(true);
      setTimeout(() => {
        handleSetActive(targetId, true);
      }, 100);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === 's') {
        e.preventDefault();
        toggleChainMode();
      }

      if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setShowNewModal(true);
      }

      if (e.key === '?') {
        e.preventDefault();
        setShowHelpModal(prev => !prev);
      }

      if (e.key === 'Escape') {
        setShowNewModal(false);
        setEditingAirdrop(null);
        setShowHelpModal(false);
      }

      const currentIndex = airdrops.findIndex(a => a.id === lastActiveId);
      
      if (e.key.toLowerCase() === 'e' && lastActiveId) {
        e.preventDefault();
        const active = airdrops.find(a => a.id === lastActiveId);
        if (active) setEditingAirdrop(active);
      }

      if (e.key === 'Home') {
        e.preventDefault();
        if (airdrops.length > 0) handleSetActive(airdrops[0].id);
      }

      if (e.key === 'End') {
        e.preventDefault();
        if (airdrops.length > 0) handleSetActive(airdrops[airdrops.length - 1].id);
      }

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        if (currentIndex < airdrops.length - 1) {
          handleSetActive(airdrops[currentIndex + 1].id);
        }
      }

      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (currentIndex > 0) {
          handleSetActive(airdrops[currentIndex - 1].id);
        }
      }

      if (e.key === 'Enter' && lastActiveId && !isChainMode) {
        e.preventDefault();
        handleSetActive(lastActiveId, true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChainMode, lastActiveId, airdrops, isOpening]);

  // Monitor window for Chain Mode
  useEffect(() => {
    if (!isChainMode) {
      setNextReady(false);
      return;
    }

    // If no active ID, set to first
    if (!lastActiveId && airdrops.length > 0) {
      setLastActiveId(airdrops[0].id);
    }
    
    const interval = setInterval(() => {
      // Only proceed if we aren't currently in the middle of opening a window
      if (isOpening) return;

      if (sessionWinRef.current && sessionWinRef.current.closed) {
        sessionWinRef.current = null;
        
        // Find next index
        const currentIndex = airdrops.findIndex(a => a.id === lastActiveId);
        if (currentIndex !== -1 && currentIndex < airdrops.length - 1) {
          const nextAirdrop = airdrops[currentIndex + 1];
          // Try to Auto-Open directly
          handleSetActive(nextAirdrop.id, true);
        } else {
          setIsChainMode(false);
          setNextReady(false);
        }
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isChainMode, lastActiveId, airdrops, isOpening]);

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
        let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        
        // Sort by order, then by createdAt
        data.sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0);
        });

        // Filter based on route (if in folder view or unclassified)
        let filteredData = [];
        if (folderId) {
          filteredData = data.filter(a => a.folderId === folderId);
        } else {
          filteredData = data.filter(a => !a.folderId);
        }

        setAirdrops(filteredData);
        
        // Auto-set the first card as active on fresh load/refresh
        if (filteredData.length > 0 && !lastActiveId) {
          setLastActiveId(filteredData[0].id);
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

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleReorder = async (sourceIndex: number, targetIndex: number) => {
    if (!user || sourceIndex === targetIndex) return;

    const newAirdrops = [...airdrops];
    const [movedItem] = newAirdrops.splice(sourceIndex, 1);
    newAirdrops.splice(targetIndex, 0, movedItem);

    // Optimistic local update
    setAirdrops(newAirdrops);
    setDraggedIndex(null);
    setDragOverIndex(null);

    try {
      const batch = writeBatch(db);
      newAirdrops.forEach((airdrop, i) => {
        batch.update(doc(db, 'airdrops', airdrop.id), { 
          order: i,
          updatedAt: serverTimestamp() 
        });
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'airdrops/reorder');
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
        
        <div className="flex items-center gap-3">
          <button
            onClick={toggleChainMode}
            className={cn(
              "px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-500 flex items-center gap-2 border shadow-lg",
              isChainMode 
                ? "bg-premium-accent text-white border-premium-accent shadow-premium-accent/20" 
                : "bg-white/5 text-premium-muted border-premium-border hover:border-premium-accent/40"
            )}
          >
            <Activity className={cn("w-3.5 h-3.5", isChainMode && "animate-spin-slow")} />
            {isChainMode ? 'Sequence Mode: Active' : 'Start Sequence'}
          </button>
          
          <button 
            onClick={() => setShowNewModal(true)}
            className="bg-premium-accent text-white px-8 py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-blue-500 transition-all font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-premium-accent/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Deploy Mission
          </button>
        </div>
      </div>

      {isChainMode && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            "border rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between backdrop-blur-md gap-4 relative overflow-hidden transition-all duration-500",
            nextReady 
              ? "bg-premium-accent/20 border-premium-accent shadow-[0_0_50px_rgba(37,99,235,0.3)]" 
              : "bg-premium-accent/10 border-premium-accent/30"
          )}
        >
          <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-premium-accent/50 to-transparent" />
          
          <div className="flex items-center gap-6">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center shadow-inner transition-all duration-500",
              nextReady ? "bg-premium-accent text-white" : "bg-premium-accent/20 text-premium-accent"
            )}>
              <Activity className={cn("w-6 h-6", (isChainMode || nextReady) && "animate-pulse")} />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-[0.2em] text-premium-accent mb-1 flex items-center gap-2">
                {nextReady ? 'Mission Complete - Next Optimized' : 'Mission Chain Active'}
                <span className="flex gap-1">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1 h-1 bg-premium-accent rounded-full animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </span>
              </div>
              <div className="text-xs text-white/70 font-medium">
                {nextReady 
                  ? "Previous target neutralized. Next sector is primed and ready for deployment."
                  : "System is tracking your session. Close your current tab to unlock the next sector."}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-black/40 px-6 py-3 rounded-xl border border-white/5 min-w-[280px]">
            <div className="flex-1">
              <div className="text-[9px] font-mono text-premium-muted uppercase mb-0.5">Target Sector</div>
              <div className="text-[11px] font-bold text-white uppercase tracking-wider truncate max-w-[150px]">
                {nextReady 
                  ? airdrops[airdrops.findIndex(a => a.id === lastActiveId) + 1]?.name 
                  : airdrops.find(a => a.id === lastActiveId)?.name || 'Initializing...'}
              </div>
            </div>
            
            {nextReady ? (
              <button
                onClick={() => {
                  const nextIndex = airdrops.findIndex(a => a.id === lastActiveId) + 1;
                  if (nextIndex < airdrops.length) {
                    setNextReady(false);
                    handleSetActive(airdrops[nextIndex].id, true);
                  }
                }}
                className="bg-premium-accent text-white px-6 py-2 rounded-lg font-black uppercase text-[10px] tracking-widest hover:bg-blue-500 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] animate-bounce"
              >
                Launch Next
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-px h-8 bg-white/10" />
                <button 
                  onClick={() => {
                    const nextIndex = airdrops.findIndex(a => a.id === lastActiveId) + 1;
                    if (nextIndex < airdrops.length) {
                      handleSetActive(airdrops[nextIndex].id, true);
                    }
                  }}
                  className="p-2 hover:bg-premium-accent/20 rounded-lg transition-colors text-premium-accent"
                  title="Skip to Next"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

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
          <div className="flex flex-wrap items-stretch justify-center md:justify-start gap-y-12 gap-x-2 md:gap-x-4">
            {airdrops.map((airdrop, i) => (
              <React.Fragment key={airdrop.id}>
                <div 
                  id={`airdrop-card-${airdrop.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('sourceIndex', i.toString());
                    e.dataTransfer.effectAllowed = 'move';
                    setDraggedIndex(i);
                  }}
                  onDragEnd={() => {
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverIndex !== i) setDragOverIndex(i);
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverIndex(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedIndex !== null && draggedIndex !== i) {
                      handleReorder(draggedIndex, i);
                    }
                    setDraggedIndex(null);
                    setDragOverIndex(null);
                  }}
                  className={cn(
                    "transition-all duration-300 ease-in-out relative select-none w-full sm:w-[calc(50%-1.5rem)] lg:w-[calc(33.333%-2rem)] 2xl:w-[calc(16.66%-2rem)] min-w-[200px]",
                    draggedIndex === i ? "opacity-20 scale-95" : "opacity-100 scale-100 cursor-grab active:cursor-grabbing",
                    dragOverIndex === i && draggedIndex !== i ? "after:content-[''] after:absolute after:top-0 after:left-0 after:right-0 after:h-1 after:bg-premium-accent after:rounded-full after:animate-pulse z-40 transform translate-y-3" : ""
                  )}
                >
                  <AirdropCard 
                    airdrop={airdrop} 
                    index={i} 
                    isActive={lastActiveId === airdrop.id}
                    onOpen={(win) => handleSetActive(airdrop.id, false, win)}
                    onEdit={() => setEditingAirdrop(airdrop)}
                    onDelete={() => handleDeleteAirdrop(airdrop.id)}
                  />
                </div>
                {i < airdrops.length - 1 && (
                  <div className="hidden sm:flex items-center justify-center -mx-2 md:-mx-4 z-10 self-center">
                    <motion.div
                      animate={{ 
                        x: [0, 4, 0],
                        opacity: [0.3, 0.6, 0.3]
                      }}
                      transition={{ 
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear"
                      }}
                      className="text-premium-accent drop-shadow-[0_0_12px_rgba(37,99,235,0.3)]"
                    >
                      <MoveRight className="w-4 h-4 md:w-5 md:h-5" />
                    </motion.div>
                  </div>
                )}
              </React.Fragment>
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

      {/* Shortcuts Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setShowHelpModal(false)}>
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-premium-card border border-premium-border p-8 max-w-md w-full rounded-2xl shadow-2xl space-y-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black uppercase tracking-tighter text-white">System Hotkeys</h3>
              <button onClick={() => setShowHelpModal(false)} className="text-premium-muted hover:text-white">×</button>
            </div>

            <div className="space-y-4">
              {[
                { keys: ['S'], label: 'Toggle Sequence Mode' },
                { keys: ['N'], label: 'New Mission' },
                { keys: ['E'], label: 'Edit Selected' },
                { keys: ['Enter'], label: 'Launch Selected' },
                { keys: ['Arrows'], label: 'Navigate Cards' },
                { keys: ['Home', 'End'], label: 'Jump to edges' },
                { keys: ['?'], label: 'Toggle this help' },
                { keys: ['Esc'], label: 'Close everything' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between border-b border-white/5 pb-2 text-sm">
                  <span className="text-premium-muted uppercase text-[10px] font-bold">{item.label}</span>
                  <div className="flex gap-1">
                    {item.keys.map(k => (
                      <kbd key={k} className="px-2 py-0.5 bg-white/10 rounded border border-white/10 text-[10px] font-black text-premium-accent">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-center text-premium-muted uppercase tracking-widest font-black">Speed is the only strategy.</p>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function AirdropCard({ airdrop, index, isActive, onOpen, onEdit, onDelete }: { airdrop: any, index: number, isActive?: boolean, onOpen?: (win: Window | null) => void, onEdit: () => void, onDelete: () => Promise<void> }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);

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

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      transition={{ delay: index * 0.05 }}
      className="group relative h-full pointer-events-none"
    >
      <div 
        onClick={(e) => {
          e.stopPropagation();
          if (airdrop.url) {
            const win = window.open(airdrop.url, '_blank');
            onOpen?.(win);
          } else {
            onOpen?.(null);
            navigate(`/airdrop/${airdrop.id}`);
          }
        }}
        className={cn(
          "premium-gradient-card border rounded-2xl group transition-all duration-500 shadow-lg overflow-hidden h-full flex flex-col cursor-pointer pointer-events-auto relative",
          isActive 
            ? "border-premium-accent bg-premium-accent/[0.12] shadow-[0_0_60px_rgba(37,99,235,0.25),inset_0_1px_1px_rgba(255,255,255,0.1),inset_0_0_40px_rgba(37,99,235,0.1)] ring-1 ring-premium-accent" 
            : "border-premium-border hover:border-premium-accent/40"
        )}
      >
        {isActive && (
          <div className="absolute top-0 right-0 p-2 z-[2]">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-bl-xl bg-premium-accent border-l border-b border-white/20 shadow-lg shadow-premium-accent/40">
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white">Active Sector</span>
            </div>
          </div>
        )}
        <div className="p-6 space-y-5 flex-1">
          {/* Top Bar */}
          <div className="flex items-start justify-between">
            <div 
              className={cn(
                "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-[0.2em] border flex items-center gap-1.5",
                airdrop.status === 'active' ? "border-emerald-500/20 text-emerald-400 bg-emerald-500/5" : "border-premium-border text-premium-muted bg-white/5"
              )}
            >
              <GripVertical className="w-2.5 h-2.5 opacity-40 shrink-0" />
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
             onClick={(e) => {
               e.stopPropagation();
               onOpen?.(null);
             }}
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
          order: folders.length, // Simple default order
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
