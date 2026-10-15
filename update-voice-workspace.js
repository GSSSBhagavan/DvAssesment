const fs = require('fs');

const file = 'src/components/workspaces/VoiceWorkspace.tsx';

let newContent = `'use client';
import { useAssessmentState } from '@/hooks/useAssessmentState';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { Mic, Square, RefreshCw, Volume2, Edit3, Check, Loader2, Play, PlayCircle, AlertCircle, Maximize } from 'lucide-react';
import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type VoiceAnswer = {
  questionId: number;
  transcript: string;
  durationSeconds: number;
  wordCount: number;
  audioUrl?: string;
  status: 'COMPLETED';
};

export default function VoiceWorkspace({ question }: { question: any }) {
  const { setAnswer, answers, setNavigationLocked } = useAssessmentState();
  const [answerData, setAnswerData] = useState<VoiceAnswer | null>(null);

  useEffect(() => {
    if (answers[question.id]) {
      try {
        const saved = JSON.parse(answers[question.id]);
        if (saved && saved.status === 'COMPLETED') {
          setAnswerData(saved);
        }
      } catch (e) {
        setAnswerData({
          questionId: question.id,
          transcript: answers[question.id],
          durationSeconds: 0,
          wordCount: answers[question.id].split(' ').filter(Boolean).length,
          status: 'COMPLETED'
        });
      }
    }
  }, [question.id]); // eslint-disable-line

  const { 
    isListening: sttListening, 
    finalTranscript, 
    interimTranscript, 
    error: sttError,
    isSupported: sttSupported,
    startListening, 
    stopListening,
    setFinalTranscript
  } = useSpeechToText();

  const {
    isRecording,
    audioUrl,
    duration,
    audioData,
    startRecording,
    stopRecording,
    resetRecording
  } = useAudioRecorder();

  const [state, setState] = useState<'IDLE' | 'MIC_PERMISSION_REQUIRED' | 'COUNTDOWN' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'ERROR' | 'RETAKE'>(
    answerData ? 'COMPLETED' : 'IDLE'
  );

  const [countdown, setCountdown] = useState(3);
  const [micError, setMicError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const isLocked = state === 'RECORDING' || state === 'PROCESSING' || state === 'COUNTDOWN';
  
  useEffect(() => {
    setNavigationLocked(isLocked);
    return () => setNavigationLocked(false);
  }, [isLocked, setNavigationLocked]);
  
  useEffect(() => {
    if (state === 'COUNTDOWN') {
      if (countdown > 0) {
        const t = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(t);
      } else {
        handleStartRecording();
      }
    }
  }, [state, countdown]);

  const requestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setState('IDLE');
      setMicError('');
    } catch (e) {
      setState('MIC_PERMISSION_REQUIRED');
      setMicError('Microphone access denied. Please allow it in browser settings.');
    }
  };

  const initiateRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setCountdown(3);
      setState('COUNTDOWN');
    } catch (e) {
      setState('MIC_PERMISSION_REQUIRED');
      setMicError('Microphone access denied. Please allow it in browser settings.');
    }
  };

  const handleStartRecording = async () => {
    try {
      resetRecording();
      await startRecording();
      if (sttSupported) {
        setFinalTranscript('');
        await startListening();
      }
      setState('RECORDING');
    } catch (err: any) {
      setState('ERROR');
      setMicError('Failed to start recording hardware.');
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleStopRecording = async () => {
    stopRecording();
    if (sttSupported) stopListening();
    setState('PROCESSING');

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const finalWordCount = finalTranscript.split(' ').filter(Boolean).length;
        
        if (duration < 3) {
          showToast('Response too short. Please speak for at least 3 seconds.');
          setFinalTranscript('');
          setAnswerData(null);
          setState('IDLE');
          resolve();
          return;
        }

        const payload: VoiceAnswer = {
          questionId: question.id,
          transcript: finalTranscript,
          durationSeconds: duration,
          wordCount: finalWordCount,
          audioUrl: audioUrl || undefined,
          status: 'COMPLETED'
        };
        
        setAnswerData(payload);
        setAnswer(question.id, JSON.stringify(payload));
        setState('COMPLETED');
        resolve();
      }, 1500);
    });
  };

  useEffect(() => {
    const { setRecordingVoice } = useAssessmentState.getState();
    if (state === 'RECORDING') {
      setRecordingVoice(true, async () => {
        await handleStopRecording();
      });
    } else {
      setRecordingVoice(false);
    }
    return () => {
      setRecordingVoice(false);
    };
  }, [state, duration, finalTranscript, audioUrl]); 

  const handleRetake = () => {
    if (confirm('RECORD A NEW RESPONSE?\\nYour current response will be replaced.')) {
      resetRecording();
      setFinalTranscript('');
      setAnswerData(null);
      setState('IDLE');
    }
  };

  const handleSaveEdit = () => {
    setIsEditing(false);
    const newWordCount = editedTranscript.split(' ').filter(Boolean).length;
    const payload: VoiceAnswer = {
      ...answerData!,
      transcript: editedTranscript,
      wordCount: newWordCount
    };
    setAnswerData(payload);
    setFinalTranscript(editedTranscript);
    setAnswer(question.id, JSON.stringify(payload));
  };

  useEffect(() => {
    const blockKeys = (e: KeyboardEvent) => {
      if (state === 'RECORDING' || state === 'PROCESSING' || state === 'COUNTDOWN') {
        if (['ArrowRight', 'ArrowLeft'].includes(e.key)) {
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', blockKeys, { capture: true });
    return () => window.removeEventListener('keydown', blockKeys, { capture: true });
  }, [state]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return \`\${m.toString().padStart(2, '0')}:\${s.toString().padStart(2, '0')}\`;
  };

  const maxTime = question.expectedDurationSeconds || 30;

  const Waveform = () => {
    if (!isRecording) return null;
    return (
      <div className="flex items-center justify-center gap-1 h-12 w-full my-4">
        {Array.from({ length: 30 }).map((_, i) => {
          const val = audioData[i * 2] || 0; 
          const distanceToCenter = Math.abs(i - 15) / 15;
          const curve = Math.max(0.1, 1 - Math.pow(distanceToCenter, 2));
          const height = Math.max(4, (val / 255) * 48 * curve);
          
          return (
            <motion.div
              key={i}
              className="w-1 rounded-full bg-slate-900"
              animate={{ height: height }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col p-6 lg:px-8 overflow-y-auto custom-scrollbar font-sans bg-[#F8FAFC] relative">
      <AnimatePresence>
        {toastMessage && (
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.95 }} 
            animate={{ opacity: 1, y: 0, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] bg-slate-900 text-white px-5 py-2.5 rounded shadow-lg flex items-center gap-2"
          >
            <AlertCircle size={16} className="text-red-400" />
            <span className="text-[13px] font-medium tracking-wide">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {isLocked && (
        <div className="fixed top-0 left-0 w-full h-1 bg-[#DC2626] z-50">
           <motion.div className="h-full bg-white/50" animate={{ width: ["0%", "100%"] }} transition={{ duration: 1, repeat: Infinity }} />
        </div>
      )}

      <div className="max-w-[1000px] w-full mx-auto flex flex-col gap-6">
        
        {/* Question Header & Role Card - More Compact */}
        <div className="flex flex-col md:flex-row gap-6">
          <div className="flex-1 bg-white border border-slate-200 p-6 rounded-lg shadow-sm">
             <div className="flex items-center gap-3 mb-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
               <span className="text-slate-400">MISSION {String(question.id).padStart(2, '0')}</span>
               <span className="text-slate-300">|</span>
               <span className="text-[#DC2626]">SPOKEN RESPONSE</span>
               <span className="text-slate-300">|</span>
               <span className="text-slate-400">~{maxTime} SEC</span>
             </div>
             <h2 className="text-[24px] font-medium text-slate-900 leading-snug">{question.question}</h2>
             <p className="mt-2 text-[14px] text-slate-500 font-medium">Speak your answer</p>
          </div>
          
          <div className="w-full md:w-[280px] shrink-0 bg-slate-50 border border-slate-200 rounded-lg p-6 flex flex-col justify-center">
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">ROLE</div>
            <div className="text-[14px] font-semibold mb-4 text-slate-800 tracking-tight">{question.role || 'Software Engineer'}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">SCENARIO</div>
            <div className="text-[13px] text-slate-600 leading-relaxed tracking-tight">{question.scenarioDescription || 'Your manager needs a simple explanation for a non-technical stakeholder.'}</div>
          </div>
        </div>

        {/* 2-Column Voice Workspace */}
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Recorder Panel - 50% width */}
          <div className="flex-1 bg-white border border-slate-200 rounded-lg p-6 shadow-sm flex flex-col items-center justify-center text-center h-[340px] relative">
            
            <AnimatePresence mode="wait">
              {state === 'MIC_PERMISSION_REQUIRED' && (
                <motion.div key="mic-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                  <AlertCircle size={24} className="text-[#DC2626] mb-3" />
                  <h3 className="text-[15px] font-bold text-slate-900 mb-1 tracking-tight">Microphone Access Required</h3>
                  <p className="text-[13px] text-slate-500 mb-4 max-w-[200px] leading-relaxed">Please allow microphone access in browser settings.</p>
                  <button onClick={requestMic} className="bg-slate-900 text-white px-5 py-2.5 rounded font-bold text-[11px] uppercase tracking-widest hover:bg-slate-800 transition-colors">
                    Request Permission
                  </button>
                </motion.div>
              )}

              {state === 'IDLE' && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full w-full">
                  <button 
                    onClick={initiateRecording}
                    className="w-16 h-16 bg-white border border-slate-200 rounded-full flex items-center justify-center text-[#DC2626] shadow-sm hover:border-[#DC2626] hover:bg-[#FEF2F2] transition-colors focus:outline-none focus:ring-4 focus:ring-red-50"
                  >
                    <Mic size={24} strokeWidth={2} />
                  </button>
                  <div className="mt-4 text-[13px] font-bold text-slate-900 uppercase tracking-widest">Ready to Record</div>
                  <div className="text-[12px] text-slate-500 mt-1">Tap microphone to begin</div>
                </motion.div>
              )}

              {state === 'COUNTDOWN' && (
                <motion.div key="countdown" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="flex flex-col items-center justify-center h-full">
                  <div className="text-5xl font-light text-slate-900 tracking-tighter mb-3">{countdown}</div>
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Get Ready</div>
                </motion.div>
              )}

              {state === 'RECORDING' && (
                <motion.div key="recording" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full w-full">
                  <div className="text-[28px] font-medium text-slate-900 tracking-tight font-mono mb-2">{formatTime(duration)}</div>
                  <Waveform />
                  <button 
                    onClick={handleStopRecording}
                    className="w-16 h-16 bg-[#FEF2F2] border border-[#DC2626] rounded-full flex items-center justify-center text-[#DC2626] shadow-sm hover:bg-[#FEE2E2] transition-colors focus:outline-none"
                  >
                    <Square size={20} className="fill-current" />
                  </button>
                  <div className="mt-4 flex items-center gap-2">
                    <motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 bg-[#DC2626] rounded-full" />
                    <span className="text-[11px] font-bold text-[#DC2626] uppercase tracking-widest">Recording</span>
                  </div>
                </motion.div>
              )}

              {state === 'PROCESSING' && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center h-full">
                  <Loader2 size={24} className="text-[#DC2626] animate-spin mb-3" />
                  <h3 className="text-[11px] font-bold text-slate-900 uppercase tracking-widest">Processing Audio</h3>
                </motion.div>
              )}

              {state === 'COMPLETED' && answerData && (
                <motion.div key="completed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center w-full justify-center h-full">
                  <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1.5 mb-4">
                    <Check size={14} strokeWidth={2.5} /> RESPONSE SAVED
                  </div>
                  
                  <div className="flex gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Duration</div>
                      <div className="text-[15px] font-semibold text-slate-800">{formatTime(answerData.durationSeconds)}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Words</div>
                      <div className="text-[15px] font-semibold text-slate-800">{answerData.wordCount}</div>
                    </div>
                  </div>

                  {answerData.audioUrl && (
                    <div className="w-full max-w-[240px] mb-6">
                      <audio src={answerData.audioUrl} controls className="w-full h-8" style={{ filter: 'grayscale(100%)' }} />
                    </div>
                  )}

                  <button onClick={handleRetake} className="px-4 py-2 bg-slate-50 text-slate-600 border border-slate-200 text-[11px] font-bold uppercase tracking-widest hover:bg-slate-100 hover:text-slate-800 transition-colors rounded flex items-center gap-1.5">
                    <RefreshCw size={12} /> Retake
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Transcript Panel - 50% width */}
          <div className="flex-1 bg-white border border-slate-200 rounded-lg flex flex-col shadow-sm h-[340px]">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-900 uppercase tracking-widest">
                {state === 'RECORDING' ? (
                  <><motion.div animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.5, repeat: Infinity }} className="w-1.5 h-1.5 bg-[#DC2626] rounded-full"/> LIVE TRANSCRIPT</>
                ) : (
                  'TRANSCRIPT'
                )}
              </div>
              
              {state === 'COMPLETED' && !isEditing && (
                <button onClick={() => { setIsEditing(true); setEditedTranscript(answerData?.transcript || ''); }} className="text-[11px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-900 flex items-center gap-1 transition-colors">
                  <Edit3 size={12} /> Edit
                </button>
              )}
            </div>

            <div className="flex-1 p-5 overflow-y-auto custom-scrollbar relative bg-slate-50/50">
              {isEditing ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
                  <textarea 
                    value={editedTranscript}
                    onChange={e => setEditedTranscript(e.target.value)}
                    className="flex-1 w-full p-4 border border-slate-200 rounded focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 text-[14px] leading-relaxed text-slate-800 resize-none font-sans bg-white shadow-sm"
                  />
                  <div className="flex gap-2 justify-end mt-3">
                    <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-widest hover:bg-slate-100 rounded transition-colors">Cancel</button>
                    <button onClick={handleSaveEdit} className="px-4 py-2 bg-slate-900 text-white text-[11px] font-bold uppercase tracking-widest rounded hover:bg-slate-800 transition-colors">Save</button>
                  </div>
                </motion.div>
              ) : (
                <div className="text-[14px] leading-relaxed text-slate-800 whitespace-pre-wrap">
                  <AnimatePresence mode="wait">
                    {state === 'IDLE' && !answerData && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-slate-400 text-[13px]">Your spoken response will appear here...</motion.span>}
                    
                    {(state === 'RECORDING' || state === 'PROCESSING') && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full">
                        <span className="text-slate-800">{finalTranscript}</span>
                        {interimTranscript && (
                          <motion.span 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: [0.5, 0.8, 0.5] }} 
                            transition={{ duration: 1.5, repeat: Infinity }}
                            className="text-slate-500"
                          >
                            {' '}{interimTranscript}
                          </motion.span>
                        )}
                        {!finalTranscript && !interimTranscript && <span className="text-slate-400 text-[13px] italic">Listening...</span>}
                      </motion.div>
                    )}

                    {state === 'COMPLETED' && answerData && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        {answerData.transcript || <span className="text-slate-400 italic">No transcript recorded. Audio was saved.</span>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`;

fs.writeFileSync(file, newContent);
console.log('Fixed VoiceWorkspace');
