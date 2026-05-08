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
    <div className="space-y-12 pb-32">
       {/* Header */}
       <div className="border-b border-premium-border pb-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/')} 
              className="text-premium-muted hover:text-white transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-premium-accent italic">Operations Cluster</h2>
          </div>
          <h1 className="text-5xl font-display font-extrabold uppercase tracking-tighter text-white">{airdrop.name}</h1>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="premium-glass bg-white/5 border-white/10 px-6 py-4 flex items-center justify-center gap-3 hover:bg-white/10 transition-all font-black uppercase text-[10px] tracking-widest text-white rounded-xl"
          >
            <Plus className="w-4 h-4" />
            Add Group
          </button>
          <button 
             onClick={() => navigate(`/runner/${id}`)}
             disabled={tasks.length === 0}
             className="bg-premium-accent text-white px-8 py-4 flex items-center justify-center gap-3 hover:bg-blue-500 transition-all font-black uppercase text-[10px] tracking-[0.2em] rounded-xl shadow-lg shadow-premium-accent/20 disabled:grayscale disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-current" />
            Launch Session
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
    easy: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/10',
    medium: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
    hard: 'border-red-500/20 text-red-400 bg-red-500/10',
    custom: 'border-premium-accent/20 text-premium-accent bg-premium-accent/10'
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-6">
          <div className="p-3 bg-white/5 rounded-xl group-hover:bg-premium-accent/10 transition-colors">
            <Folder className="w-6 h-6 text-white" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-display font-extrabold uppercase tracking-tight text-white group-hover:text-premium-accent transition-colors">{folder.name}</h3>
              <span className={cn("text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border", difficultyStyles[folder.difficulty])}>
                {folder.difficulty}
              </span>
            </div>
            <p className="text-[10px] font-bold text-premium-muted uppercase tracking-widest mt-1 italic">{folder.tasks.length} Operational Units</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={onAddTask}
            className="hidden md:flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-premium-muted hover:text-white transition-colors"
          >
            <Plus className="w-3 h-3" />
            New Unit
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            {isExpanded ? <ChevronUp className="w-4 h-4 text-white" /> : <ChevronDown className="w-4 h-4 text-white" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden"
          >
            {folder.tasks.map((task, i) => (
              <TaskCard key={task.id} task={task as AirdropTask} index={i} />
            ))}
            <button 
              onClick={onAddTask}
              className="premium-glass bg-white/[0.01] border-dashed border-premium-border/50 p-8 rounded-2xl flex flex-col items-center justify-center gap-4 text-premium-muted hover:border-premium-accent hover:text-white hover:bg-premium-accent/5 transition-all group min-h-[200px]"
            >
              <div className="p-3 bg-white/5 rounded-full group-hover:bg-premium-accent transition-colors">
                <Plus className="w-6 h-6 group-hover:text-white" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Add Assignment</span>
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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "premium-gradient-card border border-premium-border p-6 rounded-2xl flex flex-col justify-between min-h-[200px] group relative transition-all duration-500 hover:border-premium-accent shadow-xl",
        complete && "opacity-40 grayscale"
      )}
    >
      <div className="space-y-4">
        <div className="flex justify-between items-start">
           <div className="p-2 bg-white/5 rounded-lg">
              <Terminal className="w-4 h-4 text-premium-accent" />
           </div>
           <button 
             onClick={deleteSelf} 
             className="p-2 text-premium-muted hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
           >
              <Trash2 className="w-4 h-4" />
           </button>
        </div>
        
        <div className="space-y-1">
          <h4 className="font-display font-extrabold text-lg text-white uppercase tracking-tight leading-tight line-clamp-2">{task.name}</h4>
          <p className="text-[10px] font-mono text-premium-muted truncate">{task.url}</p>
        </div>

        {task.shortcut && (
          <div className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest bg-white/5 px-2.5 py-1 rounded border border-white/5 text-premium-muted">
            <Keyboard className="w-3 h-3 text-premium-accent" />
            {task.shortcut}
          </div>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-white/5 pt-5">
        <a 
          href={task.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-widest text-premium-accent hover:text-blue-400 transition-colors flex items-center gap-2"
        >
          Interface <ExternalLink className="w-3 h-3" />
        </a>
        <button 
          onClick={toggleStatus}
          className={cn(
            "flex items-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all",
            complete ? "text-emerald-400" : "text-premium-muted hover:text-white"
          )}
        >
          {complete ? <CheckCircle2 className="w-4 h-4 fill-emerald-400/20" /> : <Circle className="w-4 h-4" />}
          {complete ? "Verified" : "Pending"}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-xl">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-premium-card border border-premium-border p-10 max-w-md w-full relative rounded-2xl shadow-2xl">
        <button onClick={onClose} className="absolute top-6 right-6 text-2xl font-bold text-premium-muted hover:text-white transition-colors">×</button>
        <h3 className="text-3xl font-display font-extrabold uppercase tracking-tighter mb-8 text-white">Establish Group</h3>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Group Designation</label>
            <input required autoFocus className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent text-white" placeholder="e.g. SOCIALS, DAILY, ON-CHAIN" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-4">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Challenge Level</label>
            <div className="grid grid-cols-2 gap-3">
              {['easy', 'medium', 'hard', 'custom'].map((s) => (
                <button 
                  key={s} 
                  type="button" 
                  onClick={() => setDiff(s)} 
                  className={cn(
                    "py-3 text-[10px] font-black uppercase tracking-widest border rounded-lg transition-all", 
                    diff === s ? "bg-premium-accent text-white border-premium-accent shadow-lg shadow-premium-accent/20" : "border-premium-border text-premium-muted hover:border-premium-muted"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-premium-accent text-white py-5 rounded-xl font-black uppercase tracking-[0.3em] hover:bg-blue-500 shadow-xl transition-all">Establish Group</button>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#050505]/95 backdrop-blur-xl overflow-y-auto">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-premium-card border border-premium-border p-10 max-w-2xl w-full relative rounded-2xl shadow-2xl my-auto">
        <button onClick={onClose} className="absolute top-6 right-6 text-2xl font-bold text-premium-muted hover:text-white transition-colors">×</button>
        <h3 className="text-3xl font-display font-extrabold uppercase tracking-tighter mb-8 text-white">Log Operational Assignment</h3>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Assignment ID</label>
                <input required className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent text-white" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily Faucet" />
             </div>
             <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Neural Hotkey</label>
                <input className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent text-white" placeholder="e.g. CTRL+S" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
             </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic">Target Uplink (URL)</label>
            <input required className="w-full bg-white/[0.03] border border-premium-border p-4 rounded-xl focus:outline-none focus:border-premium-accent text-white font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div className="space-y-4">
             <label className="text-[10px] uppercase font-bold tracking-[0.2em] text-premium-muted italic block">Thread Execution Steps</label>
             <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 scrollbar-none">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="bg-white/5 border border-white/5 text-premium-accent w-10 h-12 flex items-center justify-center font-bold flex-shrink-0 rounded-lg">{idx + 1}</span>
                    <input 
                      required 
                      className="flex-1 bg-transparent border-b border-premium-border focus:border-premium-accent py-2 focus:outline-none text-sm text-white" 
                      placeholder="Connect Bridge, Swap Assets..."
                      value={step.description}
                      onChange={(e) => updateStep(idx, e.target.value)}
                    />
                    <button type="button" onClick={() => removeStep(idx)} className="text-premium-muted hover:text-red-400 p-2 transition-colors">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
             </div>
             <button type="button" onClick={addStep} className="w-full py-4 border border-dashed border-premium-border text-premium-muted font-bold uppercase text-[10px] tracking-widest hover:border-premium-accent hover:text-white transition-all rounded-xl">
                + Append Thread Step
             </button>
          </div>

          <button type="submit" className="w-full bg-premium-accent text-white py-5 rounded-xl font-black uppercase tracking-[0.3em] hover:bg-blue-500 shadow-xl transition-all">Authorize Assignment</button>
        </form>
      </motion.div>
    </div>
  );
}
