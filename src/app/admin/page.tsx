'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShieldCheck, UserPlus, LogOut, CheckCircle2, AlertCircle, Loader2, 
  Users, FileText, AlertTriangle, Eye, X, BarChart3, Clock,
  Search, FileCheck2, XCircle, MinusCircle, Copy, Printer, Check, Filter, HelpCircle
} from 'lucide-react';
import PasswordStrengthIndicator from '@/components/auth/PasswordStrengthIndicator';
import { validatePassword } from '@/lib/validation/password';

interface SectionBreakdownItem {
  sectionId: string;
  sectionName: string;
  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  unansweredQuestions: number;
  score: number;
  maximumScore: number;
}

interface ResultItem {
  _id: string;
  sessionId?: string;
  candidateId?: {
    _id: string;
    fullName: string;
    email: string;
  };
  candidateEmail?: string;
  candidateName?: string;
  status: string;
  scoreSummary?: {
    total: number;
    mcq: number;
    git: number;
    percentage?: number;
    correctAnswers?: number;
    wrongAnswers?: number;
    unansweredQuestions?: number;
    totalScore?: number;
    maximumScore?: number;
  };
  totalQuestions?: number;
  answeredQuestions?: number;
  correctAnswers?: number;
  wrongAnswers?: number;
  unansweredQuestions?: number;
  totalScore?: number;
  maximumScore?: number;
  percentage?: number;
  sectionBreakdown?: SectionBreakdownItem[];
  startedAt: string;
  submittedAt?: string;
  timeTakenSeconds?: number | null;
  shortlistStatus?: 'SHORTLISTED' | 'NOT_SHORTLISTED' | 'PENDING';
  integrityStatus?: 'CLEAN' | 'WARNING' | 'REVIEW_REQUIRED';
  strikeCount?: number;
  proctoringSummary?: {
    faceMissingStrikes: number;
    multipleFaceEvents: number;
    tabSwitches: number;
    fullscreenExits: number;
    technicalFailures: number;
  };
}

interface CandidateItem {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [results, setResults] = useState<ResultItem[]>([]);
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<{ email: string; fullName: string } | null>(null);

  // Proctoring modal state
  const [selectedSessionEvents, setSelectedSessionEvents] = useState<any[] | null>(null);
  const [selectedSessionRecord, setSelectedSessionRecord] = useState<any | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [reviewActionLoading, setReviewActionLoading] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedCandidateName, setSelectedCandidateName] = useState<string>('');
  const [selectedBreakdown, setSelectedBreakdown] = useState<{ candidateName: string; candidateEmail: string; sections: SectionBreakdownItem[] } | null>(null);

  // Student Answers Comparative Audit modal state (for Faculty Inquiries)
  const [selectedAuditStudent, setSelectedAuditStudent] = useState<ResultItem | null>(null);
  const [auditData, setAuditData] = useState<any | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'WRONG' | 'CORRECT' | 'UNANSWERED'>('ALL');
  const [copiedSummary, setCopiedSummary] = useState(false);

  // Search & Filter state for Assessment Results table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SHORTLISTED' | 'NOT_SHORTLISTED'>('ALL');

  // Form state
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const router = useRouter();

  const loadData = async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) throw new Error();
      const meData = await meRes.json();
      if (meData.user.role !== 'ADMIN') throw new Error();
      setAdminUser(meData.user);

      // Fetch results
      const resultsRes = await fetch('/api/admin/results');
      if (resultsRes.ok) {
        const resultsData = await resultsRes.json();
        setResults(resultsData.results || []);
      }

      // Fetch candidates
      const candRes = await fetch('/api/admin/candidates');
      if (candRes.ok) {
        const candData = await candRes.json();
        setCandidates(candData.candidates || []);
      }
    } catch {
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [router]);

  const handleProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setFormSuccess(null);
    setFormError(null);

    try {
      const res = await fetch('/api/admin/candidates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, email, password })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFormSuccess(`Candidate account created for ${data.candidate.email}.`);
        setFullName('');
        setEmail('');
        setPassword('');
        // Refresh candidate list
        loadData();
      } else {
        setFormError(data.error || 'Failed to provision candidate');
      }
    } catch {
      setFormError('Network error while creating candidate');
    } finally {
      setFormLoading(false);
    }
  };

  const fetchProctoringEvents = async (sessionId: string, candidateName: string) => {
    setSelectedCandidateName(candidateName);
    setSelectedSessionId(sessionId);
    setLoadingEvents(true);
    setSelectedSessionEvents([]);
    setSelectedSessionRecord(null);
    setAdminNote('');
    try {
      const res = await fetch(`/api/admin/proctoring-events?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedSessionEvents(data.events || []);
        setSelectedSessionRecord(data.record || null);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const handleUpdateReviewStatus = async (newStatus: string) => {
    if (!selectedSessionId) return;
    setReviewActionLoading(true);
    try {
      const res = await fetch('/api/admin/proctoring-events', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: selectedSessionId,
          status: newStatus,
          adminNote: adminNote.trim() || undefined
        })
      });
      if (res.ok) {
        if (selectedSessionRecord) {
          setSelectedSessionRecord({ ...selectedSessionRecord, status: newStatus });
        }
        await loadData();
      }
    } catch (e) {
      console.error('Error updating review status:', e);
    } finally {
      setReviewActionLoading(false);
    }
  };

  const openAnswersAudit = async (result: ResultItem) => {
    setSelectedAuditStudent(result);
    setLoadingAudit(true);
    setAuditData(null);
    setAuditFilter('ALL');
    setCopiedSummary(false);

    try {
      const targetId = result.sessionId || result._id;
      const res = await fetch(`/api/admin/student-answers/${targetId}`);
      if (res.ok) {
        const data = await res.json();
        setAuditData(data.studentAnswer);
      }
    } catch (err) {
      console.error('Failed to fetch student answer audit:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const copyFacultySummary = () => {
    if (!auditData) return;
    const text = `DATA VALLEY ASSESSMENT — CANDIDATE PERFORMANCE & FACULTY AUDIT
======================================================================
Student Name: ${auditData.studentName}
Email: ${auditData.studentEmail}
Status: ${auditData.shortlistStatus === 'SHORTLISTED' ? 'QUALIFIED / SHORTLISTED' : 'NOT SHORTLISTED (FAILED)'}
Marks Obtained: ${auditData.marksObtained}/60 (${auditData.percentage}%)
Qualification Cutoff: 35/60 (58.3%)

----------------------------------------------------------------------
${auditData.whyFailedReason || ''}
----------------------------------------------------------------------

Question Breakdown:
• Correct: ${auditData.correctAnswers || 0}
• Incorrect: ${auditData.wrongAnswers || 0}
• Unanswered: ${auditData.unansweredQuestions || 0}

Verified & Exported from Data Valley Platform for Institutional Faculty Review.
======================================================================`;
    navigator.clipboard.writeText(text);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2500);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  // Filter assessment results in real-time
  const filteredResults = results.filter((r) => {
    const name = (r.candidateName || r.candidateId?.fullName || '').toLowerCase();
    const candEmail = (r.candidateEmail || r.candidateId?.email || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = !q || name.includes(q) || candEmail.includes(q);
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'SHORTLISTED' && r.shortlistStatus === 'SHORTLISTED') ||
      (statusFilter === 'NOT_SHORTLISTED' && r.shortlistStatus === 'NOT_SHORTLISTED');
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600 font-medium">
          <Loader2 className="animate-spin" size={20} />
          Loading Admin Dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="bg-slate-900 text-white px-8 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-0.5 shadow-sm">
            <img src="/logo.png" alt="DataValley Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight">DataValley Admin Portal</h1>
            <p className="text-xs text-slate-400">Candidate Provisioning & Assessment Management</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="text-xs text-slate-300 font-mono">
            {adminUser?.email}
          </span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Candidate Provisioning Section */}
        <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
            <UserPlus size={20} className="text-slate-700" />
            <h2 className="text-lg font-bold text-slate-800">Provision New Candidate</h2>
          </div>

          <p className="text-sm text-slate-500 mb-6">
            Register an authorized candidate for the DataValley Assessment. The candidate will use these credentials to sign in at the login portal.
          </p>

          {formSuccess && (
            <div className="mb-6 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 size={16} />
              {formSuccess}
            </div>
          )}

          {formError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              {formError}
            </div>
          )}

          <form onSubmit={handleProvision} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="cand-name">
                Full Name
              </label>
              <input
                id="cand-name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Candidate Full Name"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                disabled={formLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="cand-email">
                Email Address
              </label>
              <input
                id="cand-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="candidate@example.com"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                disabled={formLoading}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="cand-password">
                Initial Access Code / Password
              </label>
              <input
                id="cand-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Must satisfy complexity rules"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white"
                disabled={formLoading}
              />
              <div className="mt-2">
                <PasswordStrengthIndicator
                  validation={validatePassword(password)}
                  showChecklist={true}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={formLoading || !fullName.trim() || !email.trim() || !validatePassword(password).isValid}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 h-10"
            >
              {formLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Candidate'
              )}
            </button>
          </form>
        </section>

        {/* Candidate List & Assessment Results */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Candidates Column */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-1">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
              <Users size={18} className="text-slate-700" />
              <h2 className="text-base font-bold text-slate-800">
                Registered Candidates ({candidates.length})
              </h2>
            </div>

            {candidates.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No candidates provisioned yet.</p>
            ) : (
              <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                {candidates.map((c) => (
                  <div key={c.id} className="py-3 text-sm">
                    <p className="font-semibold text-slate-800">{c.fullName}</p>
                    <p className="text-xs text-slate-500 font-mono">{c.email}</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Registered: {new Date(c.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>

              {/* Assessment Results Column */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText size={18} className="text-slate-700" />
                <h2 className="text-base font-bold text-slate-800">
                  Assessment Results ({filteredResults.length}{filteredResults.length !== results.length ? ` of ${results.length}` : ''})
                </h2>
              </div>
            </div>

            {/* Quick Candidate Search & Status Filter for Faculty Inquiries */}
            <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search student by name or college email (e.g. for faculty inquiries)..."
                  className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-900 focus:bg-white"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  All ({results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('SHORTLISTED')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'SHORTLISTED'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}
                >
                  Passed
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('NOT_SHORTLISTED')}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    statusFilter === 'NOT_SHORTLISTED'
                      ? 'bg-rose-700 text-white'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                  }`}
                >
                  Failed
                </button>
              </div>
            </div>

            {results.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No assessment submissions yet.</p>
            ) : filteredResults.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">No matching candidate found for &quot;{searchQuery}&quot;.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider">
                      <th className="p-3 text-left">Candidate</th>
                      <th className="p-3 text-left">Status</th>
                      <th className="p-3 text-left">Score</th>
                      <th className="p-3 text-left">Breakdown</th>
                      <th className="p-3 text-left">Shortlist</th>
                      <th className="p-3 text-left">Time Taken</th>
                      <th className="p-3 text-left">Integrity</th>
                      <th className="p-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredResults.map((r) => (
                      <tr key={r._id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <p className="font-semibold text-slate-800 leading-tight">
                            {r.candidateName || r.candidateId?.fullName || 'Unknown'}
                          </p>
                          <p className="text-xs font-mono text-slate-500">
                            {r.candidateEmail || r.candidateId?.email || 'Unknown'}
                          </p>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'SUBMITTED'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : r.status === 'IN_PROGRESS'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {r.status === 'SUBMITTED' ? (
                            <div>
                              <span className="font-bold text-slate-900">{r.totalScore ?? r.scoreSummary?.total ?? 0}/60</span>
                              <span className="text-[10px] text-slate-500 block">({r.percentage ?? 0}%)</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">Pending</span>
                          )}
                        </td>
                        <td className="p-3 font-mono text-xs">
                          {r.status === 'SUBMITTED' ? (
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-emerald-700 font-bold" title="Correct Answers">{r.correctAnswers ?? r.scoreSummary?.total ?? 0}C</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-rose-600 font-medium" title="Wrong Answers">{r.wrongAnswers ?? 0}W</span>
                              <span className="text-slate-300">·</span>
                              <span className="text-slate-400 font-medium" title="Unanswered Questions">{r.unansweredQuestions ?? 0}U</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-sans text-xs">In Progress</span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.shortlistStatus === 'SHORTLISTED' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300 whitespace-nowrap">
                              Shortlisted
                            </span>
                          ) : r.shortlistStatus === 'NOT_SHORTLISTED' ? (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300 whitespace-nowrap">
                              Not Shortlisted
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 whitespace-nowrap">
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-xs">
                          {r.timeTakenSeconds !== null && r.timeTakenSeconds !== undefined ? (
                            <div>
                              <span className="font-mono font-bold text-slate-800">
                                {Math.floor(r.timeTakenSeconds / 60)}m {r.timeTakenSeconds % 60}s
                              </span>
                              <span className="text-[10px] text-slate-400 block">
                                {r.submittedAt ? new Date(r.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-xs">--</span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.integrityStatus === 'REVIEW_REQUIRED' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-max">
                              <AlertTriangle size={10} /> Review ({r.strikeCount || 0})
                            </span>
                          ) : r.integrityStatus === 'WARNING' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1 w-max">
                              <AlertCircle size={10} /> Warn ({r.strikeCount || 0})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-max">
                              <CheckCircle2 size={10} /> Clean ({r.strikeCount || 0})
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5 whitespace-nowrap">
                            {/* ANSWERS AUDIT BUTTON FOR FACULTY INQUIRY */}
                            <button
                              onClick={() => openAnswersAudit(r)}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                              title="Compare Student Answers vs Actual Key for College Faculty Review"
                            >
                              <FileCheck2 size={12} /> Answers Audit
                            </button>
                            {r.sectionBreakdown && r.sectionBreakdown.length > 0 && (
                              <button
                                onClick={() => setSelectedBreakdown({
                                  candidateName: r.candidateName || r.candidateId?.fullName || 'Candidate',
                                  candidateEmail: r.candidateEmail || r.candidateId?.email || '',
                                  sections: r.sectionBreakdown || []
                                })}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1 transition-colors cursor-pointer"
                                title="View Section Breakdown"
                              >
                                <BarChart3 size={12} /> Sections
                              </button>
                            )}
                            <button
                              onClick={() => fetchProctoringEvents(r._id, r.candidateName || r.candidateId?.fullName || 'Candidate')}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Eye size={12} /> Proctor Log
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Section Breakdown Modal */}
      {selectedBreakdown !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col border border-slate-200 overflow-hidden font-sans">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Section-Wise Performance Breakdown
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedBreakdown.candidateName} · {selectedBreakdown.candidateEmail}
                </p>
              </div>
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {selectedBreakdown.sections.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No section breakdown recorded for this session.
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 uppercase tracking-wider border-b border-slate-200">
                      <th className="p-2.5 text-left font-bold">Section</th>
                      <th className="p-2.5 text-center font-bold">Total</th>
                      <th className="p-2.5 text-center font-bold text-emerald-700">Correct</th>
                      <th className="p-2.5 text-center font-bold text-rose-700">Wrong</th>
                      <th className="p-2.5 text-center font-bold text-slate-500">Unanswered</th>
                      <th className="p-2.5 text-right font-bold text-slate-900">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedBreakdown.sections.map((sec, i) => (
                      <tr key={sec.sectionId || i} className="hover:bg-slate-50/50">
                        <td className="p-2.5 font-medium text-slate-800">
                          <span className="text-slate-400 mr-1.5 font-mono">0{i + 1}</span>
                          {sec.sectionName}
                        </td>
                        <td className="p-2.5 text-center font-mono text-slate-600">{sec.totalQuestions}</td>
                        <td className="p-2.5 text-center font-mono font-bold text-emerald-600">{sec.correctAnswers}</td>
                        <td className="p-2.5 text-center font-mono font-medium text-rose-600">{sec.wrongAnswers}</td>
                        <td className="p-2.5 text-center font-mono text-slate-400">{sec.unansweredQuestions}</td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">{sec.score} / {sec.maximumScore}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedBreakdown(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Proctoring Event History Modal */}
      {selectedSessionEvents !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-900">
                    Proctoring Audit Log: {selectedCandidateName}
                  </h3>
                  {selectedSessionRecord && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      selectedSessionRecord.status === 'REVIEW_REQUIRED'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : selectedSessionRecord.status === 'WARNING'
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : selectedSessionRecord.status === 'CLEARED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {selectedSessionRecord.status} ({selectedSessionRecord.totalStrikes} Strikes)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  {selectedSessionRecord?.studentEmail || 'Auditable event telemetry'} · Collection: proctoring_events
                </p>
              </div>
              <button
                onClick={() => setSelectedSessionEvents(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Human Review Action Bar */}
            <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <input
                  type="text"
                  placeholder="Reviewer note (e.g. camera glitch verified, cleared)..."
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={reviewActionLoading}
                  onClick={() => handleUpdateReviewStatus('CLEARED')}
                  className="px-2.5 py-1 font-semibold rounded bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Clear / Forgive
                </button>
                <button
                  type="button"
                  disabled={reviewActionLoading}
                  onClick={() => handleUpdateReviewStatus('REVIEWED')}
                  className="px-2.5 py-1 font-semibold rounded bg-slate-800 hover:bg-slate-900 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Mark Reviewed
                </button>
                <button
                  type="button"
                  disabled={reviewActionLoading}
                  onClick={() => handleUpdateReviewStatus('REVIEW_REQUIRED')}
                  className="px-2.5 py-1 font-semibold rounded bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                >
                  Flag Required
                </button>
              </div>
            </div>

            {/* Events Timeline List */}
            <div className="p-6 overflow-y-auto flex-1 divide-y divide-slate-100">
              {loadingEvents ? (
                <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-slate-600" />
                  <p className="text-xs">Loading proctoring event records...</p>
                </div>
              ) : selectedSessionEvents.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-medium">
                  No integrity events recorded for this session.
                </div>
              ) : (
                selectedSessionEvents.map((ev: any, idx: number) => (
                  <div key={ev.id || idx} className="py-3.5 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {ev.category && (
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            ev.category === 'VISION'
                              ? 'bg-blue-100 text-blue-800'
                              : ev.category === 'BROWSER'
                              ? 'bg-purple-100 text-purple-800'
                              : ev.category === 'TECHNICAL'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {ev.category}
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {ev.eventType}
                        </span>
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            ev.severity === 'HIGH' || ev.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800'
                              : ev.severity === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {ev.severity}
                        </span>
                        {ev.strikeAssigned || (ev.strikePoints && ev.strikePoints > 0) ? (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-600 text-white">
                            +{ev.strikePoints || 1} Strike
                          </span>
                        ) : (
                          <span className="text-[9px] font-medium text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            0 Strikes (Diagnostic)
                          </span>
                        )}
                      </div>
                      {ev.reason && (
                        <p className="text-xs text-slate-600 font-medium">
                          {ev.reason}
                        </p>
                      )}
                      <p className="text-[11px] text-slate-400 font-mono">
                        {new Date(ev.serverTimestamp).toLocaleString()}
                      </p>
                    </div>
                    {ev.metadata && Object.keys(ev.metadata).length > 0 && (
                      <pre className="text-[10px] bg-slate-50 border border-slate-100 rounded p-1.5 text-slate-600 font-mono max-w-xs truncate">
                        {JSON.stringify(ev.metadata)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                onClick={() => setSelectedSessionEvents(null)}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT COMPARATIVE ANSWERS AUDIT MODAL (FOR COLLEGE FACULTY INQUIRIES) */}
      {selectedAuditStudent !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden font-sans">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    Student Answers & Comparative Evaluation Audit
                  </h3>
                  {auditData && (
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                      auditData.shortlistStatus === 'SHORTLISTED'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-rose-100 text-rose-800 border border-rose-300'
                    }`}>
                      {auditData.shortlistStatus === 'SHORTLISTED' ? 'QUALIFIED / SHORTLISTED' : 'FAILED / NOT SHORTLISTED'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-mono">
                  Candidate: <strong className="text-slate-800">{auditData?.studentName || selectedAuditStudent.candidateName || selectedAuditStudent.candidateId?.fullName}</strong> ({auditData?.studentEmail || selectedAuditStudent.candidateEmail || selectedAuditStudent.candidateId?.email})
                  {selectedAuditStudent.submittedAt && (
                    <span> · Submitted: {new Date(selectedAuditStudent.submittedAt).toLocaleString()}</span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedAuditStudent(null);
                  setAuditData(null);
                }}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors cursor-pointer"
                title="Close"
              >
                <X size={20} />
              </button>
            </div>

            {loadingAudit ? (
              <div className="p-16 flex flex-col items-center justify-center text-slate-400 gap-3">
                <Loader2 size={32} className="animate-spin text-slate-700" />
                <p className="text-sm font-medium text-slate-600">Retrieving authoritative student answers and answer keys...</p>
                <p className="text-xs text-slate-400">Querying collection: student_answers</p>
              </div>
            ) : !auditData ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No answer audit records found for this candidate.
              </div>
            ) : (
              <div className="overflow-y-auto flex-1 p-6 space-y-6">
                {/* 1. FACULTY INQUIRY RESOLUTION BANNER ("WHY DID HE FAIL / PASS?") */}
                <div className={`rounded-xl border p-5 ${
                  auditData.shortlistStatus === 'SHORTLISTED'
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    : 'bg-rose-50/70 border-rose-200 text-rose-950'
                }`}>
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3 pb-3 border-b border-slate-200/60">
                    <div className="flex items-center gap-2">
                      <HelpCircle size={20} className={auditData.shortlistStatus === 'SHORTLISTED' ? 'text-emerald-700' : 'text-rose-700'} />
                      <h4 className="text-sm font-bold tracking-tight">
                        Faculty Inquiry Resolution: {auditData.shortlistStatus === 'SHORTLISTED' ? 'Why Did This Student Pass?' : 'Why Did This Student Fail?'}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copyFacultySummary}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        {copiedSummary ? (
                          <>
                            <Check size={13} className="text-emerald-600" />
                            <span className="text-emerald-600">Copied to Clipboard!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy Summary for Faculty</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="px-3 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Printer size={13} />
                        <span>Print Report</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 mb-4 text-center">
                    <div className="bg-white/90 rounded-lg p-2.5 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Score</span>
                      <span className="text-base font-bold text-slate-900">{auditData.marksObtained} / 60</span>
                    </div>
                    <div className="bg-white/90 rounded-lg p-2.5 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Percentage</span>
                      <span className="text-base font-bold text-slate-900">{auditData.percentage}%</span>
                    </div>
                    <div className="bg-white/90 rounded-lg p-2.5 border border-slate-200/80 shadow-2xs">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Passing Cutoff</span>
                      <span className="text-base font-bold text-slate-900">{auditData.cutoffMarks || 35} / 60</span>
                    </div>
                    <div className="bg-white/90 rounded-lg p-2.5 border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] text-emerald-700 font-semibold uppercase tracking-wider block">Correct</span>
                      <span className="text-base font-bold text-emerald-700">{auditData.correctAnswers || 0}</span>
                    </div>
                    <div className="bg-white/90 rounded-lg p-2.5 border border-rose-200 shadow-2xs">
                      <span className="text-[10px] text-rose-700 font-semibold uppercase tracking-wider block">Wrong</span>
                      <span className="text-base font-bold text-rose-700">{auditData.wrongAnswers || 0}</span>
                    </div>
                    <div className="bg-white/90 rounded-lg p-2.5 border border-slate-200 shadow-2xs">
                      <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Unanswered</span>
                      <span className="text-base font-bold text-slate-600">{auditData.unansweredQuestions || 0}</span>
                    </div>
                  </div>

                  {/* Narrative Justification */}
                  <div className="bg-white/95 rounded-lg p-3.5 border border-slate-200 text-xs font-sans whitespace-pre-line text-slate-700 leading-relaxed shadow-2xs">
                    {auditData.whyFailedReason}
                  </div>
                </div>

                {/* 2. QUESTION FILTER TABS */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setAuditFilter('ALL')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        auditFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      All Questions ({auditData.questionAudits?.length || 60})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter('WRONG')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        auditFilter === 'WRONG'
                          ? 'bg-rose-600 text-white shadow-xs'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <XCircle size={13} />
                      Wrong Answers Only ({auditData.questionAudits?.filter((q: any) => q.status === 'WRONG').length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter('UNANSWERED')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        auditFilter === 'UNANSWERED'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      <MinusCircle size={13} />
                      Unanswered ({auditData.questionAudits?.filter((q: any) => q.status === 'UNANSWERED').length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuditFilter('CORRECT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        auditFilter === 'CORRECT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      Correct Answers ({auditData.questionAudits?.filter((q: any) => q.status === 'CORRECT').length || 0})
                    </button>
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    Showing {
                      auditData.questionAudits?.filter((q: any) => {
                        if (auditFilter === 'WRONG') return q.status === 'WRONG';
                        if (auditFilter === 'CORRECT') return q.status === 'CORRECT';
                        if (auditFilter === 'UNANSWERED') return q.status === 'UNANSWERED';
                        return true;
                      }).length || 0
                    } questions
                  </span>
                </div>

                {/* 3. COMPARATIVE QUESTION AUDIT CARDS */}
                <div className="space-y-4">
                  {auditData.questionAudits
                    ?.filter((q: any) => {
                      if (auditFilter === 'WRONG') return q.status === 'WRONG';
                      if (auditFilter === 'CORRECT') return q.status === 'CORRECT';
                      if (auditFilter === 'UNANSWERED') return q.status === 'UNANSWERED';
                      return true;
                    })
                    .map((q: any) => (
                      <div
                        key={q.questionId}
                        className={`rounded-xl border p-4.5 space-y-3 transition-shadow ${
                          q.status === 'CORRECT'
                            ? 'bg-white border-emerald-200 shadow-2xs'
                            : q.status === 'WRONG'
                            ? 'bg-white border-rose-200 shadow-2xs'
                            : 'bg-slate-50/60 border-slate-200'
                        }`}
                      >
                        {/* Question Metadata Header */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold font-mono bg-slate-900 text-white">
                              Q{q.questionNumber || q.questionId}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              {q.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-slate-100 text-slate-500">
                              {q.type}
                            </span>
                          </div>

                          <div>
                            {q.status === 'CORRECT' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                                <CheckCircle2 size={13} /> Correct (+1 Mark)
                              </span>
                            ) : q.status === 'WRONG' ? (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                                <XCircle size={13} /> Incorrect (0 Marks)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-300 flex items-center gap-1">
                                <MinusCircle size={13} /> Not Attempted (0 Marks)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Question Prompt */}
                        <p className="text-sm font-semibold text-slate-800 leading-snug">
                          {q.questionText}
                        </p>

                        {/* Side-by-Side Comparison Box */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                          {/* Student Placed Answer */}
                          <div className={`rounded-lg p-3 border text-xs space-y-1 ${
                            q.status === 'CORRECT'
                              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                              : q.status === 'WRONG'
                              ? 'bg-rose-50/70 border-rose-300 text-rose-950'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}>
                            <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider">
                              <span className="flex items-center gap-1">
                                {q.status === 'CORRECT' ? <CheckCircle2 size={12} className="text-emerald-700" /> : q.status === 'WRONG' ? <XCircle size={12} className="text-rose-700" /> : <MinusCircle size={12} />}
                                Student Selected Answer
                              </span>
                              <span>{q.marksAwarded} / {q.maxMarks || 1} mark</span>
                            </div>
                            <p className="font-mono font-medium text-xs break-words leading-relaxed">
                              {q.studentAnswer || 'Not Attempted by Candidate'}
                            </p>
                          </div>

                          {/* Data Valley Actual Authoritative Answer */}
                          <div className="rounded-lg p-3 border bg-emerald-50/70 border-emerald-300 text-emerald-950 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold text-[11px] uppercase tracking-wider text-emerald-800">
                              <span className="flex items-center gap-1">
                                <Check size={12} className="text-emerald-700 font-bold" />
                                Data Valley Actual Answer Key
                              </span>
                              <span>Expected: 1 mark</span>
                            </div>
                            <p className="font-mono font-semibold text-xs break-words leading-relaxed text-emerald-900">
                              {q.actualAnswer}
                            </p>
                          </div>
                        </div>

                        {/* Authoritative Explanation */}
                        {q.explanation && (
                          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-xs text-slate-600 flex items-start gap-2">
                            <span className="font-bold text-slate-700 whitespace-nowrap">Explanation:</span>
                            <span className="leading-relaxed">{q.explanation}</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Data Valley Institutional Assessment Audit System · Authorized Admin Personnel Only
              </span>
              <button
                onClick={() => {
                  setSelectedAuditStudent(null);
                  setAuditData(null);
                }}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
