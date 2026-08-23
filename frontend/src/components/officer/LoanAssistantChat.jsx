import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Send,
  Brain,
  ShieldCheck,
  FileText,
  Building,
  HelpCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Copy,
  Check,
  BookmarkPlus,
  Loader2,
  RefreshCw,
  Info,
  Scale,
  Percent,
  IndianRupee,
  Layers,
  Search,
} from 'lucide-react';
import { officerService } from '../../services/officerService';

function formatINR(amount) {
  if (amount === undefined || amount === null) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

// Escape HTML entities BEFORE applying our controlled markdown-bold transform.
// The AI answer is derived from applicant-supplied data (e.g. their name), so
// injecting it raw into dangerouslySetInnerHTML is a stored-XSS sink. Escaping
// first neutralises any markup; the only real tags are the <strong> we add
// afterwards. The `**bold**` markers are plain asterisks and survive escaping.
function renderInlineMarkdown(text) {
  const escaped = String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
  return escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
}

const VERDICT_CONFIG = {
  ELIGIBLE: {
    label: 'Eligible for Sanction',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 border-emerald-400/30',
    icon: CheckCircle2,
    color: 'emerald',
  },
  INELIGIBLE: {
    label: 'Ineligible under Policy',
    badgeClass: 'bg-rose-500/15 text-rose-700 border-rose-400/30',
    icon: XCircle,
    color: 'rose',
  },
  CONDITIONAL_APPROVAL: {
    label: 'Conditional Approval',
    badgeClass: 'bg-blue-500/15 text-blue-700 border-blue-400/30',
    icon: ShieldCheck,
    color: 'blue',
  },
  FLAGGED_REVIEW: {
    label: 'Review Required / Flagged',
    badgeClass: 'bg-amber-500/15 text-amber-700 border-amber-400/30',
    icon: AlertTriangle,
    color: 'amber',
  },
  DOCS_REQUIRED: {
    label: 'Additional Documents Needed',
    badgeClass: 'bg-purple-500/15 text-purple-700 border-purple-400/30',
    icon: FileText,
    color: 'purple',
  },
  INFORMATIONAL: {
    label: 'Policy Analysis',
    badgeClass: 'bg-indigo-500/15 text-indigo-700 border-indigo-400/30',
    icon: Info,
    color: 'indigo',
  },
};

export default function LoanAssistantChat({ application, onNoteAdded }) {
  const [messages, setMessages] = useState([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeEvidenceTab, setActiveEvidenceTab] = useState({}); // messageIndex -> 'applicant' | 'policy' | 'reasoning'
  const [expandedReasoning, setExpandedReasoning] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [savingNoteIndex, setSavingNoteIndex] = useState(null);
  const [noteSavedIndex, setNoteSavedIndex] = useState(null);
  const [policiesModalOpen, setPoliciesModalOpen] = useState(false);
  const [allPolicies, setAllPolicies] = useState([]);
  const [policiesLoading, setPoliciesLoading] = useState(false);
  const [policySearchQuery, setPolicySearchQuery] = useState('');

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Formulate dynamic quick inquiry prompts based on application data
  const requestedAmt = application?.requestedAmount || 1500000;
  const loanType = application?.loanType || 'personal';
  const declaredIncome = application?.declaredMonthlyIncome || 0;

  const quickPrompts = [
    `Is this applicant eligible for ${formatINR(requestedAmt)}?`,
    'Why was this application flagged or placed under review?',
    'Which specific policy rule caused the issue?',
    'What is the maximum eligible loan based on FOIR & income?',
    'Check KYC, identity, and salary slip consistency',
    `What are the mandatory documents for ${loanType.toUpperCase()} loan?`,
  ];

  // Auto-scroll on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Initial welcome message
  useEffect(() => {
    if (application && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          verdict: 'INFORMATIONAL',
          answer: `### 👋 Welcome to LoanSight AI Officer Assistant\n\nI am your **Hybrid RAG Credit Underwriting Copilot**. I analyze **${application.applicant?.name || 'this applicant'}'s** extracted financial data from MongoDB and cross-reference it with official **HDFC Bank lending policies** and risk guidelines.\n\nAsk any question regarding loan eligibility, FOIR calculations, policy rules, or flag root causes below.`,
          applicantDataSources: [
            { label: 'Applicant Name', value: application.applicant?.name || 'Applicant', sourceDocument: 'Application Form (declared)', verified: false },
            { label: 'Requested Amount', value: formatINR(application.requestedAmount), sourceDocument: 'Application Form (declared)', verified: false },
            { label: 'Declared Income', value: `${formatINR(declaredIncome)}/mo`, sourceDocument: 'Application Form (declared)', verified: false },
            { label: 'Loan Type', value: `${loanType.toUpperCase()} Loan`, sourceDocument: 'Application Form (declared)', verified: false },
          ],
          // No policy citations are seeded on the greeting — real policy matches
          // are populated from actual RAG retrieval when the officer asks a question.
          policySources: [],
          suggestedFollowups: quickPrompts.slice(0, 3),
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
      // Build conversation history format for LLM
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
        // Display confidence ONLY if the AI service actually returned one — never
        // fabricate a default. The badge is hidden when confidence is null.
        confidence: aiData.confidence ?? null,
        confidenceLevel: aiData.confidenceLevel || null,
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
        answer: `⚠️ **Unable to complete AI analysis:** ${
          error.response?.data?.message || error.message || 'Server connection error'
        }. Please verify that the AI service is running.`,
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
    navigator.clipboard.writeText(text);
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
    if (allPolicies.length === 0) {
      fetchBankPolicies();
    }
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

  return (
    <div className="flex flex-col h-[780px] bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
      {/* ── Top Header Context Bar ── */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/70 to-slate-900 border-b border-slate-800/80 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Brain className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                LoanSight AI Underwriting Assistant
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Sparkles className="w-2.5 h-2.5" /> Hybrid RAG
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Grounded in MongoDB Applicant Snapshot & HDFC Bank Policy Vector Store
            </p>
          </div>
        </div>

        {/* Quick Application Snapshot Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 bg-indigo-950/80 rounded-lg border border-indigo-500/40 text-xs text-indigo-300">
            <span className="text-indigo-400">Bank:</span>{' '}
            <span className="font-bold text-white">{application?.bankName || 'HDFC Bank'}</span>
          </div>
          <div className="px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs text-slate-300">
            <span className="text-slate-400">Type:</span>{' '}
            <span className="font-semibold text-white uppercase">{application?.loanType}</span>
          </div>
          <div className="px-3 py-1 bg-slate-800/80 rounded-lg border border-slate-700/60 text-xs text-slate-300">
            <span className="text-slate-400">Amount:</span>{' '}
            <span className="font-semibold text-emerald-400">{formatINR(application?.requestedAmount)}</span>
          </div>
          <button
            onClick={openPoliciesModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white rounded-lg border border-indigo-500/30 text-xs font-medium transition-all"
          >
            <Building className="w-3.5 h-3.5" /> Browse Bank Policies
          </button>
        </div>
      </div>

      {/* ── Quick Inquiries Pill Bar ── */}
      <div className="bg-slate-950/60 border-b border-slate-800/60 px-6 py-2.5 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Sparkles className="w-3 h-3 text-amber-400" /> Quick Prompts:
        </span>
        {quickPrompts.map((prompt, i) => (
          <button
            key={i}
            onClick={() => handleSendMessage(prompt)}
            disabled={loading}
            className="text-xs whitespace-nowrap px-3 py-1 rounded-full bg-slate-800/70 hover:bg-indigo-600/30 text-slate-300 hover:text-indigo-200 border border-slate-700/60 hover:border-indigo-500/40 transition-all shrink-0 active:scale-95 disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* ── Main Chat Stream ── */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
        {messages.map((msg, index) => {
          const isAI = msg.role === 'assistant';
          const verdictInfo = VERDICT_CONFIG[msg.verdict] || VERDICT_CONFIG.INFORMATIONAL;
          const currentTab = activeEvidenceTab[index] || 'applicant';
          const isReasoningOpen = expandedReasoning[index] || false;

          return (
            <div
              key={msg.id || index}
              className={`flex flex-col ${isAI ? 'items-start' : 'items-end'} max-w-full`}
            >
              {/* User Message Bubble */}
              {!isAI ? (
                <div className="flex items-start gap-3 max-w-2xl flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-md">
                    LO
                  </div>
                  <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-md text-sm leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              ) : (
                /* AI Assistant Response Card */
                <div className="w-full max-w-4xl bg-slate-950/80 border border-slate-800/90 rounded-2xl p-5 shadow-xl space-y-4">
                  {/* Verdict & Confidence Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${verdictInfo.badgeClass} border flex items-center gap-1.5`}>
                        <verdictInfo.icon className="w-4 h-4" />
                        <span className="text-xs font-bold tracking-wide uppercase">
                          {verdictInfo.label}
                        </span>
                      </div>

                      {msg.confidence && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800/70 text-[11px] text-slate-300 border border-slate-700/50">
                          <Scale className="w-3 h-3 text-cyan-400" />
                          <span>Confidence:</span>
                          <span className="font-bold text-white">{Math.round(msg.confidence * 100)}%</span>
                          <span className={`text-[10px] font-extrabold uppercase px-1 rounded ${
                            msg.confidenceLevel === 'HIGH' ? 'text-emerald-400 bg-emerald-500/10' :
                            msg.confidenceLevel === 'MEDIUM' ? 'text-amber-400 bg-amber-500/10' :
                            'text-rose-400 bg-rose-500/10'
                          }`}>
                            {msg.confidenceLevel || 'HIGH'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons: Copy & Save to Notes */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleCopyAnswer(msg.answer, index)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-md hover:bg-slate-800/80 border border-transparent hover:border-slate-700 transition"
                        title="Copy answer"
                      >
                        {copiedIndex === index ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>

                      {msg.id !== 'welcome' && (
                        <button
                          onClick={() => handleSaveToNotes(msg, index)}
                          disabled={savingNoteIndex === index}
                          className="flex items-center gap-1 text-xs text-indigo-300 hover:text-white px-2.5 py-1 rounded-md bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 transition disabled:opacity-50"
                          title="Save this analysis into application notes in MongoDB"
                        >
                          {savingNoteIndex === index ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : noteSavedIndex === index ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Saved to Notes</span>
                            </>
                          ) : (
                            <>
                              <BookmarkPlus className="w-3.5 h-3.5" />
                              <span>Save to Officer Notes</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Calculated FOIR & Financial Quick Cards (if returned) */}
                  {msg.financialMetrics && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2">
                      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Estimated Monthly EMI</span>
                        <span className="text-sm font-bold text-white">{formatINR(msg.financialMetrics.proposedEmi)}</span>
                        <span className="text-[10px] text-slate-500 block">@ {msg.financialMetrics.interestRateAnnualPct}% p.a.</span>
                      </div>

                      <div className={`p-2.5 rounded-xl border ${
                        msg.financialMetrics.isFoirCompliant
                          ? 'bg-emerald-950/30 border-emerald-500/30 text-emerald-300'
                          : 'bg-rose-950/30 border-rose-500/30 text-rose-300'
                      }`}>
                        <span className="text-[10px] uppercase tracking-wider block opacity-80">Calculated FOIR</span>
                        <span className="text-sm font-bold">{msg.financialMetrics.calculatedFoirPct}%</span>
                        <span className="text-[10px] block opacity-80">Max Cap: {msg.financialMetrics.maxPermissibleFoirPct}%</span>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Max Eligible Loan</span>
                        <span className="text-sm font-bold text-cyan-400">{formatINR(msg.financialMetrics.maxEligibleAmount)}</span>
                        <span className="text-[10px] text-slate-500 block">under FOIR limits</span>
                      </div>

                      <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl">
                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Existing Monthly EMIs</span>
                        <span className="text-sm font-bold text-slate-200">{formatINR(msg.financialMetrics.existingMonthlyEmis)}</span>
                        <span className="text-[10px] text-slate-500 block">from statement</span>
                      </div>
                    </div>
                  )}

                  {/* Main Answer Content (Markdown styled) */}
                  <div className="text-sm text-slate-200 leading-relaxed prose prose-invert max-w-none prose-headings:text-slate-100 prose-headings:font-bold prose-p:my-2 prose-ul:my-2 prose-li:my-0.5">
                    {msg.answer.split('\n').map((line, idx) => {
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-base font-bold text-white mt-3 mb-1">{line.replace('### ', '')}</h3>;
                      }
                      if (line.startsWith('#### ')) {
                        return <h4 key={idx} className="text-sm font-semibold text-indigo-300 mt-2 mb-1">{line.replace('#### ', '')}</h4>;
                      }
                      if (line.startsWith('- ')) {
                        return (
                          <li key={idx} className="text-slate-300 text-xs ml-4 list-disc">
                            <span dangerouslySetInnerHTML={{ __html: renderInlineMarkdown(line.replace('- ', '')) }} />
                          </li>
                        );
                      }
                      if (line.trim() === '') return <div key={idx} className="h-1" />;
                      return (
                        <p key={idx} className="text-xs text-slate-300 my-1" dangerouslySetInnerHTML={{
                          __html: renderInlineMarkdown(line)
                        }} />
                      );
                    })}
                  </div>

                  {/* Missing Information Notice */}
                  {msg.missingInformation && msg.missingInformation.length > 0 && (
                    <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-bold text-amber-300 block">Information or Documents Missing for Final Approval:</span>
                        <ul className="text-xs text-amber-200/90 list-disc list-inside mt-1 space-y-0.5">
                          {msg.missingInformation.map((item, mIdx) => (
                            <li key={mIdx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* ── Dual Evidence Tabs (Applicant Facts vs. Bank Policy Rules) ── */}
                  <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden mt-3">
                    <div className="flex border-b border-slate-800 bg-slate-950/60">
                      <button
                        onClick={() => setActiveEvidenceTab((prev) => ({ ...prev, [index]: 'applicant' }))}
                        className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          currentTab === 'applicant'
                            ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Applicant Evidence ({msg.applicantDataSources?.length || 0})</span>
                      </button>

                      <button
                        onClick={() => setActiveEvidenceTab((prev) => ({ ...prev, [index]: 'policy' }))}
                        className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          currentTab === 'policy'
                            ? 'text-indigo-400 border-b-2 border-indigo-400 bg-indigo-500/10'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <Building className="w-3.5 h-3.5" />
                        <span>Retrieved Bank Policies ({msg.policySources?.length || 0})</span>
                      </button>

                      {msg.reasoning && msg.reasoning.length > 0 && (
                        <button
                          onClick={() => setActiveEvidenceTab((prev) => ({ ...prev, [index]: 'reasoning' }))}
                          className={`flex-1 py-2 px-3 text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                            currentTab === 'reasoning'
                              ? 'text-violet-400 border-b-2 border-violet-400 bg-violet-500/10'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          <Brain className="w-3.5 h-3.5" />
                          <span>Underwriting Logic ({msg.reasoning.length})</span>
                        </button>
                      )}
                    </div>

                    {/* Tab Body: Applicant Evidence */}
                    {currentTab === 'applicant' && (
                      <div className="p-3">
                        {msg.applicantDataSources && msg.applicantDataSources.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {msg.applicantDataSources.map((item, dIdx) => (
                              <div
                                key={dIdx}
                                className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex items-start justify-between gap-2"
                              >
                                <div>
                                  <span className="text-[11px] text-slate-400 block">{item.label}</span>
                                  <span className="text-xs font-bold text-white">{item.value}</span>
                                  <span className="text-[10px] text-slate-500 block mt-0.5">
                                    Source: {item.sourceDocument || 'Document'}
                                  </span>
                                </div>
                                {item.verified ? (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    Verified
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Declared
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic text-center py-2">
                            No individual document facts cited.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tab Body: Retrieved Bank Policies */}
                    {currentTab === 'policy' && (
                      <div className="p-3 space-y-2">
                        {msg.policySources && msg.policySources.length > 0 ? (
                          msg.policySources.map((policy, pIdx) => (
                            <div
                              key={pIdx}
                              className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 flex flex-col gap-1.5"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <Building className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="text-xs font-bold text-indigo-300">
                                    {policy.policyName}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    • {policy.section}
                                  </span>
                                </div>
                                {policy.similarityScore && (
                                  <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                    {Math.round(policy.similarityScore * 100)}% Match
                                  </span>
                                )}
                              </div>

                              <p className="text-xs text-slate-300 leading-snug">
                                {policy.ruleSummary || policy.rules?.[0] || 'Standard eligibility policy rule.'}
                              </p>

                              {policy.citationUrl && (
                                <a
                                  href={policy.citationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 underline underline-offset-2 mt-0.5"
                                >
                                  <span>Official Bank Policy Reference</span>
                                  <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-slate-500 italic text-center py-2">
                            General policy guidelines applied.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Tab Body: Step-by-Step Reasoning Logic */}
                    {currentTab === 'reasoning' && msg.reasoning && (
                      <div className="p-3 space-y-1.5">
                        {msg.reasoning.map((step, sIdx) => (
                          <div key={sIdx} className="flex items-start gap-2 text-xs text-slate-300">
                            <span className="w-4 h-4 rounded-full bg-violet-600/30 border border-violet-500/40 text-violet-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                              {sIdx + 1}
                            </span>
                            <span>{step}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Contextual Suggested Follow-up Inquiries */}
                  {msg.suggestedFollowups && msg.suggestedFollowups.length > 0 && (
                    <div className="pt-2">
                      <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                        Suggested Follow-ups:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {msg.suggestedFollowups.map((followup, fIdx) => (
                          <button
                            key={fIdx}
                            onClick={() => handleSendMessage(followup)}
                            disabled={loading}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-indigo-600/30 text-slate-300 hover:text-white border border-slate-700/60 transition disabled:opacity-50"
                          >
                            💬 {followup}
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

        {/* Loading Bubble */}
        {loading && (
          <div className="flex items-start gap-3 w-full max-w-md">
            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold animate-pulse">
              <Brain className="w-4 h-4 text-cyan-300 animate-spin" />
            </div>
            <div className="bg-slate-950/80 border border-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm shadow-md text-xs text-slate-300 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
              <span>Retrieving applicant facts & querying policy vector store...</span>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input Box ── */}
      <div className="p-4 bg-slate-950/90 border-t border-slate-800/80">
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
              placeholder="Ask loan assistant (e.g., 'Is this applicant eligible for ₹15L?', 'Why flagged?', 'Which policy rule?')..."
              disabled={loading}
              className="w-full bg-slate-900/90 border border-slate-700/70 focus:border-indigo-500 text-white text-xs sm:text-sm rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-slate-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={!inputQuery.trim() || loading}
            className="px-4 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition active:scale-95 shrink-0"
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
        <p className="text-[10px] text-slate-500 mt-1.5 text-center">
          LoanSight AI grounds every response with explicit applicant records and bank policies without fabricating missing data.
        </p>
      </div>

      {/* ── Bank Policies Catalogue Modal ── */}
      {policiesModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Bank Lending Policies Knowledge Base</h3>
              </div>
              <button
                onClick={() => setPoliciesModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  value={policySearchQuery}
                  onChange={(e) => setPolicySearchQuery(e.target.value)}
                  placeholder="Filter policies by name, category, income, age, FOIR, tenure..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {policiesLoading ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400 mb-2" />
                  <span className="text-xs">Loading bank policies vector index...</span>
                </div>
              ) : filteredPolicies.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No policy rules found matching your search.
                </div>
              ) : (
                filteredPolicies.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-4 space-y-2.5 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-indigo-300 block">{p.policyName}</span>
                        <span className="text-[11px] text-slate-400 font-medium">{p.section}</span>
                      </div>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {p.category}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-slate-300 block">Eligibility Rules:</span>
                      <ul className="text-xs text-slate-300 list-disc list-inside space-y-0.5">
                        {p.rules?.map((rule, rIdx) => (
                          <li key={rIdx}>{rule}</li>
                        ))}
                      </ul>
                    </div>

                    {p.keyRequirements && p.keyRequirements.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[11px] font-semibold text-slate-400 block">Key Requirements:</span>
                        <ul className="text-xs text-slate-400 list-disc list-inside space-y-0.5">
                          {p.keyRequirements.map((req, reqIdx) => (
                            <li key={reqIdx}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {p.citationUrl && (
                      <a
                        href={p.citationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 underline pt-1"
                      >
                        <span>Official Source Link</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end">
              <button
                onClick={() => setPoliciesModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-xl transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
