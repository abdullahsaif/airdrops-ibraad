import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  db, 
  handleFirestoreError, 
  OperationType,
  doc,
  updateDoc,
  serverTimestamp 
} from './lib/firebase';
import { useAuth } from './AuthWrapper';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  CheckCircle2, 
  Circle, 
  Zap, 
  Keyboard,
  Settings,
  Terminal,
  FastForward,
  Play,
  RotateCcw
} from 'lucide-react';
import { cn } from './lib/utils';

interface RunnerTask {
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

export function Runner() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [tasks, setTasks] = useState<RunnerTask[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoNext, setAutoNext] = useState(true);

  useEffect(() => {
    if (!user || !id) return;

    const tq = query(
      collection(db, 'tasks'), 
      where('airdropId', '==', id), 
      where('ownerId', '==', user.uid),
      where('status', '==', 'pending')
    );
    
    const unsubscribe = onSnapshot(tq, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as RunnerTask));
      setTasks(data.sort((a, b) => (a.order || 0) - (b.order || 0)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'tasks'));

    return () => unsubscribe();
  }, [user, id]);

  const currentTask = tasks[currentIndex];

  const handleTaskComplete = useCallback(async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      
      if (autoNext) {
        // Find next task in local state before it updates
        if (tasks.length > 1) {
           // We stay at same index because current task was removed from query results
           // But if it was the last one, we might need to go back or finish
           if (currentIndex >= tasks.length - 1) {
             setCurrentIndex(Math.max(0, tasks.length - 2));
           }
        } else {
           navigate(`/airdrop/${id}`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  }, [id, autoNext, tasks, currentIndex, navigate]);

  const toggleStep = async (stepIdx: number) => {
    if (!currentTask) return;
    const newSteps = [...currentTask.steps];
    newSteps[stepIdx].isCompleted = !newSteps[stepIdx].isCompleted;
    
    try {
      await updateDoc(doc(db, 'tasks', currentTask.id), {
        steps: newSteps,
        updatedAt: serverTimestamp()
      });
      
      // Auto complete task if all steps done
      if (newSteps.every(s => s.isCompleted)) {
        setTimeout(() => handleTaskComplete(currentTask.id), 500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!currentTask) return;

      // Command Keys for steps: 1, 2, 3...
      const num = parseInt(e.key);
      if (!isNaN(num) && num > 0 && num <= currentTask.steps.length) {
        toggleStep(num - 1);
      }

      // Next Task: Right Arrow
      if (e.key === 'ArrowRight' && currentIndex < tasks.length - 1) {
        setCurrentIndex(v => v + 1);
      }
      // Prev Task: Left Arrow
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(v => v - 1);
      }
      // Open Site: Enter
      if (e.key === 'Enter') {
        window.open(currentTask.url, '_blank');
      }
      // Mark Complete: Space
      if (e.key === ' ') {
        handleTaskComplete(currentTask.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTask, currentIndex, tasks.length, handleTaskComplete]);

  if (loading) return <div className="text-center py-20 font-mono">Calibrating Speed Sensors...</div>;
  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 text-center">
        <CheckCircle2 className="w-20 h-20 text-green-600 mb-4" />
        <h2 className="text-4xl font-black uppercase tracking-tighter italic">Sector Secured</h2>
        <p className="text-gray-500 font-serif italic">All tasks in this coordinate are finalized. Returning to command center.</p>
        <button onClick={() => navigate(`/airdrop/${id}`)} className="bg-[#141414] text-white px-8 py-4 font-bold uppercase tracking-widest hover:bg-black transition-all">Back to Details</button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4 font-sans antialiased text-premium-text">
      {/* HUD Header */}
      <div className="bg-premium-card border-b border-premium-border p-3 flex items-center justify-between flex-shrink-0 shadow-lg relative z-20">
        <div className="flex items-center gap-4">
          <div className="bg-premium-accent/10 p-1.5 rounded">
            <Zap className="w-4 h-4 text-premium-accent fill-current" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-premium-accent italic leading-none">Turbo-Drive Active</span>
            <span className="text-[9px] font-mono font-bold text-premium-muted mt-1">SESSION_STX_{id?.slice(0,8)}</span>
          </div>
        </div>
        <div className="flex items-center gap-8">
           <div className="hidden md:flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
              <span className="text-premium-muted">Auto-Engagement:</span>
              <button 
                onClick={() => setAutoNext(!autoNext)}
                className={cn(
                  "px-3 py-1 border transition-all rounded-md text-[9px]", 
                  autoNext 
                    ? "bg-emerald-500/10 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.2)]" 
                    : "bg-red-500/10 border-red-500/50 text-red-400"
                )}
              >
                {autoNext ? "ENABLED" : "DISABLED"}
              </button>
           </div>
           <button 
             onClick={() => navigate(`/airdrop/${id}`)} 
             className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-premium-muted hover:text-white transition-colors"
           >
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Abort Protocol</span>
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden relative z-10">
        {/* Left: Task Queue Sidebar */}
        <div className="w-14 md:w-64 flex flex-col premium-glass rounded-2xl overflow-hidden shadow-2xl">
           <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
              <h3 className="hidden md:block text-[9px] font-black uppercase tracking-[0.3em] text-premium-muted italic">Neural Queue</h3>
              <Keyboard className="w-3 h-3 text-premium-accent" />
           </div>
           <div className="flex-1 overflow-y-auto scrollbar-none p-2 space-y-1.5">
             {tasks.map((t, idx) => (
               <button
                  key={t.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "w-full text-left p-3 md:p-4 transition-all flex items-center gap-3 group rounded-xl relative overflow-hidden",
                    currentIndex === idx 
                      ? "bg-premium-accent text-white shadow-lg shadow-premium-accent/20" 
                      : "hover:bg-white/5 text-premium-muted"
                  )}
               >
                  <span className="text-[10px] font-mono opacity-40 group-hover:opacity-100 font-bold">{idx + 1}</span>
                  <span className="hidden md:block text-[11px] font-black uppercase tracking-tight truncate flex-1">{t.name}</span>
                  {currentIndex === idx && (
                    <div className="w-1 h-4 bg-white/40 absolute left-0 rounded-full" />
                  )}
               </button>
             ))}
           </div>
        </div>

        {/* Center: Terminal Iframe Area */}
        <div className="flex-1 premium-glass border border-premium-border rounded-2xl flex flex-col overflow-hidden shadow-[0_32px_64px_-16px_rgba(0,0,0,0.4)]">
           <div className="bg-white/5 p-3 px-4 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-3 truncate">
                 <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-red-500/50" />
                    <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                    <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                 </div>
                 <div className="h-4 w-[1px] bg-white/10 mx-2" />
                 <span className="text-[10px] font-mono text-premium-muted truncate italic">{currentTask.url}</span>
              </div>
              <button 
                onClick={() => window.open(currentTask.url, '_blank')}
                className="bg-white/5 hover:bg-white/10 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Pop Out [ENT]
              </button>
           </div>
           <div className="flex-1 bg-[#050505] relative overflow-hidden group">
              <iframe 
                src={currentTask.url} 
                className="w-full h-full border-none opacity-90 group-hover:opacity-100 transition-opacity"
                title="Target Preview"
                referrerPolicy="no-referrer"
                sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
              />
              {/* Fallback Overlay for blocked iframes */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="bg-black/90 border border-white/10 text-white p-4 text-[10px] font-black uppercase tracking-[0.3em] text-center shadow-2xl backdrop-blur-md rounded-2xl max-w-xs">
                    Target site may restrict framing. Initialize pop-out manually if required.
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Execution Steps Sidebar */}
        <div className="w-72 md:w-96 premium-glass border border-premium-border flex flex-col overflow-hidden rounded-2xl">
           <div className="p-6 bg-premium-accent/5 border-b border-white/5">
              <div className="flex items-center justify-between mb-2">
                 <h4 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-2 text-white">
                    Execution Cluster
                 </h4>
                 <Terminal className="w-4 h-4 text-premium-accent" />
              </div>
              <p className="text-[10px] font-mono text-premium-muted uppercase tracking-tighter">Current Op: {currentTask.name}</p>
           </div>
           
           <div className="flex-1 p-6 overflow-y-auto space-y-4 scrollbar-none">
              {currentTask.steps?.map((step: any, sIdx: number) => (
                <button 
                  key={sIdx}
                  onClick={() => toggleStep(sIdx)}
                  className={cn(
                   "w-full flex items-center gap-4 p-4 border transition-all relative group text-left rounded-xl",
                   step.isCompleted 
                     ? "border-emerald-500/20 bg-emerald-500/5" 
                     : "border-white/5 bg-white/[0.02] hover:border-premium-accent hover:bg-premium-accent/5"
                  )}
                >
                   <div className={cn(
                     "w-7 h-7 rounded-lg flex items-center justify-center font-black text-[11px] flex-shrink-0 transition-all",
                     step.isCompleted 
                       ? "bg-emerald-500 text-white" 
                       : "bg-white/5 text-premium-muted group-hover:bg-premium-accent group-hover:text-white"
                   )}>
                     {sIdx + 1}
                   </div>
                   <span className={cn("text-[11px] font-bold uppercase tracking-tight flex-1", step.isCompleted ? "line-through text-emerald-400 opacity-60" : "text-white")}>
                     {step.description}
                   </span>
                   {step.isCompleted && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                   {!step.isCompleted && (
                     <div className="text-[9px] font-mono border border-white/20 px-1.5 py-0.5 opacity-0 group-hover:opacity-100 bg-white/5 text-premium-muted rounded">
                        [{sIdx+1}]
                     </div>
                   )}
                </button>
              ))}
           </div>

           <div className="p-6 border-t border-white/5 bg-white/5 space-y-4">
              <button 
                 onClick={() => handleTaskComplete(currentTask.id)}
                 className="w-full bg-premium-accent text-white py-5 rounded-xl font-black uppercase tracking-[0.3em] text-[10px] hover:bg-blue-500 shadow-2xl shadow-premium-accent/20 active:scale-[0.98] transition-all"
              >
                Confirm Completion [SPC]
              </button>
              
              <div className="grid grid-cols-2 gap-4 text-[9px] font-black uppercase tracking-[0.2em] text-premium-muted">
                 <div className="flex items-center gap-2 hover:text-white transition-colors cursor-help"><kbd className="px-2 py-0.5 rounded border border-white/10 bg-white/5">←</kbd> PREV</div>
                 <div className="flex items-center gap-2 justify-end hover:text-white transition-colors cursor-help">NEXT <kbd className="px-2 py-0.5 rounded border border-white/10 bg-white/5">→</kbd></div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
