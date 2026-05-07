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
    <div className="max-w-4xl mx-auto space-y-6">
      {/* HUD Header */}
      <div className="bg-[#141414] text-white p-4 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-yellow-400 fill-current" />
          <span className="font-black uppercase tracking-widest text-sm italic">SPEEDRUN MODE / ACTIVE</span>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest opacity-70">
              <Settings className="w-3 h-3" />
              Auto-Next:
              <button 
                onClick={() => setAutoNext(!autoNext)}
                className={cn("px-2 py-0.5 border border-white/20 rounded", autoNext ? "bg-green-600 border-green-500" : "bg-red-900 border-red-700")}
              >
                {autoNext ? "ON" : "OFF"}
              </button>
           </div>
           <button onClick={() => navigate(`/airdrop/${id}`)} className="p-1 hover:text-red-400">
              <RotateCcw className="w-5 h-5" />
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Task Queue Sidebar */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin pr-2">
           <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 italic">Execution Queue ({tasks.length})</h3>
           {tasks.map((t, idx) => (
             <button
                key={t.id}
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "w-full text-left p-3 border transition-all text-sm font-bold uppercase tracking-tight",
                  currentIndex === idx 
                    ? "bg-[#141414] text-white border-[#141414] translate-x-2" 
                    : "bg-white border-gray-200 hover:border-[#141414]"
                )}
             >
                <div className="flex justify-between items-start gap-2">
                   <span className="line-clamp-1">{t.name}</span>
                   {currentIndex === idx && <Play className="w-3 h-3 fill-current flex-shrink-0" />}
                </div>
                <div className="text-[8px] opacity-50 mt-1 font-mono">OP-{idx+1}</div>
             </button>
           ))}
        </div>

        {/* Execution Pane */}
        <div className="md:col-span-2 space-y-6">
           <AnimatePresence mode="wait">
             <motion.div 
               key={currentTask.id}
               initial={{ x: 20, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               exit={{ x: -20, opacity: 0 }}
               className="bg-white border border-[#141414] p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] flex flex-col min-h-[400px]"
             >
                <div className="mb-6 flex justify-between items-start">
                   <div>
                      <h4 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2">{currentTask.name}</h4>
                      <p className="text-[10px] text-blue-600 font-bold uppercase tracking-widest truncate max-w-sm">{currentTask.url}</p>
                   </div>
                   <div className="bg-gray-100 p-2 border border-gray-200">
                      <Terminal className="w-5 h-5" />
                   </div>
                </div>

                <div className="space-y-4 flex-1">
                   {currentTask.steps?.map((step: any, sIdx: number) => (
                     <button 
                       key={sIdx}
                       onClick={() => toggleStep(sIdx)}
                       className={cn(
                        "w-full flex items-center gap-4 p-4 border-2 transition-all transition-transform active:scale-95 group",
                        step.isCompleted 
                          ? "border-green-600 bg-green-50/50" 
                          : "border-gray-100 hover:border-[#141414]"
                       )}
                     >
                        <div className={cn(
                          "w-8 h-8 flex items-center justify-center font-black text-sm",
                          step.isCompleted ? "bg-green-600 text-white" : "bg-[#141414] text-white"
                        )}>
                          {sIdx + 1}
                        </div>
                        <span className={cn("flex-1 text-left font-bold uppercase tracking-tight", step.isCompleted && "line-through opacity-50")}>
                          {step.description}
                        </span>
                        {!step.isCompleted && (
                          <div className="text-[9px] font-mono border border-gray-400 px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                             Press [{sIdx+1}]
                          </div>
                        )}
                        {step.isCompleted && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                     </button>
                   ))}
                </div>

                <div className="mt-8 grid grid-cols-2 gap-4">
                   <button 
                      onClick={() => window.open(currentTask.url, '_blank')}
                      className="bg-[#141414] text-white py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest hover:bg-black"
                   >
                     <ExternalLink className="w-5 h-5" />
                     Open Terminal [ENT]
                   </button>
                   <button 
                      onClick={() => handleTaskComplete(currentTask.id)}
                      className="border-2 border-[#141414] py-4 font-black uppercase tracking-widest hover:bg-gray-100"
                   >
                     Force Complete [SPC]
                   </button>
                </div>
             </motion.div>
           </AnimatePresence>

           {/* Controls Help */}
           <div className="bg-gray-50 border border-gray-200 p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-bold">1-9</kbd>
                 <span className="text-[10px] uppercase font-bold text-gray-500">Steps</span>
              </div>
              <div className="flex items-center gap-2">
                 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-bold">ENT</kbd>
                 <span className="text-[10px] uppercase font-bold text-gray-500">Open URL</span>
              </div>
              <div className="flex items-center gap-2">
                 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-bold">← →</kbd>
                 <span className="text-[10px] uppercase font-bold text-gray-500">Navigate</span>
              </div>
              <div className="flex items-center gap-2">
                 <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-[10px] font-bold">SPC</kbd>
                 <span className="text-[10px] uppercase font-bold text-gray-500">Finish</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
