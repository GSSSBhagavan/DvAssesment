import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import assessmentData, { getOrderedQuestions } from '@/lib/safe-questions';
import { stopAllCameraStreams, exitFullscreenSafely } from '@/hooks/useCamera';

export type AssessmentStatus = 'NOT_STARTED' | 'SYSTEM_CHECK' | 'RULES' | 'IN_PROGRESS' | 'REVIEW' | 'SUBMITTING' | 'SUBMITTED' | 'EXPIRED';

export type IntegrityEventType =
  | 'TAB_SWITCH'
  | 'FULLSCREEN_EXIT'
  | 'WINDOW_BLUR'
  | 'FACE_LOST'
  | 'FACE_RECOVERED'
  | 'MULTIPLE_FACES'
  | 'HEAD_POSE_DEVIATION'
  | 'GAZE_DEVIATION'
  | 'FACE_PARTIALLY_OUT_OF_FRAME'
  | 'COPY_PASTE_ATTEMPT'
  | 'RESTRICTED_KEY_COMBO'
  | 'CAMERA_DISCONNECTED'
  | 'CAMERA_REVOKED'
  | 'DETECTION_UNAVAILABLE'
  | 'CONNECTION_LOST'
  | 'PAGE_LEAVE_ATTEMPT';

export interface IntegrityEvent {
  type: IntegrityEventType;
  timestamp: number;
}

export type ProctoringStateStatus = 'NORMAL' | 'WARNING' | 'REVIEW_REQUIRED';

interface AssessmentState {
  status: AssessmentStatus;
  currentIndex: number;
  currentQuestionId: number | null;
  currentSection: string | null;
  answers: Record<number, string>;
  flags: Record<number, boolean>;
  visited: Record<number, boolean>;
  integrityEvents: IntegrityEvent[];
  startTime: number | null;
  endTime: number | null;
  expandedSection: string | null;
  assessmentId: string | null;
  submittedAt: number | null;
  isNavigationLocked: boolean;
  isSubmitting: boolean;
  isRecordingVoice: boolean;
  stopAndSaveVoice: (() => Promise<void>) | null;
  showSubmitModal: boolean;
  saveStatus: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'PENDING' | 'OFFLINE';
  lastSavedAt: number | null;
  questionOrder: number[] | null;
  resumeNotification: string | null;
  
  // Real-time proctoring status
  strikeCount: number;
  proctoringStatus: ProctoringStateStatus;
  proctoringMessage: string | null;
  
  setStatus: (status: AssessmentStatus) => void;
  startAssessment: (durationMinutes: number) => Promise<void>;
  setQuestionOrder: (order: number[] | null) => void;
  setAnswer: (id: number, answer: string) => void;
  setSaveStatus: (status: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR' | 'PENDING' | 'OFFLINE') => void;
  toggleFlag: (id: number) => void;
  markVisited: (id: number) => void;
  jumpToQuestion: (index: number) => void;
  setExpandedSection: (section: string) => void;
  setProctoringMessage: (msg: string | null) => void;
  setResumeNotification: (msg: string | null) => void;
  recordIntegrityEvent: (type: IntegrityEventType, metadata?: Record<string, any>) => void;
  submitAssessment: () => void;
  executeSubmission: () => Promise<void>;
  expireAssessment: () => void;
  resetState: () => void;
  setNavigationLocked: (locked: boolean) => void;
  setRecordingVoice: (isRecording: boolean, stopFn?: () => Promise<void>) => void;
  setShowSubmitModal: (show: boolean) => void;
}

export const useAssessmentState = create<AssessmentState>()(
  persist(
    (set, get) => ({
      status: 'NOT_STARTED',
      currentIndex: 0,
      currentQuestionId: null,
      currentSection: null,
      answers: {},
      flags: {},
      visited: { 0: true },
      integrityEvents: [],
      startTime: null,
      endTime: null,
      expandedSection: null,
      assessmentId: null,
      submittedAt: null,
      isNavigationLocked: false,
      isSubmitting: false,
      isRecordingVoice: false,
      stopAndSaveVoice: null,
      showSubmitModal: false,
      saveStatus: 'IDLE',
      lastSavedAt: null,
      questionOrder: null,
      resumeNotification: null,
      
      strikeCount: 0,
      proctoringStatus: 'NORMAL',
      proctoringMessage: null,

      setStatus: (status) => set({ status }),
      setQuestionOrder: (order) => set({ questionOrder: order }),
      setProctoringMessage: (proctoringMessage) => set({ proctoringMessage }),
      setResumeNotification: (resumeNotification) => set({ resumeNotification }),

      startAssessment: async (durationMinutes) => {
        set({ isSubmitting: true });
        try {
          const res = await fetch('/api/assessment/start', { method: 'POST' });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Failed to start assessment');
          }
          const data = await res.json();

          const serverAnswers: Record<number, string> = {};
          if (Array.isArray(data.answers)) {
            for (const a of data.answers) {
              if (a && typeof a.questionId === 'number' && typeof a.value === 'string') {
                serverAnswers[a.questionId] = a.value;
              }
            }
          }

          const serverFlags: Record<number, boolean> = {};
          if (Array.isArray(data.flags)) {
            for (const fid of data.flags) {
              if (typeof fid === 'number') serverFlags[fid] = true;
            }
          }

          const serverVisited: Record<number, boolean> = { 0: true };
          if (Array.isArray(data.visited)) {
            for (const vid of data.visited) {
              if (typeof vid === 'number') serverVisited[vid] = true;
            }
          }

          const targetIndex = typeof data.currentIndex === 'number' ? data.currentIndex : 0;
          serverVisited[targetIndex] = true;

          set({
            status: 'IN_PROGRESS',
            startTime: new Date(data.startedAt).getTime(),
            endTime: new Date(data.expiresAt).getTime(),
            assessmentId: data.sessionId,
            questionOrder: data.questionOrder || null,
            currentIndex: targetIndex,
            currentQuestionId: data.currentQuestionId || null,
            currentSection: data.currentSection || null,
            answers: serverAnswers,
            flags: serverFlags,
            visited: serverVisited,
            submittedAt: null,
            isSubmitting: false,
            showSubmitModal: false,
            isRecordingVoice: false,
            strikeCount: data.strikeCount || 0,
            proctoringStatus: data.integrityStatus === 'REVIEW_REQUIRED' ? 'REVIEW_REQUIRED' : data.integrityStatus === 'WARNING' ? 'WARNING' : 'NORMAL',
            resumeNotification: data.resumed ? `Assessment resumed. Restoring your progress at Question ${targetIndex + 1}.` : null
          });
        } catch (e) {
          console.error(e);
          set({ isSubmitting: false });
        }
      },

      setAnswer: (id, answer) => set((state) => ({
        answers: { ...state.answers, [id]: answer },
        saveStatus: 'PENDING'
      })),

      setSaveStatus: (saveStatus) => set((state) => ({
        saveStatus,
        lastSavedAt: saveStatus === 'SAVED' ? Date.now() : state.lastSavedAt
      })),

      toggleFlag: (id) => {
        const state = get();
        const nextFlags = { ...state.flags, [id]: !state.flags[id] };
        set({ flags: nextFlags });

        // Sync flags checkpoint to server
        if (state.assessmentId && state.status === 'IN_PROGRESS') {
          const flagsArray = Object.entries(nextFlags)
            .filter(([_, v]) => v)
            .map(([k]) => Number(k));
          fetch('/api/assessment/sync', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ flags: flagsArray })
          }).catch(() => {});
        }
      },

      markVisited: (id) => set((state) => ({
        visited: { ...state.visited, [id]: true }
      })),

      jumpToQuestion: (index) => {
        const state = get();
        const questions = getOrderedQuestions(state.questionOrder);
        const targetQ = questions[index];
        const nextVisited = { ...state.visited, [index]: true };

        set({
          currentIndex: index,
          currentQuestionId: targetQ ? targetQ.id : null,
          currentSection: targetQ ? targetQ.category : null,
          visited: nextVisited
        });

        // Sync navigation checkpoint to server so exact position is preserved on refresh/reconnect
        if (state.assessmentId && state.status === 'IN_PROGRESS' && targetQ) {
          const visitedArray = Object.entries(nextVisited)
            .filter(([_, v]) => v)
            .map(([k]) => Number(k));
          fetch('/api/assessment/sync', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              currentIndex: index,
              currentQuestionId: targetQ.id,
              currentSection: targetQ.category,
              visited: visitedArray
            })
          }).catch(() => {});
        }
      },

      setExpandedSection: (section) => set({ expandedSection: section }),

      recordIntegrityEvent: (type, metadata) => {
        const timestamp = Date.now();
        set((state) => ({
          integrityEvents: [...state.integrityEvents, { type, timestamp }]
        }));

        const state = get();
        if (state.assessmentId && (state.status === 'IN_PROGRESS' || state.status === 'REVIEW')) {
          const randomId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
          fetch('/api/integrity/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sessionId: state.assessmentId,
              eventId: randomId,
              idempotencyKey: randomId,
              eventType: type,
              clientTimestamp: new Date(timestamp).toISOString(),
              durationMs: metadata?.durationMs,
              metadata
            })
          })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json();
                if (data && typeof data.strikeCount === 'number') {
                  set({
                    strikeCount: data.strikeCount,
                    proctoringStatus: data.status || (data.strikeCount >= 6 ? 'REVIEW_REQUIRED' : data.strikeCount >= 3 ? 'WARNING' : 'NORMAL')
                  });
                }
              }
            })
            .catch((err) => {
              console.warn('Failed to persist integrity event:', err);
            });
        }
      },

      submitAssessment: () => {
        set({ showSubmitModal: true });
      },

      executeSubmission: async () => {
        const state = get();
        if (state.isSubmitting || state.status === 'SUBMITTED' || state.status === 'EXPIRED') return;
        
        set({ isSubmitting: true, status: 'SUBMITTING', saveStatus: 'SAVING' });
        
        if (state.isRecordingVoice && state.stopAndSaveVoice) {
          await state.stopAndSaveVoice();
        }
        
        try {
          // 1. Prepare answers payload
          const answersPayload = Object.entries(state.answers).map(([id, val]) => ({
            questionId: Number(id),
            value: val
          }));
          
          // 2. Best-effort sync pre-flush with retry on concurrency contention
          try {
            let syncAttempts = 3;
            let syncSuccess = false;
            while (syncAttempts > 0 && !syncSuccess) {
              const syncRes = await fetch('/api/assessment/sync', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ answers: answersPayload })
              });
              if (syncRes.ok) {
                syncSuccess = true;
              } else if (syncRes.status === 409 && syncAttempts > 1) {
                syncAttempts--;
                await new Promise(r => setTimeout(r, 80));
              } else {
                break;
              }
            }
            if (syncSuccess) {
              set({ saveStatus: 'SAVED', lastSavedAt: Date.now() });
            }
          } catch (syncErr) {
            console.warn('Sync pre-flush warning (proceeding to direct submit):', syncErr);
          }

          // 3. Submit assessment - deliver answersPayload directly to guarantee complete evaluation
          const res = await fetch('/api/assessment/submit', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ answers: answersPayload })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Submission failed on server.');
          }
          
          // Exit fullscreen and immediately turn off camera hardware
          await exitFullscreenSafely();
          stopAllCameraStreams();

          set({ 
            status: 'SUBMITTED',
            submittedAt: Date.now(),
            isSubmitting: false,
            showSubmitModal: false,
            saveStatus: 'SAVED'
          });
        } catch (e: any) {
          console.error('Submission execution error:', e);
          set({ isSubmitting: false, status: 'IN_PROGRESS', saveStatus: 'ERROR' });
          throw e;
        }
      },

      expireAssessment: async () => {
        const state = get();
        if (state.isSubmitting || state.status === 'SUBMITTED' || state.status === 'EXPIRED') return;
        
        set({ isSubmitting: true, status: 'EXPIRED' });
        
        if (state.isRecordingVoice && state.stopAndSaveVoice) {
          await state.stopAndSaveVoice();
        }
        
        try {
          await fetch('/api/assessment/submit', { method: 'POST' });
          
          // Exit fullscreen and immediately turn off camera hardware
          await exitFullscreenSafely();
          stopAllCameraStreams();

          set({ 
            status: 'SUBMITTED',
            submittedAt: Date.now(),
            isSubmitting: false,
            showSubmitModal: false
          });
        } catch (e) {
          console.error(e);
          set({ isSubmitting: false });
        }
      },

      resetState: () => {
        stopAllCameraStreams();
        set({
          status: 'NOT_STARTED',
          currentIndex: 0,
          currentQuestionId: null,
          currentSection: null,
          answers: {},
          flags: {},
          visited: { 0: true },
          integrityEvents: [],
          startTime: null,
        endTime: null,
        expandedSection: null,
        assessmentId: null,
        submittedAt: null,
        isNavigationLocked: false,
        isSubmitting: false,
        isRecordingVoice: false,
        stopAndSaveVoice: null,
        showSubmitModal: false,
        saveStatus: 'IDLE',
        lastSavedAt: null,
        questionOrder: null,
        strikeCount: 0,
        proctoringStatus: 'NORMAL',
        proctoringMessage: null,
        resumeNotification: null
      });
    },

    setNavigationLocked: (locked) => set({ isNavigationLocked: locked }),
      setRecordingVoice: (isRecording, stopFn) => set({ isRecordingVoice: isRecording, stopAndSaveVoice: stopFn || null }),
      setShowSubmitModal: (show) => set({ showSubmitModal: show })
    }),
    {
      name: 'dv-assessment-state-v1',
      partialize: (state) => Object.fromEntries(
        Object.entries(state).filter(([key]) => !['isNavigationLocked'].includes(key))
      ),
    }
  )
);
