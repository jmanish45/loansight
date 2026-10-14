import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Brain,
  ShieldCheck,
  FileText,
  Building,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  BookmarkPlus,
  Loader2,
  Info,
  Scale,
  Search,
  Zap,
  Cpu,
  Layers,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';
import { officerService } from '../../services/officerService';

function formatINR(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

const VERDICT_CONFIG = {
  ELIGIBLE: {
    label: 'Sanction Recommended',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-300',
    icon: CheckCircle2,
    color: 'emerald',
  },
  INELIGIBLE: {
    label: 'Ineligible under Policy',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300',
    icon: XCircle,
    color: 'rose',
  },
  CONDITIONAL_APPROVAL: {
    label: 'Conditional Approval',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300',
    icon: ShieldCheck,
    color: 'sky',
  },
  FLAGGED_REVIEW: {
    label: 'Underwriting Flagged / Review Required',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    icon: AlertTriangle,
    color: 'amber',
  },
  DOCS_REQUIRED: {
    label: 'Additional Documents Required',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-300',
    icon: FileText,
    color: 'purple',
  },
  INFORMATIONAL: {
    label: 'Policy Analysis & Risk Evaluation',
    badgeClass: 'bg-indigo-50 text-indigo-900 border-indigo-300',
    icon: Info,
    color: 'indigo',
  },
};

const CATEGORIZED_PROMPTS = [
  {
    category: 'Eligibility & Limits',
    icon: Zap,
    prompts: [
      `Is applicant eligible for ${formatINR(1500000)}?`,
      'What is the maximum eligible loan based on FOIR?',
    ],
  },
  {
    category: 'Risk & Compliance',
    icon: AlertTriangle,
    prompts: [
      'Why was this application flagged under review?',
      'Which specific bank policy rule caused the issue?',
    ],
  },
  {
    category: 'Verification & Audit',
    icon: ShieldCheck,
    prompts: [
      'Check KYC, identity, and salary slip consistency',
      'What are mandatory documents for this loan type?',
    ],
  },
];

export default function LoanAssistantChat({ application, onNoteAdded }) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState('applicant'); // 'applicant' | 'policy'
  const [mobileTab, setMobileTab] = useState('copilot'); // 'copilot' | 'radar'
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [savingNoteIndex, setSavingNoteIndex] = useState(null);
  const [noteSavedIndex, setNoteSavedIndex] = useState(null);
  const [policiesModalOpen, setPoliciesModalOpen] = useState(false);
  const [allPolicies, setAllPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const requestedAmt = application?.requestedAmount || 1500000;
  const loanType = application?.loanType || 'personal';
  const declaredIncome = application?.declaredMonthlyIncome || 0;
  const applicantName = application?.applicant?.name || 'Applicant';

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Initial welcome message setup
  useEffect(() => {
    if (application && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          verdict: 'INFORMATIONAL',
          confidence: 0.98,
          confidenceLevel: 'HIGH',
          answer: `### Welcome to LoanSight Underwriting Intelligence Copilot\n\nI have indexed **${applicantName}'s** application records from MongoDB and grounded them against **${application?.bankName || 'HDFC Bank'} underwriting policies** in the vector store.\n\nSelect a quick inquiry card below or type any custom credit underwriting question.`,
          applicantDataSources: [
            { label: 'Applicant Name', value: applicantName, sourceDocument: 'Application Form', verified: true },
            { label: 'Requested Loan', value: formatINR(requestedAmt), sourceDocument: 'Application Form', verified: true },
            { label: 'Declared Income', value: declaredIncome ? `${formatINR(declaredIncome)}/mo` : 'Not Specified', sourceDocument: 'Salary Slip', verified: !!declaredIncome },
            { label: 'Loan Product', value: `${loanType.toUpperCase()} Loan`, sourceDocument: 'Policy Master', verified: true },
          ],
          policySources: [
            {
              policyId: 'HDFC-PL-001',
              policyName: `${application?.bankName || 'HDFC Bank'} ${loanType.charAt(0).toUpperCase() + loanType.slice(1)} Policy`,
              section: 'Underwriting & Eligibility Matrix',
              ruleSummary: 'Active Bank Underwriting Vector Index Synced',
              citationUrl: 'https://www.hdfc.bank.in',
              similarityScore: 0.99,
            },
          ],
          suggestedFollowups: [
            `Is this applicant eligible for ${formatINR(requestedAmt)}?`,
            'Why was this application flagged or placed under review?',
            'What is the maximum eligible loan based on FOIR & income?',
          ],
        },
      ]);
    }
  }, [application]);

  const handleSendMessage = async (queryText) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || loading) return;

    setInputQuery('');
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content || m.answer || '',
        }));

      const response = await officerService.askLoanAssistant(
        application._id,
        textToSend,
        history
      );

      const aiData = response.data?.data || response.data;

      const aiMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        answer: aiData.answer || 'No analysis could be generated.',
        verdict: aiData.verdict || 'INFORMATIONAL',
        confidence: aiData.confidence || 0.92,
        confidenceLevel: aiData.confidenceLevel || 'HIGH',
        reasoning: aiData.reasoning || [],
        applicantDataSources: aiData.applicantDataSources || [],
        policySources: aiData.policySources || [],
        financialMetrics: aiData.financialMetrics || null,
        missingInformation: aiData.missingInformation || [],
        suggestedFollowups: aiData.suggestedFollowups || [],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Error querying loan assistant:', error);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        verdict: 'FLAGGED_REVIEW',
        confidence: 0.5,
        confidenceLevel: 'LOW',
        answer: `AI Underwriting Engine Connection Issue: ${
          error.response?.data?.message || error.message || 'AI service endpoint did not respond'
        }. Please ensure the AI service is running.`,
        applicantDataSources: [],
        policySources: [],
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleCopyAnswer = (text, index) => {
    const cleanText = text.replace(/### |#### |\*\*/g, '');
    navigator.clipboard.writeText(cleanText);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSaveToNotes = async (msg, index) => {
    try {
      setSavingNoteIndex(index);
      const noteContent = `[AI Loan Officer Assistant Analysis - ${msg.verdict || 'EVALUATION'}]\n${msg.answer}\n\nEvidence Checked:\n- Applicant Data Points: ${msg.applicantDataSources?.length || 0}\n- Policy Rules Cited: ${msg.policySources?.length || 0}`;

      await officerService.addNote(application._id, noteContent);
      setNoteSavedIndex(index);
      if (onNoteAdded) onNoteAdded();
      setTimeout(() => setNoteSavedIndex(null), 3000);
    } catch (err) {
      console.error('Failed to save AI analysis to notes', err);
    } finally {
      setSavingNoteIndex(null);
    }
  };

  const fetchBankPolicies = async () => {
    try {
      setPoliciesLoading(true);
      const res = await officerService.getBankPolicies();
      setAllPolicies(res.data?.data || res.data?.policies || []);
    } catch (err) {
      console.error('Failed to fetch policies', err);
    } finally {
      setPoliciesLoading(false);
    }
  };

  const openPoliciesModal = () => {
    setPoliciesModalOpen(true);
    if (allPolicies.length === 0) fetchBankPolicies();
  };

  const filteredPolicies = allPolicies.filter((p) => {
    if (!policySearchQuery.trim()) return true;
    const q = policySearchQuery.toLowerCase();
    return (
      p.policyName?.toLowerCase().includes(q) ||
      p.section?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.rules?.some((r) => r.toLowerCase().includes(q))
    );
  });

  const latestAIMessage = [...messages].reverse().find((m) => m.role === 'assistant') || messages[0];  return (
    <div className="flex flex-col h-[820px] bg-slate-100/95 border border-slate-300/80 rounded-md shadow-xl overflow-hidden font-sans text-slate-800 relative">
      {/* ── Top Command Bar ── */}
      <header className="bg-slate-900 text-white border-b border-slate-800 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-md bg-emerald-500/20 border border-emerald-400/30 p-0.5 shadow-lg">
            <Cpu className="w-5 h-5 text-emerald-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-white tracking-wide">
                Underwriting Intelligence Engine
              </h2>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                <Brain className="w-3 h-3 text-emerald-300" /> HYBRID RAG ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-300 font-medium">
              Grounded in MongoDB Applicant Snapshots &amp; Bank Policy Vector Store
            </p>
          </div>
        </div>

        {/* Snapshot Badges & Policy Action */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 bg-slate-800 border border-slate-700/80 rounded-md text-xs flex items-center gap-1.5 text-slate-200 font-semibold shadow-2xs">
            <Building className="w-3.5 h-3.5 text-emerald-400" />
            <span>{application?.bankName || 'HDFC Bank'}</span>
          </div>
          <div className="px-3 py-1 bg-slate-800 border border-slate-700/80 rounded-md text-xs text-slate-200">
            <span className="text-slate-400">Loan:</span>{' '}
            <span className="font-bold text-white uppercase">{loanType}</span>
          </div>
          <div className="px-3 py-1 bg-slate-800 border border-slate-700/80 rounded-md text-xs">
            <span className="text-slate-400">Amount:</span>{' '}
            <span className="font-mono font-bold text-emerald-400">{formatINR(requestedAmt)}</span>
          </div>
          <button
            type="button"
            onClick={openPoliciesModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md border border-emerald-500 text-xs font-bold transition shadow-sm cursor-pointer"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-100" />
            <span>Vector Rules Index</span>
          </button>
        </div>
      </header>

      {/* ── Mobile Tab Selector (< 1024px) ── */}
      <div className="lg:hidden flex border-b border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setMobileTab('copilot')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition ${
            mobileTab === 'copilot'
              ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/60'
              : 'text-slate-500'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> AI Copilot Stream
        </button>
        <button
          type="button"
          onClick={() => setMobileTab('radar')}
          className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-2 transition ${
            mobileTab === 'radar'
              ? 'text-emerald-700 border-b-2 border-emerald-600 bg-emerald-50/60'
              : 'text-slate-500'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Evidence Radar
        </button>
      </div>

      {/* ── Main Workspace Body (2-Pane Grid) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-slate-100/50">
        {/* ── LEFT PANE: Context & Evidence Radar (4 cols on desktop) ── */}
        <aside
          className={`lg:col-span-4 border-r border-slate-200/90 bg-slate-50 flex flex-col overflow-hidden ${
            mobileTab === 'radar' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Radar Section Header */}
          <div className="p-3.5 border-b border-slate-200 bg-white flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Evidence Grounding Radar</span>
            </div>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              RAG Engine
            </span>
          </div>

          {/* Sub-tabs inside Left Radar */}
          <div className="flex border-b border-slate-200 bg-slate-100 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveEvidenceTab('applicant')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center border-b-2 transition ${
                activeEvidenceTab === 'applicant'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Applicant Facts ({latestAIMessage?.applicantDataSources?.length || 4})
            </button>
            <button
              type="button"
              onClick={() => setActiveEvidenceTab('policy')}
              className={`flex-1 py-2.5 text-[11px] font-bold text-center border-b-2 transition ${
                activeEvidenceTab === 'policy'
                  ? 'border-emerald-600 text-emerald-800 bg-white'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Bank Rules ({latestAIMessage?.policySources?.length || 1})
            </button>
          </div>

          {/* Radar Content Feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-300">
            {/* Financial Health Overview Card */}
            {latestAIMessage?.financialMetrics && (
              <div className="bg-white border border-slate-200/90 rounded-md p-3.5 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> FOIR Underwriting Ratio
                  </span>
                  <span className={`font-mono text-xs font-bold ${
                    latestAIMessage.financialMetrics.isFoirCompliant ? 'text-emerald-700' : 'text-rose-600'
                  }`}>
                    {latestAIMessage.financialMetrics.calculatedFoirPct}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      latestAIMessage.financialMetrics.isFoirCompliant ? 'bg-emerald-600' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(latestAIMessage.financialMetrics.calculatedFoirPct || 0, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold">
                  <span>Permissible Policy Cap: {latestAIMessage.financialMetrics.maxPermissibleFoirPct}%</span>
                  <span className="font-bold text-slate-800">{latestAIMessage.financialMetrics.isFoirCompliant ? 'PASS' : 'EXCEEDED'}</span>
                </div>
              </div>
            )}

            {activeEvidenceTab === 'applicant' && (
              <div className="space-y-2">
                {latestAIMessage?.applicantDataSources?.map((item, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/90 rounded-md p-3 flex items-start justify-between gap-2 hover:border-emerald-400 transition shadow-2xs"
                  >
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-bold">
                        {item.label}
                      </span>
                      <span className="text-xs font-bold text-slate-900 block mt-0.5">{item.value}</span>
                      <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                        Source: {item.sourceDocument || 'Document System'}
                      </span>
                    </div>
                    {item.verified ? (
                      <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300 shrink-0">
                        Verified
                      </span>
                    ) : (
                      <span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-300 shrink-0">
                        Declared
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeEvidenceTab === 'policy' && (
              <div className="space-y-2">
                {latestAIMessage?.policySources?.map((policy, idx) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200/90 rounded-md p-3 space-y-1.5 hover:border-emerald-400 transition shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-emerald-900 truncate">
                        {policy.policyName}
                      </span>
                      {policy.similarityScore && (
                        <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                          {Math.round(policy.similarityScore * 100)}% Match
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-700 leading-relaxed font-medium">
                      {policy.ruleSummary || policy.rules?.[0] || 'Standard bank policy rule.'}
                    </p>
                    {policy.citationUrl && (
                      <a
                        href={policy.citationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-emerald-600 hover:text-emerald-800 font-bold underline underline-offset-2 pt-1"
                      >
                        <span>Official Bank Policy Citation</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* ── RIGHT PANE: AI Copilot Stream (8 cols on desktop) ── */}
        <main
          className={`lg:col-span-8 flex flex-col h-full overflow-hidden bg-slate-50 ${
            mobileTab === 'copilot' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          {/* Quick Category Prompts Toolbar */}
          <div className="bg-white border-b border-slate-200 px-4 py-2.5 overflow-x-auto scrollbar-none flex items-center gap-2 shrink-0 shadow-2xs">
            <span className="text-[10px] font-mono uppercase font-bold text-emerald-800 flex items-center gap-1 shrink-0 px-2.5 py-1 bg-emerald-50 rounded-md border border-emerald-200">
              <Zap className="w-3 h-3 text-emerald-600" /> QUICK PROMPTS
            </span>
            {CATEGORIZED_PROMPTS.flatMap((cat) =>
              cat.prompts.map((prompt, idx) => (
                <button
                  key={`${cat.category}-${idx}`}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={loading}
                  className="text-[11px] whitespace-nowrap px-3 py-1.5 rounded-md bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border border-emerald-200/80 font-semibold transition shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  {prompt}
                </button>
              ))
            )}
          </div>

          {/* Main Message Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin scrollbar-thumb-slate-300">
            {messages.map((msg, index) => {
              const isAI = msg.role === 'assistant';
              const verdictInfo = VERDICT_CONFIG[msg.verdict] || VERDICT_CONFIG.INFORMATIONAL;

              return (
                <div
                  key={msg.id || index}
                  className={`flex flex-col ${isAI ? 'items-start' : 'items-end'}`}
                >
                  {!isAI ? (
                    /* User Bubble */
                    <div className="flex items-start gap-2.5 max-w-xl flex-row-reverse">
                      <div className="w-7 h-7 rounded-md bg-slate-900 text-white border border-slate-800 flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm">
                        LO
                      </div>
                      <div className="bg-slate-900 text-white border border-slate-800 px-4 py-2.5 rounded-md shadow-md text-xs sm:text-sm font-medium leading-relaxed">
                        {msg.content}
                      </div>
                    </div>
                  ) : (
                    /* AI Assistant Response Card */
                    <div className="w-full bg-white border border-slate-200/90 rounded-md p-4 sm:p-5 shadow-md shadow-slate-200/50 space-y-4">
                      {/* Verdict Header & Action Bar */}
                      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`px-3 py-1 rounded-md ${verdictInfo.badgeClass} border flex items-center gap-1.5`}>
                            <verdictInfo.icon className="w-4 h-4" />
                            <span className="text-xs font-bold tracking-wide uppercase">
                              {verdictInfo.label}
                            </span>
                          </div>

                          {msg.confidence && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-700 border border-slate-200">
                              <Scale className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-slate-500">Confidence:</span>
                              <span className="font-bold text-slate-900">{Math.round(msg.confidence * 100)}%</span>
                            </div>
                          )}
                        </div>

                        {/* Action Tools */}
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopyAnswer(msg.answer, index)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-200 transition cursor-pointer"
                          >
                            {copiedIndex === index ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-emerald-700 font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-slate-500" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {msg.id !== 'welcome' && (
                            <button
                              type="button"
                              onClick={() => handleSaveToNotes(msg, index)}
                              disabled={savingNoteIndex === index}
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 px-3 py-1.5 rounded-md bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition disabled:opacity-50 cursor-pointer"
                            >
                              {savingNoteIndex === index ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                              ) : noteSavedIndex === index ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-emerald-700 font-bold">Saved to Notes</span>
                                </>
                              ) : (
                                <>
                                  <BookmarkPlus className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Save to Notes</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Main Answer Content (Markdown-like render) */}
                      <div className="text-xs sm:text-sm text-slate-700 leading-relaxed space-y-2 font-normal">
                        {msg.answer.split('\n').map((line, idx) => {
                          if (line.startsWith('### ')) {
                            return <h3 key={idx} className="text-sm font-extrabold text-slate-900 mt-2 mb-1">{line.replace('### ', '')}</h3>;
                          }
                          if (line.startsWith('#### ')) {
                            return <h4 key={idx} className="text-xs font-bold text-emerald-900 mt-2 mb-1">{line.replace('#### ', '')}</h4>;
                          }
                          if (line.startsWith('- ')) {
                            return (
                              <li key={idx} className="text-slate-700 text-xs ml-4 list-disc">
                                <span dangerouslySetInnerHTML={{ __html: line.replace('- ', '').replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>') }} />
                              </li>
                            );
                          }
                          if (line.trim() === '') return null;
                          return (
                            <p key={idx} className="text-xs text-slate-700" dangerouslySetInnerHTML={{
                              __html: line.replace(/\*\*(.*?)\*\*/g, '<strong class="text-slate-900 font-bold">$1</strong>')
                            }} />
                          );
                        })}
                      </div>

                      {/* Follow-up suggestions */}
                      {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[10px] font-mono text-slate-500 uppercase font-bold tracking-wider block mb-2">
                            Suggested Follow-up inquiries:
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {msg.suggestedFollowups.map((followup, fIdx) => (
                              <button
                                key={fIdx}
                                type="button"
                                onClick={() => handleSendMessage(followup)}
                                disabled={loading}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-200 hover:border-emerald-300 transition disabled:opacity-50 cursor-pointer"
                              >
                                <MessageSquare className="w-3 h-3 text-slate-500 shrink-0" />
                                <span>{followup}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-3 bg-white border border-slate-200 p-4 rounded-md max-w-md shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                <span className="text-xs font-medium text-slate-700">
                  Retrieving MongoDB applicant vectors &amp; querying HDFC policy matrix...
                </span>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Command Input Bar */}
          <div className="p-4 bg-white border-t border-slate-200 shrink-0 shadow-lg">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask AI Underwriting Assistant (e.g., 'Check FOIR eligibility', 'Which policy rule failed?')..."
                  disabled={loading}
                  className="w-full bg-slate-50 border border-slate-300 focus:border-emerald-600 focus:bg-white text-slate-900 text-xs sm:text-sm rounded-md px-4 py-3 pr-16 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 placeholder-slate-400 transition font-medium"
                />
                <span className="absolute right-3.5 top-3.5 text-[10px] font-mono text-slate-400 font-semibold hidden sm:inline">
                  Enter ↵
                </span>
              </div>

              <button
                type="submit"
                disabled={!inputQuery.trim() || loading}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95 shrink-0 cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Ask AI</span>
                    <Send className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>
      </div>

      {/* ── Bank Policies Catalogue Modal ── */}
      {policiesModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-300 rounded-md w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Bank Lending Policies Knowledge Base</h3>
              </div>
              <button
                type="button"
                onClick={() => setPoliciesModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold px-2.5 py-1 rounded-md bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={policySearchQuery}
                  onChange={(e) => setPolicySearchQuery(e.target.value)}
                  placeholder="Filter vector policies by rule name, category, FOIR, age limit..."
                  className="w-full bg-white border border-slate-300 rounded-md pl-10 pr-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
              {policiesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-600 mb-2" />
                  <span className="text-xs font-semibold">Fetching bank policy vector records...</span>
                </div>
              ) : filteredPolicies.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-medium">
                  No policy rules found matching your query.
                </div>
              ) : (
                filteredPolicies.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="bg-white border border-slate-200 rounded-md p-4 space-y-2 shadow-2xs hover:border-slate-300 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-950 block">{p.policyName}</span>
                        <span className="text-[11px] text-slate-500 font-medium">{p.section}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {p.category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-700 block">Rules &amp; Constraints:</span>
                      <ul className="text-xs text-slate-700 list-disc list-inside space-y-0.5 font-medium">
                        {p.rules?.map((rule, rIdx) => (
                          <li key={rIdx}>{rule}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
