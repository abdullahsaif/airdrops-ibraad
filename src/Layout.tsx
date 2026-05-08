import React from 'react';
import { useAuth } from './AuthWrapper';
import { LogOut, Terminal, LayoutDashboard, Plus, Settings, FolderOpen, FolderPlus, Folder, ChevronDown, ChevronRight, Hash, Trash2 } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from './lib/utils';
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

export function Navigation() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [folders, setFolders] = React.useState<any[]>([]);
  const [airdrops, setAirdrops] = React.useState<any[]>([]);
  const [showFolderInput, setShowFolderInput] = React.useState(false);
  const [newFolderName, setNewFolderName] = React.useState('');
  const [dragOverFolder, setDragOverFolder] = React.useState<string | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);

  const [draggedFolderIndex, setDraggedFolderIndex] = React.useState<number | null>(null);
  const [dragOverFolderIndex, setDragOverFolderIndex] = React.useState<number | null>(null);

  const [folderToDelete, setFolderToDelete] = React.useState<any | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');

  React.useEffect(() => {
    if (!user) return;
    setIsSyncing(true);
    const q = query(
      collection(db, 'projectFolders'), 
      where('ownerId', '==', user.uid)
    );
    
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
        // Sort by order, then by createdAt
        data.sort((a, b) => {
          const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order ?? Number.MAX_SAFE_INTEGER;
          if (orderA !== orderB) return orderA - orderB;
          return (a.createdAt?.toMillis?.() || 0) - (b.createdAt?.toMillis?.() || 0);
        });
        setFolders(data);
        setIsSyncing(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'projectFolders');
        setIsSyncing(false);
      }
    );
    
    return () => unsubscribe();
  }, [user]);

  React.useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'airdrops'),
      where('ownerId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAirdrops(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => unsubscribe();
  }, [user]);

  const navigate = useNavigate();

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim() || !user || isSyncing) return;
    
    setIsSyncing(true);
    try {
      const docRef = await addDoc(collection(db, 'projectFolders'), {
        name: newFolderName.trim(),
        ownerId: user.uid,
        createdAt: serverTimestamp(),
        order: folders.length
      });
      setNewFolderName('');
      setShowFolderInput(false);
      navigate(`/folder/${docRef.id}`);
    } catch (e) {
      console.error("Failed to create sector:", e);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReorderFolders = async (sourceIdx: number, targetIdx: number) => {
    if (!user || sourceIdx === targetIdx) return;

    const newFolders = [...folders];
    const [moved] = newFolders.splice(sourceIdx, 1);
    newFolders.splice(targetIdx, 0, moved);

    setFolders(newFolders);
    setDraggedFolderIndex(null);
    setDragOverFolderIndex(null);

    try {
      const batch = writeBatch(db);
      newFolders.forEach((f, i) => {
        batch.update(doc(db, 'projectFolders', f.id), {
          order: i,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (err) {
      console.error("Failed to reorder sectors:", err);
    }
  };

  const onDropToFolder = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault();
    setDragOverFolder(null);
    const airdropId = e.dataTransfer.getData('airdropId');
    if (!airdropId) return;

    try {
      await updateDoc(doc(db, 'airdrops', airdropId), {
        folderId: folderId,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to shift project sector:', err);
    }
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <nav className="fixed top-0 left-0 h-screen w-20 md:w-72 bg-premium-card border-r border-premium-border z-50 flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-premium-border">
        <div className="bg-premium-accent p-1.5 rounded">
          <Terminal className="w-6 h-6 text-white" />
        </div>
        <span className="hidden md:block font-display font-extrabold text-xl uppercase tracking-tighter text-white">TurboDrop</span>
      </div>

      <div className="flex-1 px-3 py-8 space-y-8 overflow-y-auto custom-scrollbar">
        <div className="space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isDashboard = item.path === '/';
            return (
              <Link
                key={item.path}
                to={item.path}
                onDragOver={(e) => {
                  if (isDashboard) {
                    e.preventDefault();
                    setDragOverFolder('unclassified');
                  }
                }}
                onDragLeave={() => isDashboard && setDragOverFolder(null)}
                onDrop={(e) => isDashboard && onDropToFolder(e, null)}
                className={cn(
                  "flex items-center gap-4 p-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all group border",
                  isActive 
                    ? "bg-premium-accent border-premium-accent text-white shadow-lg shadow-premium-accent/20" 
                    : dragOverFolder === 'unclassified'
                      ? "bg-premium-accent/20 border-premium-accent border-dashed text-white animate-pulse"
                      : "border-transparent text-premium-muted hover:text-white hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5 flex-shrink-0 transition-colors", isActive ? "text-white" : "text-premium-muted group-hover:text-premium-accent")} />
                <span className="hidden md:block">
                  {isDashboard && dragOverFolder === 'unclassified' ? "Release to Resync" : item.name}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Folders Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-3">
            <h3 className="hidden md:block text-[9px] font-black uppercase tracking-[0.2em] text-premium-muted italic">Neural Sectors</h3>
            <button 
              onClick={() => setShowFolderInput(true)}
              className="text-premium-muted hover:text-premium-accent transition-colors"
              title="Establish New Sector"
            >
              <FolderPlus className="w-4 h-4" />
            </button>
          </div>

          <div className="px-3">
            {!showFolderInput ? (
               <button 
                onClick={() => setShowFolderInput(true)}
                className="w-full py-4 px-4 border border-dashed border-premium-border bg-white/[0.02] rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-premium-muted hover:border-premium-accent hover:text-premium-accent hover:bg-premium-accent/5 transition-all flex items-center justify-center gap-3 group active:scale-95 shadow-sm"
               >
                 <Plus className={cn("w-4 h-4 transition-transform duration-500", "group-hover:rotate-180")} />
                 New Sector
               </button>
            ) : (
                <form onSubmit={handleCreateFolder}>
                  <input 
                    autoFocus
                    disabled={isSyncing}
                    className={cn(
                      "w-full bg-white/5 border border-premium-accent p-3.5 rounded-2xl text-[11px] font-bold text-white focus:outline-none shadow-[0_0_20px_rgba(37,99,235,0.15)] transition-all",
                      isSyncing && "opacity-50 cursor-not-allowed"
                    )}
                    placeholder="Enter Sector Name..."
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && setShowFolderInput(false)}
                  />
                  <div className="flex justify-between px-2 mt-2">
                    <span className="text-[9px] text-premium-muted italic uppercase">Press Enter to Confirm</span>
                    <button type="button" onClick={() => setShowFolderInput(false)} className="text-[9px] text-red-400 font-bold uppercase hover:underline">Cancel</button>
                  </div>
                </form>
            )}
          </div>

          <div className="space-y-2">
            {folders.length === 0 && !isSyncing && !showFolderInput && (
              <div className="px-5 py-4 text-[9px] text-premium-muted italic uppercase tracking-widest border border-dashed border-premium-border/30 rounded-xl mx-2">
                Neural Sectors Offline
              </div>
            )}
            {folders.map((folder, i) => {
              const isActive = location.pathname === `/folder/${folder.id}`;
              const isOver = dragOverFolder === folder.id;
              const projectCount = airdrops.filter(a => a.folderId === folder.id).length;
              
              const isFolderDragged = draggedFolderIndex === i;
              const isFolderDragOver = dragOverFolderIndex === i;

              return (
                <div 
                  key={folder.id}
                  draggable
                  onDragStart={(e) => {
                    // Prevent conflict with airdrop dragging if we have both? 
                    // Sidebar usually only drags folders.
                    e.dataTransfer.setData('sourceIndexFolder', i.toString());
                    setDraggedFolderIndex(i);
                  }}
                  onDragEnd={() => {
                    setDraggedFolderIndex(null);
                    setDragOverFolderIndex(null);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverFolderIndex !== i) setDragOverFolderIndex(i);
                    // Also handle airdrop drop logic
                    setDragOverFolder(folder.id);
                  }}
                  onDragLeave={() => {
                    setDragOverFolder(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceIdxFolder = e.dataTransfer.getData('sourceIndexFolder');
                    if (sourceIdxFolder !== "") {
                      handleReorderFolders(parseInt(sourceIdxFolder), i);
                    } else {
                      // Original drop logic for airdrops
                      onDropToFolder(e, folder.id);
                    }
                    setDraggedFolderIndex(null);
                    setDragOverFolderIndex(null);
                    setDragOverFolder(null);
                  }}
                  className={cn(
                    "flex items-center gap-2 p-1 rounded-xl transition-all group/folder relative",
                    isActive ? "bg-white/10" : isOver ? "bg-premium-accent/20 border border-dashed border-premium-accent" : "hover:bg-white/5",
                    isFolderDragged && "opacity-20",
                    isFolderDragOver && !isFolderDragged && "after:content-[''] after:absolute after:top-0 after:left-0 after:right-0 after:h-0.5 after:bg-premium-accent after:animate-pulse"
                  )}
                >
                  <Link
                    to={`/folder/${folder.id}`}
                    className={cn(
                      "flex-1 flex items-center gap-4 p-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all",
                      isActive || isOver ? "text-premium-accent" : "text-premium-muted hover:text-white"
                    )}
                  >
                    <Folder className={cn("w-4 h-4 flex-shrink-0", isActive || isOver ? "text-premium-accent" : "text-premium-muted group-hover/folder:text-premium-accent")} />
                    <span className="hidden md:block truncate">
                      {isOver ? "Release to Sync" : (
                        <div className="flex items-center justify-between w-full pr-1 gap-4">
                           <span className="truncate">{folder.name}</span>
                           <span className={cn(
                             "text-[10px] font-mono font-black min-w-[1.5rem] h-[1.5rem] px-2 flex items-center justify-center rounded-lg transition-all duration-500",
                             projectCount > 0 
                               ? "bg-premium-accent text-white shadow-[0_0_20px_rgba(37,99,235,0.3)] ring-1 ring-white/20" 
                               : "bg-white/5 text-premium-muted border border-white/5 opacity-50"
                           )}>
                             {projectCount}
                           </span>
                        </div>
                      )}
                    </span>
                  </Link>
                  <button 
                    onClick={(e) => {
                      e.preventDefault();
                      setFolderToDelete(folder);
                      setDeleteConfirmText('');
                    }}
                    className="hidden md:flex opacity-0 group-hover/folder:opacity-100 p-2 text-premium-muted hover:text-red-400 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="p-6 border-t border-premium-border mt-auto space-y-6 bg-premium-card">
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

      {/* Folder Delete Confirmation Modal */}
      {folderToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-premium-card border border-premium-border p-8 max-w-sm w-full rounded-2xl shadow-2xl space-y-6">
            <div className="space-y-2">
              <h3 className="text-xl font-black uppercase tracking-tighter text-white">Critical Deletion</h3>
              <p className="text-xs text-premium-muted">
                Type <span className="text-white font-mono font-bold">"{folderToDelete.name}"</span> to confirm sector termination. This action is irreversible.
              </p>
            </div>
            
            <input 
              autoFocus
              className="w-full bg-white/5 border border-white/10 p-4 rounded-xl text-sm text-white focus:outline-none focus:border-red-500 transition-all"
              placeholder="Verification required..."
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setFolderToDelete(null)}
                className="flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-premium-muted hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={async () => {
                  if (deleteConfirmText !== folderToDelete.name) return;
                  try {
                    const batch = writeBatch(db);
                    const q = query(collection(db, 'airdrops'), where('folderId', '==', folderToDelete.id));
                    const snap = await getDocs(q);
                    snap.docs.forEach(doc => {
                      batch.update(doc.ref, { folderId: null });
                    });
                    batch.delete(doc(db, 'projectFolders', folderToDelete.id));
                    await batch.commit();
                    setFolderToDelete(null);
                    setDeleteConfirmText('');
                    navigate('/');
                  } catch (err) {
                    console.error(err);
                  }
                }}
                disabled={deleteConfirmText !== folderToDelete.name}
                className={cn(
                  "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                  deleteConfirmText === folderToDelete.name 
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20" 
                    : "bg-red-500/20 text-red-500/50 cursor-not-allowed"
                )}
              >
                Destroy
              </button>
            </div>
          </div>
        </div>
      )}
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
