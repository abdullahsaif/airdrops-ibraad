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
    <div className="h-[calc(100vh-2rem)] flex flex-col space-y-4">
      {/* HUD Header */}
      <div className="bg-[#141414] text-white p-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-yellow-400 fill-current" />
          <span className="font-black uppercase tracking-widest text-xs italic">TURBO-DRIVE / SESSION ACTIVE</span>
        </div>
        <div className="flex items-center gap-6">
           <div className="hidden md:flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest opacity-70">
              <span className="text-gray-500">Auto-Next:</span>
              <button 
                onClick={() => setAutoNext(!autoNext)}
                className={cn("px-2 py-0.5 border border-white/20 rounded transition-colors", autoNext ? "bg-green-600 border-green-500" : "bg-red-900 border-red-700")}
              >
                {autoNext ? "ENABLED" : "DISABLED"}
              </button>
           </div>
           <button onClick={() => navigate(`/airdrop/${id}`)} className="flex items-center gap-2 text-[10px] font-bold uppercase hover:text-red-400 transition-colors">
              <RotateCcw className="w-4 h-4" />
              <span className="hidden sm:inline">Abort Session</span>
           </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0 overflow-hidden">
        {/* Left: Task Queue Sidebar */}
        <div className="w-12 md:w-56 flex flex-col border border-[#141414] bg-white overflow-hidden">
           <div className="p-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <h3 className="hidden md:block text-[9px] font-black uppercase tracking-widest text-gray-500 italic">Queue</h3>
              <Keyboard className="w-3 h-3 text-gray-400" />
           </div>
           <div className="flex-1 overflow-y-auto scrollbar-none p-1 space-y-1">
             {tasks.map((t, idx) => (
               <button
                  key={t.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={cn(
                    "w-full text-left p-2 md:p-3 transition-all flex items-center gap-2 group",
                    currentIndex === idx 
                      ? "bg-[#141414] text-white" 
                      : "hover:bg-gray-100"
                  )}
               >
                  <span className="text-[10px] font-mono opacity-40 group-hover:opacity-100">{idx + 1}</span>
                  <span className="hidden md:block text-[11px] font-bold uppercase tracking-tight truncate flex-1">{t.name}</span>
                  {currentIndex === idx && <div className="w-1.5 h-1.5 bg-yellow-400 animate-pulse rounded-full" />}
               </button>
             ))}
           </div>
        </div>

        {/* Center: Terminal Iframe Area */}
        <div className="flex-1 border-2 border-[#141414] bg-white flex flex-col overflow-hidden shadow-[8px_8px_0px_0px_rgba(20,20,20,1)]">
           <div className="bg-gray-100 p-2 border-b border-[#141414] flex items-center justify-between">
              <div className="flex items-center gap-2 truncate">
                 <div className="w-2 h-2 rounded-full bg-red-400" />
                 <div className="w-2 h-2 rounded-full bg-yellow-400" />
                 <div className="w-2 h-2 rounded-full bg-green-400" />
                 <span className="ml-2 text-[10px] font-mono text-gray-500 truncate">{currentTask.url}</span>
              </div>
              <button 
                onClick={() => window.open(currentTask.url, '_blank')}
                className="bg-[#141414] text-white px-3 py-1 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest hover:bg-black transition-colors"
              >
                <ExternalLink className="w-3 h-3" />
                Pop Out
              </button>
           </div>
           <div className="flex-1 bg-[#F0F0F0] relative overflow-hidden">
              <iframe 
                src={currentTask.url} 
                className="w-full h-full border-none"
                title="Target Preview"
                referrerPolicy="no-referrer"
                sandbox="allow-forms allow-modals allow-popups allow-scripts allow-same-origin"
              />
              {/* Fallback Overlay for blocked iframes */}
              <div className="absolute bottom-4 left-4 right-4 pointer-events-none">
                 <div className="bg-black/80 text-white p-3 text-[9px] font-bold uppercase tracking-[0.2em] inline-block">
                    Note: If screen stays blank, the target site restricts framing. Use "Pop Out" or Press [ENT].
                 </div>
              </div>
           </div>
        </div>

        {/* Right: Execution Steps Sidebar */}
        <div className="w-64 md:w-80 border border-[#141414] bg-white flex flex-col overflow-hidden">
           <div className="p-4 border-b border-[#141414] bg-[#141414] text-white">
              <h4 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                 <Terminal className="w-4 h-4" /> 
                 Protocol Steps
              </h4>
           </div>
           
           <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {currentTask.steps?.map((step: any, sIdx: number) => (
                <button 
                  key={sIdx}
                  onClick={() => toggleStep(sIdx)}
                  className={cn(
                   "w-full flex items-center gap-3 p-3 border transition-all relative group text-left",
                   step.isCompleted 
                     ? "border-green-600 bg-green-50/50" 
                     : "border-gray-200 hover:border-[#141414] hover:bg-gray-50"
                  )}
                >
                   <div className={cn(
                     "w-6 h-6 flex items-center justify-center font-black text-[10px] flex-shrink-0",
                     step.isCompleted ? "bg-green-600 text-white" : "bg-gray-200 text-gray-500 group-hover:bg-[#141414] group-hover:text-white"
                   )}>
                     {sIdx + 1}
                   </div>
                   <span className={cn("text-[11px] font-bold uppercase tracking-tight flex-1", step.isCompleted && "line-through opacity-40")}>
                     {step.description}
                   </span>
                   {step.isCompleted && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                   {!step.isCompleted && (
                     <div className="text-[8px] font-mono border border-gray-400 px-1 py-0.5 opacity-0 group-hover:opacity-100">
                        {sIdx+1}
                     </div>
                   )}
                </button>
              ))}
           </div>

           <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-4">
              <button 
                 onClick={() => handleTaskComplete(currentTask.id)}
                 className="w-full bg-blue-600 text-white py-3 font-black uppercase tracking-widest text-[11px] hover:bg-blue-700 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.1)] active:translate-x-0.5 active:translate-y-0.5"
              >
                Manual Complete [SPC]
              </button>
              
              <div className="grid grid-cols-2 gap-2 text-[9px] font-bold uppercase tracking-tight text-gray-400">
                 <div className="flex items-center gap-1.5"><kbd className="px-1 border">←</kbd> Prev</div>
                 <div className="flex items-center gap-1.5"><kbd className="px-1 border">→</kbd> Next</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
