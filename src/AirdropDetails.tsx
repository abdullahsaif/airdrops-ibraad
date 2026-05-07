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
  ChevronUp
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

    // Fetch Airdrop Info
    const airdropRef = doc(db, 'airdrops', id);
    const unsubAirdrop = onSnapshot(airdropRef, (doc) => {
      if (doc.exists()) setAirdrop({ id: doc.id, ...doc.data() });
      else navigate('/');
    });

    // Fetch Folders
    const fq = query(collection(db, 'folders'), where('airdropId', '==', id), where('ownerId', '==', user.uid));
    const unsubFolders = onSnapshot(fq, (snapshot) => {
      setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch Tasks
    const tq = query(collection(db, 'tasks'), where('airdropId', '==', id), where('ownerId', '==', user.uid));
    const unsubTasks = onSnapshot(tq, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => {
      unsubAirdrop();
      unsubFolders();
      unsubTasks();
    };
  }, [user, id]);

  if (loading || !airdrop) return <div className="text-center py-20 font-mono italic">Syncing local nodes...</div>;

  const foldersWithTasks = folders.map(f => ({
    ...f,
    tasks: tasks.filter(t => t.folderId === f.id).sort((a, b) => (a.order || 0) - (b.order || 0))
  })).sort((a, b) => (a.order || 0) - (b.order || 0));

  return (
    <div className="space-y-8 pb-32">
       {/* Header */}
       <div className="border-b border-[#141414] pb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-gray-500 mb-1 italic">Operations Portal</h2>
          <h1 className="text-4xl font-black uppercase tracking-tighter">{airdrop.name}</h1>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowNewFolderModal(true)}
            className="border-2 border-[#141414] px-4 py-2 flex items-center justify-center gap-2 hover:bg-gray-100 transition-all font-bold uppercase text-[10px] tracking-widest shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
          >
            <Plus className="w-3 h-3" />
            Add Folder
          </button>
          <button 
             onClick={() => navigate(`/runner/${id}`)}
             disabled={tasks.length === 0}
             className="bg-[#141414] text-white px-6 py-2 flex items-center justify-center gap-2 hover:bg-black transition-all font-bold uppercase text-[10px] tracking-widest disabled:opacity-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)]"
          >
            <Play className="w-3 h-3" fill="currentColor" />
            Initiate Runner
          </button>
        </div>
      </div>

      {/* Folders Grid */}
      <div className="grid grid-cols-1 gap-12">
        {foldersWithTasks.length === 0 ? (
          <div className="text-center py-20 bg-white border border-dashed border-gray-300 rounded">
             <p className="text-gray-400 italic mb-4">No sectors defined. Initialize a folder to begin task assignment.</p>
             <button onClick={() => setShowNewFolderModal(true)} className="text-xs font-bold uppercase text-blue-600 hover:underline">Create First Folder</button>
          </div>
        ) : (
          foldersWithTasks.map((folder, idx) => (
            <FolderSection 
              key={folder.id} 
              folder={folder as AirdropFolder} 
              onAddTask={() => setShowNewTaskModal({ folderId: folder.id })} 
            />
          ))
        )}
      </div>

      {/* Modals */}
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

function FolderSection({ folder, onAddTask }: { folder: AirdropFolder, onAddTask: () => void }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const difficultyColors: any = {
    easy: 'text-green-600',
    medium: 'text-yellow-600',
    hard: 'text-red-600',
    custom: 'text-blue-600'
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#141414] pb-2">
        <div className="flex items-center gap-3">
          <Folder className={cn("w-5 h-5", folder.color ? `text-[${folder.color}]` : 'text-gray-400')} />
          <h3 className="text-xl font-black uppercase tracking-tight">{folder.name}</h3>
          <span className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 border border-current", difficultyColors[folder.difficulty])}>
            {folder.difficulty}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={onAddTask}
            className="text-[10px] font-black uppercase tracking-widest text-[#141414] hover:underline"
          >
            + Add Task
          </button>
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {folder.tasks.map((task) => (
            <TaskCard key={task.id} task={task as AirdropTask} />
          ))}
          <button 
            onClick={onAddTask}
            className="border-2 border-dashed border-gray-300 p-6 flex flex-col items-center justify-center gap-2 text-gray-400 hover:text-[#141414] hover:border-[#141414] transition-all group"
          >
            <Plus className="w-6 h-6" />
            <span className="text-[10px] font-bold uppercase tracking-widest">New Task</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCard({ task }: { task: AirdropTask }) {
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
    if (!confirm("Are you sure?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', task.id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div 
      layout
      className={cn(
        "bg-white border-2 border-[#141414] p-4 flex flex-col justify-between min-h-[160px] group relative shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]",
        complete && "opacity-50 grayscale"
      )}
    >
      <div>
        <div className="flex justify-between mb-2">
           <span className="text-[10px] font-mono text-gray-400">ID: {task.id.slice(0,6)}</span>
           <div className="flex gap-2">
             <button onClick={deleteSelf} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all">
                <Trash2 className="w-3 h-3" />
             </button>
           </div>
        </div>
        <h4 className="font-bold text-lg leading-tight uppercase tracking-tight mb-2 line-clamp-2">{task.name}</h4>
        {task.shortcut && (
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase bg-gray-100 px-2 py-0.5 w-fit rounded border border-gray-200">
            <Keyboard className="w-2.5 h-2.5" />
            Shortcut: {task.shortcut}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
        <a 
          href={task.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest"
        >
          Open Site <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <button 
          onClick={toggleStatus}
          className={cn(
            "flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors",
            complete ? "text-green-600" : "text-gray-400 hover:text-[#141414]"
          )}
        >
          {complete ? <CheckCircle2 className="w-4 h-4 fill-current text-white bg-green-600 rounded-full" /> : <Circle className="w-4 h-4 outline-none" />}
          {complete ? "Done" : "Pending"}
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white border-2 border-[#141414] p-8 max-w-md w-full relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl font-bold">×</button>
        <h3 className="text-2xl font-black uppercase mb-6 italic">New Sector</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest italic">Sector Name</label>
            <input required autoFocus className="w-full border-b-2 border-[#141414] py-2 focus:outline-none" placeholder="e.g. SOCIALS, DAILY, ON-CHAIN" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest italic">Difficulty Tier</label>
            <div className="grid grid-cols-4 gap-2">
              {['easy', 'medium', 'hard', 'custom'].map((s) => (
                <button key={s} type="button" onClick={() => setDiff(s)} className={cn("py-2 text-[8px] font-bold uppercase tracking-tighter border", diff === s ? "bg-[#141414] text-white" : "border-gray-200")}>{s}</button>
              ))}
            </div>
          </div>
          <button type="submit" className="w-full bg-[#141414] text-white py-4 font-black uppercase tracking-widest hover:bg-black transition-all">ESTABLISH SECTOR</button>
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-white border-2 border-[#141414] p-8 max-w-lg w-full relative shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] my-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-2xl font-bold hover:rotate-90 transition-transform">×</button>
        <h3 className="text-2xl font-black uppercase mb-6 italic underline">Log New Assignment</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest italic">Assignment Name</label>
                <input required className="w-full border-b-2 border-[#141414] py-2 focus:outline-none" value={name} onChange={(e) => setName(e.target.value)} />
             </div>
             <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold tracking-widest italic">Quick Shortcut</label>
                <input className="w-full border-b-2 border-[#141414] py-2 focus:outline-none" placeholder="e.g. CTRL+S" value={shortcut} onChange={(e) => setShortcut(e.target.value)} />
             </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] uppercase font-bold tracking-widest italic">Target URL</label>
            <input required className="w-full border-b-2 border-[#141414] py-2 focus:outline-none font-mono text-xs" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="space-y-3">
             <label className="text-[10px] uppercase font-bold tracking-widest italic block">Operational Steps</label>
             <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex gap-2">
                    <span className="bg-[#141414] text-white w-8 h-10 flex items-center justify-center font-bold flex-shrink-0">{idx + 1}</span>
                    <input 
                      required 
                      className="flex-1 border-b border-gray-300 focus:border-[#141414] py-2 focus:outline-none text-sm" 
                      placeholder="e.g. Connect Wallet, Retweet Post..."
                      value={step.description}
                      onChange={(e) => updateStep(idx, e.target.value)}
                    />
                    <button type="button" onClick={() => removeStep(idx)} className="text-red-500 hover:bg-red-50 p-2">
                       <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
             </div>
             <button type="button" onClick={addStep} className="w-full py-2 border-2 border-dashed border-gray-300 text-gray-400 font-bold uppercase text-[10px] hover:border-[#141414] hover:text-[#141414] transition-all">
                + Add Execution Step
             </button>
          </div>

          <button type="submit" className="w-full bg-[#141414] text-white py-4 font-black uppercase tracking-widest hover:bg-black transition-all">FILE ASSIGNMENT</button>
        </form>
      </motion.div>
    </div>
  );
}
