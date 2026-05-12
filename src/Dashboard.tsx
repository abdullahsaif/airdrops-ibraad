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
  const navigate = useNavigate();
  const { folderId } = useParams();
  const [airdrops, setAirdrops] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAirdrop, setEditingAirdrop] = useState<any>(null);
  const [lastActiveId, setLastActiveId] = useState<string | null>(null);
  const [isChainMode, setIsChainMode] = useState(false);
  const sessionWinRef = useRef<Window | null>(null);
  const isOpeningRef = useRef(false);
  const [isOpening, setIsOpeningState] = useState(false);
  const launchLockRef = useRef(false); // Global lock to prevent any concurrent launches
  const lastLaunchTimeRef = useRef(0);
  const lastLaunchIdRef = useRef<string | null>(null);
  
  const setIsOpening = (val: boolean) => {
    isOpeningRef.current = val;
    setIsOpeningState(val);
  };
  const [popupBlocked, setPopupBlocked] = useState(false);

  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSetActive = async (id: string, autoOpen = false, win: Window | null = null) => {
    const now = Date.now();

    // Prevent multiple launches simultaneously
    if (launchLockRef.current && autoOpen) {
      console.log("Mission critical: Launch already in progress, blocking concurrent deployment.");
      return;
    }

    if (autoOpen) {
      if (isOpeningRef.current) return;
      
      // Minimum gap between ANY automated launch (1.5s)
      if (now - lastLaunchTimeRef.current < 1500) return;

      // Duplicate guard (3s for same ID)
      if (lastLaunchIdRef.current === id && now - lastLaunchTimeRef.current < 3000) return;
    }

    setLastActiveId(id);
    
    // Smooth scroll with better logic
    requestAnimationFrame(() => {
      const element = document.getElementById(`airdrop-card-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
    
    if (win) {
      sessionWinRef.current = win;
    }
    
    if (autoOpen) {
      launchLockRef.current = true;
      const airdrop = airdrops.find(a => a.id === id);
      
      if (airdrop && airdrop.url) {
        // Final sanity check on window state
        if (sessionWinRef.current && !sessionWinRef.current.closed && lastLaunchIdRef.current === id) {
           launchLockRef.current = false;
           return;
        }

        setIsOpening(true);
        lastLaunchTimeRef.current = now;
        lastLaunchIdRef.current = id;
        setPopupBlocked(false);
        setNextReady(false);
        
        try {
          const newWin = window.open(airdrop.url, '_blank');
          
          if (newWin) {
            sessionWinRef.current = newWin;
            // Lock for 2s to allow the OS/Browser to handle the new tab
            setTimeout(() => {
              setIsOpening(false);
              launchLockRef.current = false;
            }, 2000);
          } else {
            console.log("Transmission intercepted by popup-guard");
            setNextReady(true);
            setIsOpening(false);
            setPopupBlocked(true);
            launchLockRef.current = false;
          }
        } catch (e) {
          console.error("Launch failure:", e);
          setIsOpening(false);
          launchLockRef.current = false;
        }
      } else if (airdrop) {
        navigate(`/airdrop/${airdrop.id}`);
        setIsOpening(false);
        launchLockRef.current = false;
      } else {
        launchLockRef.current = false;
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
      setPopupBlocked(false);
      setIsChainMode(true);
      // Trigger first one immediately to improve chances against popup blockers
      handleSetActive(targetId, true);
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

      if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
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

      if (e.key === 'Enter' && lastActiveId) {
        e.preventDefault();
        if (isOpeningRef.current) return; // Guard against multiple enter presses
        
        if (nextReady) {
          const currentIndex = airdrops.findIndex(a => a.id === lastActiveId);
          if (currentIndex !== -1 && currentIndex < airdrops.length - 1) {
            handleSetActive(airdrops[currentIndex + 1].id, true);
          }
        } else {
          handleSetActive(lastActiveId, true);
        }
      }

      if (e.key === ' ' && lastActiveId && nextReady) {
        e.preventDefault();
        if (isOpeningRef.current) return;
        
        const currentIndex = airdrops.findIndex(a => a.id === lastActiveId);
        if (currentIndex !== -1 && currentIndex < airdrops.length - 1) {
          handleSetActive(airdrops[currentIndex + 1].id, true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isChainMode, lastActiveId, airdrops, isOpening]);

  // Stable Monitor for Chain Mode
  const airdropsRef = useRef(airdrops);
  const lastActiveIdRef = useRef(lastActiveId);
  const isChainModeRef = useRef(isChainMode);

  useEffect(() => {
    airdropsRef.current = airdrops;
    lastActiveIdRef.current = lastActiveId;
    isChainModeRef.current = isChainMode;
  }, [airdrops, lastActiveId, isChainMode]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Exit if not in chain mode or window is still opening
      if (!isChainModeRef.current || isOpeningRef.current || launchLockRef.current) return;

      // If a window was open and is now closed
      if (sessionWinRef.current && sessionWinRef.current.closed) {
        console.log("Bridge protocol: Sector neutralized, jumping to next coordinate.");
        sessionWinRef.current = null;
        
        const currentAirdrops = airdropsRef.current;
        const currentActiveId = lastActiveIdRef.current;
        const currentIndex = currentAirdrops.findIndex(a => a.id === currentActiveId);

        if (currentIndex !== -1 && currentIndex < currentAirdrops.length - 1) {
          const nextAirdrop = currentAirdrops[currentIndex + 1];
          const now = Date.now();
          // Ensure we don't rapid fire from interval glitch
          if (now - lastLaunchTimeRef.current > 2000) {
            handleSetActive(nextAirdrop.id, true);
          }
        } else {
          console.log("Strategic objectives finalized.");
          setIsChainMode(false);
        }
      }
    }, 1000); // 1s interval is more than enough and more stable
    
    return () => clearInterval(interval);
  }, []); // Run once, use refs for dynamic state

  useEffect(() => {
    if (!user) return;

    // Fetch folders for categories and modal
    const foldersQ = query(collection(db, 'projectFolders'), where('ownerId', '==', user.uid));
    const unsubscribeFolders = onSnapshot(foldersQ, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data.sort((a, b) => {
        const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
        const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
        if (orderA !== orderB) return orderA - orderB;
        return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
      });
      setFolders(data);
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
          
          // Use Date.now() as fallback for items without a resolved timestamp yet
          // to ensure new items appear at the end among items with the same order.
          const timeA = a.createdAt?.toMillis?.() || Date.now();
          const timeB = b.createdAt?.toMillis?.() || Date.now();
          return timeA - timeB;
        });

        // Filter based on route (if in folder view or unclassified)
        let filteredData = [];
        if (folderId) {
          filteredData = data.filter(a => a.folderId === folderId);
        } else {
          filteredData = data.filter(a => !a.folderId);
        }

        setAirdrops(filteredData);
        
        // Reset or update lastActiveId when folder changes or list refreshes
        if (filteredData.length > 0) {
          const stillExists = filteredData.find(a => a.id === lastActiveId);
          if (!stillExists) {
            setLastActiveId(filteredData[0].id);
          }
        } else {
          setLastActiveId(null);
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
      
      // Delete associated neural sectors if any (though usually folders belong to airdrops in this schema)
      const folderSnap = await getDocs(query(
        collection(db, 'projectFolders'), 
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
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 pb-10">
        <div className="space-y-6 flex-1">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 rounded-md bg-premium-accent/10 border border-premium-accent/20">
                <div className="flex items-center gap-2 text-premium-accent text-[10px] font-bold uppercase tracking-[0.2em]">
                  <Activity className="w-3 h-3 animate-pulse" />
                  System Online
                </div>
              </div>
              <div className="h-px flex-1 bg-white/[0.05]" />
            </div>
            <h1 className="text-6xl md:text-7xl font-display font-extrabold uppercase tracking-tight text-white leading-none">
              <span className="text-gradient">
                {currentFolder ? currentFolder.name : 'Vanguard'}
              </span>
              <span className="text-premium-accent block md:inline md:ml-4 text-4xl md:text-5xl opacity-50">.OS</span>
            </h1>
          </div>

          <div className="relative group max-w-md">
            <input 
              id="search-input"
              type="text"
              placeholder="QUICK SEARCH ( / )"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.02] border border-white/[0.08] p-4 pl-12 rounded-2xl text-[11px] font-bold uppercase tracking-widest text-white placeholder:text-premium-muted/30 focus:outline-none focus:border-premium-accent/50 focus:bg-white/[0.05] transition-all"
            />
            <Activity className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-premium-muted group-focus-within:text-premium-accent transition-colors opacity-30" />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-premium-muted hover:text-white uppercase tracking-widest"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={toggleChainMode}
            className={cn(
              "premium-button px-7 py-4",
              isChainMode 
                ? "bg-premium-accent text-white shadow-[0_0_30px_rgba(59,130,246,0.3)]" 
                : "bg-white/[0.03] text-premium-muted border border-white/[0.08] hover:border-premium-accent/40 hover:text-white"
            )}
          >
            <div className="flex items-center gap-3">
              <Shield className={cn("w-4 h-4", isChainMode && "animate-pulse")} />
              {isChainMode ? 'Sequence Mode: Active' : 'Initiate Chain'}
            </div>
          </button>
          
          <button 
            onClick={() => setShowNewModal(true)}
            className="premium-button-primary px-10 py-5 text-xs"
          >
            <div className="flex items-center gap-3">
              <Plus className="w-5 h-5" />
              Analyze New Protocol
            </div>
          </button>
        </div>
      </div>

      {isChainMode && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "premium-glass rounded-3xl p-8 flex flex-col xl:flex-row items-center justify-between gap-8 relative overflow-hidden transition-all duration-700",
            nextReady && "ring-2 ring-premium-accent/50 shadow-[0_0_80px_rgba(59,130,246,0.15)]"
          )}
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-premium-accent/40 to-transparent" />
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-premium-accent/5 blur-[100px] rounded-full" />
          
          <div className="flex items-center gap-8 relative z-10">
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-700 shadow-2xl",
              nextReady ? "bg-premium-accent text-white" : "bg-white/[0.03] border border-white/[0.05] text-premium-accent"
            )}>
              <Activity className={cn("w-10 h-10", (isChainMode || nextReady) && "animate-pulse")} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold uppercase tracking-[0.3em] text-premium-accent">
                  {nextReady ? (popupBlocked ? 'ACTION REQUIRED' : 'NEURAL READY') : 'SEQUENCER ACTIVE'}
                </span>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-premium-accent rounded-full animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
              <p className="text-lg font-medium text-white max-w-xl leading-relaxed">
                {nextReady 
                  ? (popupBlocked 
                      ? "Neural link intercepted by browser security. Manual override required for deployment." 
                      : "Mission successfully executed. Next sector is ready for initialization.")
                  : "Scanning session patterns. Close the current uplink to automatically bridge to the next coordinate."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 bg-white/[0.03] p-5 rounded-2xl border border-white/[0.05] min-w-[360px] relative z-10 group">
            <div className="flex-1">
              <div className="text-[10px] font-bold text-premium-muted uppercase mb-1 tracking-widest opacity-50">Target Uplink</div>
              <div className="text-lg font-bold text-white uppercase tracking-tight truncate max-w-[200px]">
                {nextReady 
                  ? airdrops[airdrops.findIndex(a => a.id === lastActiveId) + 1]?.name 
                  : airdrops.find(a => a.id === lastActiveId)?.name || 'Syncing...'}
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
                className="premium-button-primary px-8 py-4 animate-shimmer"
              >
                Launch Next
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="w-px h-10 bg-white/[0.05]" />
                <button 
                  onClick={() => {
                    const nextIndex = airdrops.findIndex(a => a.id === lastActiveId) + 1;
                    if (nextIndex < airdrops.length) {
                      handleSetActive(airdrops[nextIndex].id, true);
                    }
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white/[0.03] hover:bg-premium-accent hover:text-white rounded-xl transition-all text-premium-accent border border-white/[0.05]"
                  title="Forward to Next Sector"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { label: 'Active Protocols', value: stats.active, icon: Shield, color: 'text-blue-400', bg: 'bg-blue-400/5' },
          { label: 'Pending Bridge', value: stats.upcoming, icon: Clock, color: 'text-zinc-400', bg: 'bg-white/5' },
          { label: 'Neutralized', value: stats.ended, icon: CheckCircle2, color: 'text-premium-muted', bg: 'bg-white/5' },
        ].map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.8 }}
            className="premium-gradient-card p-10 rounded-[32px] group relative overflow-hidden"
          >
            <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/[0.01] rounded-full group-hover:scale-150 transition-transform duration-700" />
            <div className="flex items-center justify-between mb-10 relative z-10">
              <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500", stat.bg)}>
                <stat.icon className={cn("w-7 h-7", stat.color)} />
              </div>
              <span className="text-5xl font-display font-black text-white tracking-tighter tabular-nums text-gradient">{stat.value}</span>
            </div>
            <p className="text-[11px] uppercase font-bold tracking-[0.3em] text-premium-muted group-hover:text-premium-accent transition-colors relative z-10">{stat.label}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-y-12 gap-x-6">
            {airdrops
              .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((airdrop, i) => (
              <div key={airdrop.id} className="flex items-center gap-4">
                <div 
                  id={`airdrop-card-${airdrop.id}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('sourceIndex', i.toString());
                    e.dataTransfer.setData('airdropId', airdrop.id);
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
                    "transition-all duration-300 ease-in-out relative select-none flex-1 h-full",
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
                  <div className="hidden lg:flex items-center justify-center shrink-0 -mr-10 z-10">
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
                      <MoveRight className="w-5 h-5" />
                    </motion.div>
                  </div>
                )}
              </div>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-premium-bg/90 backdrop-blur-2xl" onClick={() => setShowHelpModal(false)}>
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="premium-glass p-10 max-w-md w-full rounded-[40px] shadow-2xl space-y-10 border border-white/[0.08]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-premium-accent text-[10px] font-black uppercase tracking-[0.2em]">
                  <div className="w-1 h-1 bg-premium-accent rounded-full" />
                  Neural Interface
                </div>
                <h3 className="text-2xl font-display font-black uppercase tracking-tight text-white leading-none">System Hotkeys</h3>
              </div>
              <button 
                onClick={() => setShowHelpModal(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.03] text-premium-muted hover:text-white hover:bg-white/[0.1] transition-all text-xl font-light"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              {[
                { keys: ['S'], label: 'Toggle Sequence Mode' },
                { keys: ['N'], label: 'New Mission' },
                { keys: ['E'], label: 'Edit Selected' },
                { keys: ['/'], label: 'Quick Search' },
                { keys: ['Enter'], label: 'Launch Selected' },
                { keys: ['Arrows'], label: 'Navigate Cards' },
                { keys: ['Home', 'End'], label: 'Jump to edges' },
                { keys: ['?'], label: 'Toggle this help' },
                { keys: ['Esc'], label: 'Close everything' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between border-b border-white/[0.03] pb-3 text-sm group">
                  <span className="text-premium-muted uppercase text-[10px] font-bold tracking-widest group-hover:text-white transition-colors">{item.label}</span>
                  <div className="flex gap-1.5">
                    {item.keys.map(k => (
                      <kbd key={k} className="min-w-[24px] h-6 flex items-center justify-center px-2 bg-white/[0.03] rounded-md border border-white/[0.1] text-[9px] font-black text-premium-accent shadow-sm">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-6 border-t border-white/[0.05] space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white italic">
                <div className="w-1 h-1 bg-white rotate-45" />
                Strategic Deployment
              </div>
              <p className="text-[10px] text-premium-muted leading-relaxed uppercase opacity-60">
                Utilize the <span className="text-premium-accent font-bold">SHARE</span> function for persistent connectivity. Neural links are optimized for direct transmission.
              </p>
            </div>

            <p className="text-[10px] text-center text-premium-accent uppercase tracking-[0.3em] font-black italic opacity-40 animate-pulse">Execution is everything.</p>
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

  const lastClickTimeRef = useRef(0);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -12, scale: 1.02 }}
      transition={{ 
        delay: index * 0.05, 
        duration: 0.7,
        ease: [0.23, 1, 0.32, 1]
      }}
      className="group relative h-full pointer-events-none"
    >
      <div 
        onClick={(e) => {
          e.stopPropagation();
          const now = Date.now();
          if (now - lastClickTimeRef.current < 1000) return;
          lastClickTimeRef.current = now;

          if (airdrop.url) {
            const win = window.open(airdrop.url, '_blank');
            onOpen?.(win);
          } else {
            onOpen?.(null);
            navigate(`/airdrop/${airdrop.id}`);
          }
        }}
        className={cn(
          "premium-gradient-card rounded-[40px] group transition-all duration-700 overflow-hidden h-full flex flex-col cursor-pointer pointer-events-auto relative border border-white/[0.04]",
          isActive 
            ? "border-premium-accent/60 shadow-[0_0_50px_rgba(59,130,246,0.15)] bg-premium-accent/[0.05]" 
            : "hover:border-white/[0.12] hover:bg-white/[0.02]"
        )}
      >
        {/* Futuristic Grid Accent */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 border-[0.5px] border-white/20" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {isActive && (
          <div className="absolute top-0 right-0 p-6 z-10">
            <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-premium-accent/10 border border-premium-accent/30 backdrop-blur-2xl shadow-[0_0_20px_rgba(59,130,246,0.2)]">
              <div className="w-2 h-2 bg-premium-accent rounded-full animate-pulse shadow-[0_0_8px_#3b82f6]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-premium-accent">Neural Active</span>
            </div>
          </div>
        )}
        
        <div className="p-10 space-y-10 flex-1 relative z-10">
          {/* Top Bar with Badge and Actions */}
          <div className="flex items-center justify-between">
            <div 
              className={cn(
                "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.3em] border flex items-center gap-2.5 transition-all duration-500",
                airdrop.status === 'active' 
                  ? "border-premium-accent/30 text-premium-accent bg-premium-accent/5 shadow-[0_0_15px_rgba(59,130,246,0.1)]" 
                  : "border-white/10 text-premium-muted bg-white/5"
              )}
            >
              <div className={cn("w-1.5 h-1.5 rounded-full", airdrop.status === 'active' ? "bg-premium-accent animate-pulse" : "bg-white/20")} />
              {airdrop.status}
            </div>
            
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-4 group-hover:translate-x-0">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/[0.03] text-premium-muted hover:text-white hover:bg-white/[0.1] hover:border-premium-accent/40 border border-white/[0.05] transition-all relative z-20"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/[0.03] text-premium-muted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 border border-white/[0.05] transition-all relative z-20"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Title Area */}
          <div className="space-y-6">
            <div className="flex items-center gap-7">
              <div className="w-20 h-20 rounded-[28px] bg-white/[0.02] border border-white/[0.05] flex items-center justify-center overflow-hidden transition-all duration-700 group-hover:border-premium-accent/40 group-hover:bg-premium-accent/5 shadow-2xl relative">
                <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                {airdrop.url ? (
                  <img 
                    src={getFaviconUrl(airdrop.url) || ''} 
                    alt="" 
                    className="w-10 h-10 object-contain grayscale opacity-30 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-700 relative z-10"
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <Shield className="w-10 h-10 text-premium-muted opacity-10" />
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-premium-accent text-[9px] font-black uppercase tracking-[0.4em]">
                  <div className="w-1 h-1 bg-premium-accent rotate-45" />
                  Cluster {index + 1}
                </div>
                <h3 className="text-3xl font-display font-black text-white uppercase tracking-tighter truncate group-hover:text-premium-accent transition-all duration-300 transform group-hover:translate-x-1">
                  {airdrop.name}
                </h3>
                <div className="flex items-center gap-3 mt-1.5 opacity-30 group-hover:opacity-60 transition-opacity">
                  <Clock className="w-3 h-3 text-premium-muted" />
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-premium-muted">{getRelativeDays(airdrop.createdAt)} Deployment</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-6 pt-10 border-t border-white/[0.04] relative">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px bg-white/[0.1]" />
            <div className="space-y-2">
              <span className="text-[10px] font-black text-premium-muted uppercase tracking-[0.3em] opacity-30">Architecture</span>
              <div className="flex items-center gap-2.5 text-white/90">
                <div className="w-6 h-6 rounded-lg bg-premium-accent/10 border border-premium-accent/20 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-premium-accent" />
                </div>
                <span className="text-xs font-black tracking-tight">{tasks.length || 0} MODULES</span>
              </div>
            </div>
            <div className="space-y-2 text-right">
              <span className="text-[10px] font-black text-premium-muted uppercase tracking-[0.3em] opacity-30">Frequency</span>
              <div className="flex items-center gap-2.5 justify-end">
                <span className="text-xs font-black uppercase tracking-widest text-zinc-300">
                  {airdrop.frequency?.toUpperCase() || 'STABLE'}
                </span>
                <div className="w-6 h-6 rounded-lg bg-white/[0.03] border border-white/[0.1] flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 text-premium-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Area */}
        <div className="p-3 gap-3 flex relative z-10 border-t border-white/[0.04] bg-white/[0.01]">
          <button 
            className={cn(
              "flex-1 premium-button text-[11px] font-black tracking-[0.3em] py-5 flex items-center justify-center gap-3 transition-all duration-700 rounded-[20px]",
              airdrop.url ? "premium-button-primary shadow-[0_0_30px_rgba(59,130,246,0.15)]" : "premium-button-secondary"
            )}
            onClick={(e) => {
              if (!airdrop.url) {
                e.stopPropagation();
                onOpen?.(null);
                navigate(`/airdrop/${airdrop.id}`);
              }
            }}
          >
            {airdrop.url ? (
              <>
                INIT LINK
                <MoveRight className="w-4 h-4 transition-transform group-hover:translate-x-2" />
              </>
            ) : (
              <>
                COMMAND
                <GripVertical className="w-4 h-4 opacity-50" />
              </>
            )}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(null);
              navigate(`/airdrop/${airdrop.id}`);
            }}
            className="w-16 h-16 flex items-center justify-center rounded-[20px] bg-white/[0.03] border border-white/[0.08] hover:bg-white/[0.08] hover:border-premium-accent/40 text-premium-muted hover:text-white transition-all group/opt shadow-inner"
            title="System Settings"
          >
            <Settings2 className="w-5 h-5 group-hover/opt:rotate-90 transition-transform duration-700" />
          </button>
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
        name: name.trim(),
        url: url.trim(),
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
    } catch (error: any) {
      console.error("Submission failed. Error object:", error);
      console.error("Error code:", error.code);
      console.error("Error details:", error.details);
      alert("Failed to save protocol: " + (error.message || "Unknown error") + "\nCheck console for details.");
      handleFirestoreError(error, airdrop ? OperationType.UPDATE : OperationType.CREATE, 'airdrops');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-premium-bg/90 backdrop-blur-3xl overflow-y-auto">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="premium-glass p-12 max-w-2xl w-full relative rounded-[40px] shadow-2xl my-auto border border-white/[0.08]"
      >
        <button onClick={onClose} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/[0.03] text-premium-muted hover:text-white hover:bg-white/[0.1] transition-all text-2xl font-light">×</button>
        
        <div className="space-y-2 mb-12">
          <div className="flex items-center gap-2 text-premium-accent text-[11px] font-black uppercase tracking-[0.3em]">
            <div className="w-1.5 h-1.5 bg-premium-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Core Logic
          </div>
          <h3 className="text-4xl font-display font-black uppercase tracking-tight text-white leading-none">
            {airdrop ? 'Refine Logic' : 'Establish Link'}
          </h3>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Protocol Handle</label>
              <input 
                required
                autoFocus
                className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 focus:bg-white/[0.05] transition-all text-sm text-white placeholder:text-white/10 shadow-inner"
                placeholder="MISSION DESCRIPTOR"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Neural Uplink (URL)</label>
              <input 
                required
                className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 focus:bg-white/[0.05] transition-all text-sm text-white placeholder:text-white/10 shadow-inner"
                placeholder="HTTPS://CRYPTO-ASSET.NETWORK"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center justify-between">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Sector Assignment</label>
                {!isCreatingFolder && (
                  <button 
                    type="button"
                    onClick={() => setIsCreatingFolder(true)}
                    className="text-[10px] font-bold uppercase text-premium-accent hover:opacity-70 transition-opacity"
                  >
                    + Establish New Sector
                  </button>
                )}
             </div>
             {isCreatingFolder ? (
               <div className="flex gap-3 animate-in slide-in-from-top-4">
                 <input 
                   autoFocus
                   className="flex-1 bg-white/[0.03] border border-white/[0.1] p-5 rounded-2xl focus:outline-none text-sm text-white"
                   placeholder="DESIGNATE NEW SECTOR..."
                   value={newFolderName}
                   onChange={(e) => setNewFolderName(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleQuickFolder())}
                 />
                 <button 
                   type="button"
                   onClick={handleQuickFolder}
                   className="px-8 bg-premium-accent text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest shadow-lg shadow-premium-accent/20"
                 >
                   Establish
                 </button>
                 <button 
                   type="button"
                   onClick={() => setIsCreatingFolder(false)}
                   className="w-14 h-14 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.08] text-white"
                 >
                   ×
                 </button>
               </div>
             ) : (
                <div className="relative group">
                  <select 
                    className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 transition-all text-sm text-white appearance-none cursor-pointer"
                    value={selectedFolderId}
                    onChange={(e) => setSelectedFolderId(e.target.value)}
                  >
                    <option value="" className="bg-premium-bg">GLOBAL SECTOR</option>
                    {folders.map(f => (
                      <option key={f.id} value={f.id} className="bg-premium-bg">CLUSTER: {f.name.toUpperCase()}</option>
                    ))}
                  </select>
                  <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-premium-muted pointer-events-none group-hover:text-premium-accent transition-colors rotate-90" />
                </div>
             )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-5">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Transmission Cycle</label>
              <div className="flex flex-wrap gap-2">
                {['daily', '3-day', 'weekly', 'one-time'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      "flex-1 min-w-[100px] py-4 text-[10px] font-bold uppercase tracking-[0.15em] border rounded-2xl transition-all",
                      frequency === f 
                        ? "bg-premium-accent text-white border-premium-accent shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                        : "border-white/[0.08] bg-white/[0.02] text-premium-muted hover:border-white/[0.2] hover:text-white"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Protocol Phase</label>
              <div className="flex gap-2">
                {['active', 'upcoming', 'ended'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={cn(
                      "flex-1 py-4 text-[10px] font-bold uppercase tracking-[0.15em] border rounded-2xl transition-all",
                      status === s 
                        ? "bg-premium-accent text-white border-premium-accent shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                        : "border-white/[0.08] bg-white/[0.02] text-premium-muted hover:border-white/[0.2] hover:text-white"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-8">
            <button
              type="submit"
              className="w-full premium-button-primary py-6 text-sm tracking-[0.3em] rounded-[24px]"
            >
              {airdrop ? 'COMMIT LINK ENCRYPTION' : 'FINALIZE NEURAL BRIDGE'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
