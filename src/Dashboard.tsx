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
  const isTransitioningRef = useRef(false);
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
      
      // Minimum gap between ANY automated launch (600ms)
      if (now - lastLaunchTimeRef.current < 600) return;

      // Duplicate guard (1.2s for same ID)
      if (lastLaunchIdRef.current === id && now - lastLaunchTimeRef.current < 1200) return;
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
      const currentAirdrops = airdropsRef.current;
      const airdrop = currentAirdrops.find(a => a.id === id);
      
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
          // IMPORTANT: Browsers often block automatic window.open
          // We try our best here. If it fails, nextReady UI will show.
          const newWin = window.open(airdrop.url, '_blank');
          
          if (newWin) {
            sessionWinRef.current = newWin;
            // Lock for 600ms to allow the OS/Browser to handle the new tab
            setTimeout(() => {
              setIsOpening(false);
              launchLockRef.current = false;
            }, 600);
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
  const foldersRef = useRef(folders);

  useEffect(() => {
    airdropsRef.current = airdrops;
    lastActiveIdRef.current = lastActiveId;
    isChainModeRef.current = isChainMode;
    foldersRef.current = folders;
  }, [airdrops, lastActiveId, isChainMode, folders]);

  const checkAndAdvanceChain = async () => {
    if (!isChainModeRef.current || isTransitioningRef.current) return;

    // Check if the managed window is closed
    const isClosed = !sessionWinRef.current || sessionWinRef.current.closed;

    if (isClosed) {
      if (sessionWinRef.current) {
        console.log("Bridge protocol: Sector neutralized, jumping to next coordinate.");
        sessionWinRef.current = null;
      }
      
      if (launchLockRef.current || isOpeningRef.current) return;

      const currentAirdrops = airdropsRef.current;
      
      // If we have no airdrops loaded yet, wait
      if (currentAirdrops.length === 0) return;

      const currentActiveId = lastActiveIdRef.current;
      const currentIndex = currentAirdrops.findIndex(a => a.id === currentActiveId);

      // Scenario 1: We found the current card and there's a next one in this folder
      if (currentIndex !== -1 && currentIndex < currentAirdrops.length - 1) {
        const nextAirdrop = currentAirdrops[currentIndex + 1];
        const now = Date.now();
        if (now - lastLaunchTimeRef.current > 800) {
          handleSetActive(nextAirdrop.id, true);
        }
      } 
      // Scenario 2: End of folder reached or card not found
      else {
        // We REMOVED the automatic folder jump based on user feedback.
        // It stays in the current folder.
        if (currentIndex === -1 && currentAirdrops.length > 0) {
          // If we are in folder and nothing is active, start from first
          handleSetActive(currentAirdrops[0].id, true);
        } else {
          console.log("Strategic objectives finalized for this sector.");
          setIsChainMode(false);
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(checkAndAdvanceChain, 300);
    
    // Also check on window focus for immediate feedback when a tab is closed
    const handleFocus = () => {
      checkAndAdvanceChain();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [folderId]); // Re-bind if folder changes

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
        isTransitioningRef.current = false;
        
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
    <div className="space-y-20 max-w-[1920px] mx-auto px-4 md:px-8 xl:px-12 pb-32">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-12 pt-12">
        <div className="space-y-8 flex-1">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 rounded-full bg-premium-accent/10 border border-premium-accent/30 backdrop-blur-3xl shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                <div className="flex items-center gap-3 text-premium-accent text-[11px] font-black uppercase tracking-[0.4em]">
                  <Activity className="w-4 h-4 animate-pulse" />
                  Neural Network Online
                </div>
              </div>
              <div className="h-[2px] w-24 bg-gradient-to-r from-premium-accent/40 to-transparent" />
            </div>
            <h1 className="text-7xl md:text-8xl lg:text-9xl font-display font-black uppercase tracking-tighter text-white leading-none">
              <span className="text-gradient drop-shadow-2xl">
                {currentFolder ? currentFolder.name : 'Vanguard'}
              </span>
              <span className="text-premium-accent/30 block md:inline md:ml-6 text-5xl md:text-6xl tracking-[0.2em] font-mono">_OS</span>
            </h1>
          </div>

          <div className="relative group max-w-xl">
            <input 
              id="search-input"
              type="text"
              placeholder="SEARCH DATA STREAM..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/[0.01] border border-white/[0.08] p-6 pl-14 rounded-3xl text-sm font-black uppercase tracking-[0.3em] text-white placeholder:text-premium-muted/20 focus:outline-none focus:border-premium-accent/60 focus:bg-white/[0.03] transition-all shadow-2xl backdrop-blur-3xl"
            />
            <Activity className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-premium-accent opacity-20 group-focus-within:opacity-100 transition-opacity" />
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-6">
          <button
            onClick={toggleChainMode}
            className={cn(
              "premium-button px-10 py-6 rounded-3xl text-[12px] tracking-[0.4em]",
              isChainMode 
                ? "bg-premium-accent text-white shadow-[0_0_40px_rgba(59,130,246,0.4)]" 
                : "bg-white/[0.02] text-premium-muted border border-white/[0.1] hover:border-premium-accent/60 hover:text-white backdrop-blur-3xl"
            )}
          >
            <div className="flex items-center gap-4">
              <Shield className={cn("w-5 h-5", isChainMode && "animate-pulse")} />
              {isChainMode ? 'CHAIN MODE: ACTIVE' : 'INITIALIZE CHAIN'}
            </div>
          </button>
          
          <button 
            onClick={() => setShowNewModal(true)}
            className="premium-button-primary px-12 py-6 text-[12px] tracking-[0.4em] rounded-3xl shadow-[0_0_40px_rgba(59,130,246,0.2)]"
          >
            <div className="flex items-center gap-4">
              <Plus className="w-6 h-6" />
              NEW MISSION
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-y-12 gap-x-8">
            {airdrops
              .filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((airdrop, i) => (
                <div 
                  key={airdrop.id}
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
                    "transition-all duration-700 ease-in-out relative select-none flex flex-col min-h-[560px] h-full",
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
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -8 }}
      transition={{ 
        delay: index * 0.05, 
        duration: 0.8,
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
          "premium-gradient-card rounded-[48px] group transition-all duration-700 overflow-hidden h-full flex flex-col cursor-pointer pointer-events-auto relative border",
          isActive 
            ? "premium-active-glow ring-2 ring-premium-accent/50 scale-[1.03] shadow-[0_0_100px_rgba(59,130,246,0.25)]" 
            : "border-white/[0.04] hover:border-white/[0.12] hover:bg-white/[0.01]"
        )}
      >
        {/* Futury Glass Reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-white/[0.03] pointer-events-none" />
        
        {/* Futuristic Grid Accent */}
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none overflow-hidden">
          <div className="absolute inset-0 border-[0.5px] border-white/20" style={{ backgroundImage: 'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="p-10 space-y-12 flex-1 relative z-10 flex flex-col">
          {/* Top Bar with Badge and Actions */}
          <div className="flex items-center justify-between">
            <div 
              className={cn(
                "px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.4em] border flex items-center gap-3 transition-all duration-700",
                airdrop.status === 'active' 
                  ? "border-premium-accent/40 text-white bg-premium-accent/10 shadow-[0_0_20px_rgba(59,130,246,0.1)]" 
                  : "border-white/5 text-premium-muted bg-white/5",
                isActive && "border-premium-accent bg-premium-accent/30 shadow-[0_0_30px_rgba(59,130,246,0.4)]"
              )}
            >
              <div className={cn("w-2 h-2 rounded-full", airdrop.status === 'active' || isActive ? "bg-premium-accent shadow-[0_0_8px_#3b82f6]" : "bg-white/10")} />
              {isActive ? 'TARGET LOCKED' : airdrop.status}
            </div>
            
            <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-all duration-700 translate-x-6 group-hover:translate-x-0">
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-white/[0.02] text-premium-muted hover:text-white hover:bg-white/[0.1] hover:border-premium-accent/40 border border-white/[0.05] transition-all relative z-20 shadow-inner"
              >
                <Pencil className="w-4.5 h-4.5" />
              </button>
              <button 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
                className="w-12 h-12 flex items-center justify-center rounded-[20px] bg-white/[0.02] text-premium-muted hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 border border-white/[0.05] transition-all relative z-20 shadow-inner"
              >
                <Trash2 className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>
 
          {/* Title Area */}
          <div className="space-y-8 flex-1">
            <div className="flex flex-col gap-8">
              <div className={cn(
                "w-24 h-24 rounded-[36px] bg-gradient-to-br from-white/[0.03] to-transparent border border-white/[0.08] flex items-center justify-center overflow-hidden transition-all duration-1000 group-hover:border-premium-accent/50 group-hover:scale-105 group-hover:rotate-3 shadow-2xl relative",
                isActive && "border-premium-accent/60 bg-premium-accent/5 scale-105"
              )}>
                <div className="absolute inset-0 bg-premium-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                {airdrop.url ? (
                  <img 
                    src={getFaviconUrl(airdrop.url) || ''} 
                    alt="" 
                    className={cn(
                      "w-12 h-12 object-contain grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-1000 relative z-10",
                      isActive && "grayscale-0 opacity-100 scale-110"
                    )}
                    onError={(e) => (e.currentTarget.style.display = 'none')}
                  />
                ) : (
                  <Shield className={cn("w-12 h-12 text-premium-muted opacity-10", isActive && "text-premium-accent opacity-40")} />
                )}
              </div>
              <div className="min-w-0 space-y-3">
                <div className={cn(
                  "flex items-center gap-3 text-premium-accent text-[10px] font-black uppercase tracking-[0.5em] opacity-80",
                  isActive && "opacity-100"
                )}>
                  <div className={cn("w-2 h-[2px] bg-premium-accent", isActive && "w-6")} />
                  Cluster {index + 1}
                </div>
                <h3 className={cn(
                  "text-4xl font-display font-black text-white uppercase tracking-tighter group-hover:text-premium-accent transition-all duration-500 leading-none",
                  isActive && "text-premium-accent drop-shadow-[0_0_30px_rgba(59,130,246,0.8)] scale-[1.1] translate-x-3"
                )}>
                  {airdrop.name}
                </h3>
                <div className="flex items-center gap-4 opacity-40 group-hover:opacity-80 transition-all duration-700">
                  <div className="w-px h-4 bg-white/20" />
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-premium-muted">{getRelativeDays(airdrop.createdAt)} Operational</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-8 pt-12 border-t border-white/[0.05] relative">
            <div className="absolute top-0 left-0 w-12 h-[2px] bg-premium-accent/30" />
            <div className="space-y-3">
              <span className="text-[11px] font-black text-premium-muted uppercase tracking-[0.4em] opacity-40">Loadout</span>
              <div className="flex items-center gap-3 text-white">
                <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.1] flex items-center justify-center group-hover:border-premium-accent/30 transition-colors">
                  <Shield className="w-4 h-4 text-premium-accent" />
                </div>
                <span className="text-sm font-black tracking-tight">{tasks.length || 0} SECTORS</span>
              </div>
            </div>
            <div className="space-y-3 text-right">
              <span className="text-[11px] font-black text-premium-muted uppercase tracking-[0.4em] opacity-40">Uplink</span>
              <div className="flex items-center gap-3 justify-end">
                <span className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">
                  {airdrop.frequency?.toUpperCase() || 'STABLE'}
                </span>
                <div className="w-8 h-8 rounded-xl bg-white/[0.03] border border-white/[0.1] flex items-center justify-center group-hover:border-premium-accent/30 transition-colors">
                  <Calendar className="w-4 h-4 text-premium-muted" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Action Area */}
        <div className="p-4 gap-4 flex relative z-10 border-t border-white/[0.05] bg-white/[0.01]">
          <button 
            className={cn(
              "flex-1 premium-button text-[12px] font-black tracking-[0.4em] py-6 flex items-center justify-center gap-4 transition-all duration-1000 rounded-[28px] overflow-hidden group/btn relative",
              airdrop.url ? "premium-button-primary" : "premium-button-secondary"
            )}
            onClick={(e) => {
              if (!airdrop.url) {
                e.stopPropagation();
                onOpen?.(null);
                navigate(`/airdrop/${airdrop.id}`);
              }
            }}
          >
            {/* Gloss Shine Effect */}
            <div className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/[0.1] to-transparent -skew-x-[20deg] -translate-x-full group-hover/btn:animate-[shimmer_1.5s_infinite]" />
            
            {airdrop.url ? (
              <>
                INITIALIZE
                <MoveRight className="w-5 h-5 transition-transform group-hover/btn:translate-x-3" />
              </>
            ) : (
              <>
                INTERFACE
                <GripVertical className="w-5 h-5 opacity-40" />
              </>
            )}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.(null);
              navigate(`/airdrop/${airdrop.id}`);
            }}
            className="w-20 h-20 flex items-center justify-center rounded-[28px] bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.08] hover:border-premium-accent/60 text-premium-muted hover:text-white transition-all group/opt shadow-2xl relative overflow-hidden"
            title="System Override"
          >
            <div className="absolute inset-0 bg-premium-accent/5 opacity-0 group-hover/opt:opacity-100 transition-opacity" />
            <Settings2 className="w-6 h-6 group-hover/opt:rotate-180 transition-transform duration-1000 relative z-10" />
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
