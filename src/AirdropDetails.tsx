import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  db, 
  handleFirestoreError, 
  OperationType,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  serverTimestamp,
  getDocFromServer
} from './lib/firebase';
import { useAuth } from './AuthWrapper';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Plus, 
  Folder, 
  MoreHorizontal, 
  Play, 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  Trash2, 
  Keyboard,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Terminal
} from 'lucide-react';
import { cn } from './lib/utils';

interface AirdropTask {
  id: string;
  airdropId: string;
  folderId: string;
  name: string;
  url: string;
  shortcut: string;
  status: string;
  steps: { description: string; isCompleted: boolean }[];
  order: number;
}

interface AirdropFolder {
  id: string;
  airdropId: string;
  name: string;
  color: string;
  difficulty: string;
  order: number;
  tasks: AirdropTask[];
}

export function AirdropDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [airdrop, setAirdrop] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showNewTaskModal, setShowNewTaskModal] = useState<{folderId: string} | null>(null);

  useEffect(() => {
    if (!user || !id) return;

    const airdropRef = doc(db, 'airdrops', id);
    const unsubAirdrop = onSnapshot(airdropRef, 
      (doc) => {
        if (doc.exists()) setAirdrop({ id: doc.id, ...doc.data() });
        else navigate('/');
      },
      (error) => handleFirestoreError(error, OperationType.GET, `airdrops/${id}`)
    );

    const fq = query(collection(db, 'folders'), where('airdropId', '==', id), where('ownerId', '==', user.uid));
    const unsubFolders = onSnapshot(fq, 
      (snapshot) => {
        setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'folders')
    );

    const tq = query(collection(db, 'tasks'), where('airdropId', '==', id), where('ownerId', '==', user.uid));
    const unsubTasks = onSnapshot(tq, 
      (snapshot) => {
        setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'tasks')
    );

    return () => {
      unsubAirdrop();
      unsubFolders();
      unsubTasks();
    };
  }, [user, id, navigate]);

  if (loading || !airdrop) return <div className="text-center py-24 text-premium-muted font-display font-bold uppercase tracking-widest animate-pulse">Syncing sector nodes...</div>;

  const foldersWithTasks = folders.map(f => ({
    ...f,
    tasks: tasks.filter(t => t.folderId === f.id).sort((a, b) => (a.order || 0) - (b.order || 0))
  })).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-16 pb-32">
       {/* Header */}
       <div className="border-b border-white/[0.05] pb-12 flex flex-col md:flex-row md:items-end justify-between gap-10">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white/[0.03] border border-white/[0.05] text-premium-muted hover:text-white hover:border-premium-accent/30 transition-all"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <div className="flex items-center gap-2 text-premium-accent text-[11px] font-black uppercase tracking-[0.3em]">
              <div className="w-1.5 h-1.5 bg-premium-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
              Core Cluster
            </div>
          </div>
          <h1 className="text-6xl font-display font-black uppercase tracking-tight text-white leading-none">{airdrop.name}</h1>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="premium-glass bg-white/[0.03] border-white/[0.08] px-8 py-5 flex items-center justify-center gap-3 hover:bg-white/[0.06] transition-all font-black uppercase text-[11px] tracking-[0.2em] text-white rounded-[20px]"
          >
            <Plus className="w-4 h-4 text-premium-accent" />
            Initialize Sector
          </button>
          <button 
             onClick={() => navigate(`/runner/${id}`)}
             disabled={tasks.length === 0}
             className="premium-button-primary px-10 py-5 flex items-center justify-center gap-3 transition-all font-black uppercase text-[11px] tracking-[0.2em] rounded-[20px] disabled:grayscale disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            Engage Interface
          </button>
        </div>
      </div>

      {/* Folders Grid */}
      <div className="space-y-16">
        {foldersWithTasks.length === 0 ? (
          <div className="text-center py-32 premium-glass rounded-3xl border-dashed">
             <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <Folder className="w-8 h-8 text-premium-muted" />
             </div>
             <p className="text-premium-muted italic mb-6">No localized sectors defined within this cluster.</p>
             <button onClick={() => setShowNewFolderModal(true)} className="text-premium-accent text-xs font-black uppercase tracking-widest hover:underline">Establish First Sector</button>
          </div>
        ) : (
          foldersWithTasks.map((folder) => (
            <FolderSection 
              key={folder.id} 
              folder={folder as AirdropFolder} 
              onAddTask={() => setShowNewTaskModal({ folderId: folder.id })} 
            />
          ))
        )}
      </div>

      <AnimatePresence>
        {showNewFolderModal && (
          <NewFolderModal 
            airdropId={id!} 
            onClose={() => setShowNewFolderModal(false)} 
          />
        )}
        {showNewTaskModal && (
          <NewTaskModal 
            airdropId={id!}
            folderId={showNewTaskModal.folderId}
            onClose={() => setShowNewTaskModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

const FolderSection: React.FC<{ folder: AirdropFolder, onAddTask: () => void }> = ({ folder, onAddTask }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const difficultyStyles: any = {
    easy: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
    medium: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
    hard: 'border-red-500/30 text-red-400 bg-red-500/5',
    custom: 'border-premium-accent/30 text-premium-accent bg-premium-accent/5'
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-6">
          <div className="w-14 h-14 bg-white/[0.03] border border-white/[0.05] rounded-2xl flex items-center justify-center group-hover:border-premium-accent/40 group-hover:bg-premium-accent/5 transition-all duration-500">
            <Folder className="w-6 h-6 text-premium-muted group-hover:text-premium-accent transition-colors" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h3 className="text-3xl font-display font-black uppercase tracking-tight text-white group-hover:text-premium-accent transition-all duration-300">{folder.name}</h3>
              <span className={cn("text-[9px] font-black uppercase tracking-[0.2em] px-2.5 py-1 rounded-full border", difficultyStyles[folder.difficulty])}>
                {folder.difficulty}
              </span>
            </div>
            <p className="text-[10px] font-black text-premium-muted uppercase tracking-[0.25em] mt-1.5 opacity-60 flex items-center gap-2">
              <Terminal className="w-3 h-3" />
              {folder.tasks.length} Operational Units Enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={onAddTask}
            className="hidden md:flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] text-premium-muted hover:text-premium-accent transition-all duration-300"
          >
            <Plus className="w-3.5 h-3.5" />
            Deploy Unit
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/[0.05] hover:border-white/[0.1] hover:bg-white/[0.06] transition-all"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6 overflow-hidden"
          >
            {folder.tasks.map((task, i) => (
              <TaskCard key={task.id} task={task as AirdropTask} index={i} />
            ))}
            <button 
              onClick={onAddTask}
              className="premium-glass bg-white/[0.01] border-dashed border-white/[0.1] p-10 rounded-[32px] flex flex-col items-center justify-center gap-6 text-premium-muted hover:border-premium-accent/40 hover:text-white hover:bg-premium-accent/[0.03] transition-all group min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-full border border-white/[0.1] flex items-center justify-center group-hover:bg-premium-accent group-hover:border-premium-accent transition-all duration-500">
                <Plus className="w-6 h-6 group-hover:text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.3em]">Deploy Unit</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TaskCard: React.FC<{ task: AirdropTask, index: number }> = ({ task, index }) => {
  const [complete, setComplete] = useState(task.status === 'completed');

  const toggleStatus = async () => {
    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: complete ? 'pending' : 'completed',
        updatedAt: serverTimestamp()
      });
      setComplete(!complete);
    } catch (e) {
      console.error(e);
    }
  };

  const deleteSelf = async () => {
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.6 }}
      className={cn(
        "premium-gradient-card p-8 rounded-[32px] flex flex-col justify-between min-h-[240px] group relative transition-all duration-700 hover:border-white/[0.15] shadow-2xl border border-white/[0.05]",
        complete && "opacity-30 grayscale saturate-0 scale-[0.98]"
      )}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
           <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.05] rounded-xl flex items-center justify-center group-hover:border-premium-accent/30 transition-all duration-500">
              <Terminal className="w-4 h-4 text-premium-accent" />
           </div>
           <button 
             onClick={deleteSelf} 
             className="w-8 h-8 flex items-center justify-center rounded-full text-premium-muted hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
           >
              <Trash2 className="w-4 h-4" />
           </button>
        </div>
        
        <div className="space-y-2">
          <h4 className="font-display font-black text-xl text-white uppercase tracking-tight leading-none line-clamp-2 group-hover:text-premium-accent transition-colors duration-300">{task.name}</h4>
          <p className="text-[10px] font-mono text-premium-muted tracking-tight truncate opacity-40 group-hover:opacity-100 transition-opacity">{task.url}</p>
        </div>

        {task.shortcut && (
          <div className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.05] text-premium-muted group-hover:text-white transition-colors">
            <Keyboard className="w-3.5 h-3.5 text-premium-accent" />
            {task.shortcut}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-white/[0.05] pt-6">
        <a 
          href={task.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 hover:text-premium-accent transition-all flex items-center gap-2 group/link"
        >
          Interface 
          <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/link:opacity-100 transition-all -translate-y-1" />
        </a>
        <button 
          onClick={toggleStatus}
          className={cn(
            "flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.25em] transition-all",
            complete ? "text-premium-accent" : "text-white/30 hover:text-white"
          )}
        >
          <div className={cn(
            "w-5 h-5 rounded-full border flex items-center justify-center transition-all duration-300",
            complete ? "bg-premium-accent/10 border-premium-accent shadow-[0_0_10px_rgba(59,130,246,0.3)]" : "border-white/10"
          )}>
            {complete && <CheckCircle2 className="w-3 h-3 text-premium-accent" />}
          </div>
          {complete ? "Verified" : "Standby"}
        </button>
      </div>
    </motion.div>
  );
}

function NewFolderModal({ airdropId, onClose }: { airdropId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [diff, setDiff] = useState('easy');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'folders'), {
        airdropId,
        name,
        difficulty: diff,
        ownerId: user.uid,
        order: Date.now()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'folders');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-premium-bg/90 backdrop-blur-3xl">
      <motion.div 
        initial={{ y: 40, opacity: 0, scale: 0.95 }} 
        animate={{ y: 0, opacity: 1, scale: 1 }} 
        className="premium-glass p-12 max-w-md w-full relative rounded-[40px] shadow-2xl border border-white/[0.08]"
      >
        <button onClick={onClose} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/[0.03] text-premium-muted hover:text-white hover:bg-white/[0.1] transition-all text-2xl font-light">×</button>
        
        <div className="space-y-2 mb-10">
          <div className="flex items-center gap-2 text-premium-accent text-[11px] font-black uppercase tracking-[0.3em]">
            <div className="w-1.5 h-1.5 bg-premium-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Core Logic
          </div>
          <h3 className="text-3xl font-display font-black uppercase tracking-tight text-white leading-none">Establish Segment</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Group Designation</label>
            <input required autoFocus className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 focus:bg-white/[0.05] transition-all text-sm text-white placeholder:text-white/10 shadow-inner" placeholder="E.G. ON-CHAIN NODES" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-5">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Challenge Level</label>
            <div className="grid grid-cols-2 gap-3">
              {['easy', 'medium', 'hard', 'custom'].map((s) => (
                <button 
                  key={s} 
                  type="button" 
                  onClick={() => setDiff(s)} 
                  className={cn(
                    "py-4 text-[10px] font-bold uppercase tracking-[0.15em] border rounded-2xl transition-all", 
                    diff === s 
                      ? "bg-premium-accent text-white border-premium-accent shadow-[0_0_15px_rgba(59,130,246,0.3)]" 
                      : "border-white/[0.08] bg-white/[0.02] text-premium-muted hover:border-white/[0.2] hover:text-white"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full premium-button-primary py-6 text-sm tracking-[0.3em] rounded-[24px]">ESTABLISH SEGMENT</button>
        </form>
      </motion.div>
    </div>
  );
}

function NewTaskModal({ airdropId, folderId, onClose }: { airdropId: string, folderId: string, onClose: () => void }) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [steps, setSteps] = useState([{ description: '', isCompleted: false }]);

  const addStep = () => setSteps([...steps, { description: '', isCompleted: false }]);
  const updateStep = (idx: number, val: string) => {
    const next = [...steps];
    next[idx].description = val;
    setSteps(next);
  };
  const removeStep = (idx: number) => {
    if (steps.length === 1) return;
    setSteps(steps.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      await addDoc(collection(db, 'tasks'), {
        airdropId,
        folderId,
        name,
        url,
        shortcut,
        steps,
        status: 'pending',
        ownerId: user.uid,
        order: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'tasks');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-premium-bg/90 backdrop-blur-3xl overflow-y-auto">
      <motion.div 
        initial={{ y: 40, opacity: 0, scale: 0.95 }} 
        animate={{ y: 0, opacity: 1, scale: 1 }} 
        className="premium-glass p-12 max-w-2xl w-full relative rounded-[40px] shadow-2xl border border-white/[0.08] my-auto"
      >
        <button onClick={onClose} className="absolute top-8 right-8 w-12 h-12 flex items-center justify-center rounded-full bg-white/[0.03] text-premium-muted hover:text-white hover:bg-white/[0.1] transition-all text-2xl font-light">×</button>
        
        <div className="space-y-2 mb-10">
          <div className="flex items-center gap-2 text-premium-accent text-[11px] font-black uppercase tracking-[0.3em]">
            <div className="w-1.5 h-1.5 bg-premium-accent rounded-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            Neural Command
          </div>
          <h3 className="text-3xl font-display font-black uppercase tracking-tight text-white leading-none">Log Assignment</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Assignment Handle</label>
                <input required className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 transition-all text-sm text-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="LOG DESCRIPTOR" />
             </div>
             <div className="space-y-3">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Neural Hotkey</label>
                <input className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 transition-all text-sm text-white" placeholder="CTRL+K" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
             </div>
          </div>
          
          <div className="space-y-3">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60">Neural Uplink (URL)</label>
            <input required className="w-full bg-white/[0.03] border border-white/[0.08] p-5 rounded-2xl focus:outline-none focus:border-premium-accent/50 transition-all text-sm text-white font-mono" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="HTTPS://TARGET-LAYER.XYZ" />
          </div>

          <div className="space-y-4">
             <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted opacity-60 block">Thread Architecture</label>
             <div className="space-y-3 max-h-[300px] overflow-y-auto pr-3 scrollbar-none">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4 items-center group/step">
                    <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.1] text-premium-accent flex items-center justify-center font-black text-xs flex-shrink-0 rounded-xl group-hover/step:border-premium-accent/50 transition-colors">{idx + 1}</div>
                    <input 
                      required 
                      className="flex-1 bg-transparent border-b border-white/[0.1] focus:border-premium-accent/50 py-3 focus:outline-none text-sm text-white transition-all" 
                      placeholder="Transmission Step Descriptor..."
                      value={step.description}
                      onChange={(e) => updateStep(idx, e.target.value)}
                    />
                    <button type="button" onClick={() => removeStep(idx)} className="text-premium-muted hover:text-red-400 p-2 transition-all opacity-0 group-hover/step:opacity-100">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
             </div>
             <button type="button" onClick={addStep} className="w-full py-5 border border-dashed border-white/[0.1] text-premium-muted font-bold uppercase text-[10px] tracking-[0.25em] hover:border-premium-accent/40 hover:text-white hover:bg-premium-accent/[0.02] transition-all rounded-[20px]">
                + Append Architectural Node
             </button>
          </div>

          <button type="submit" className="w-full premium-button-primary py-6 text-sm tracking-[0.3em] rounded-[24px]">AUTHORIZE ASSIGNMENT</button>
        </form>
      </motion.div>
    </div>
  );
}
