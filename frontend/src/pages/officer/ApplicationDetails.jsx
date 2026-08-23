import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, FileText, Briefcase, Download, Clock,
  CheckCircle2, XCircle, MessageSquare, Activity as ActivityIcon,
  Send, AlertTriangle, Eye, Brain, RefreshCw, ChevronDown,
  ChevronUp, Sparkles, Loader2, Zap, Trash2, ExternalLink
} from 'lucide-react';
import Card from '../../components/common/Card';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import VerificationTab from '../../components/officer/VerificationTab';
import LoanAssistantChat from '../../components/officer/LoanAssistantChat';
import OfficerStatusActionHub from '../../components/officer/OfficerStatusActionHub';
import { officerService } from '../../services/officerService';
import { getDocumentRequirements } from '../../constants/mockData';
import { useToast } from '../../context/ToastContext';
import { useConfirm } from '../../context/ConfirmContext';
import { ROUTES } from '../../constants/routes';

function formatAmount(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatShortDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const TAB_OPTIONS = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'verification', label: 'Verification', icon: CheckCircle2 },
  { key: 'assistant', label: 'AI Loan Assistant', icon: Sparkles, badge: 'Hybrid RAG' },
  { key: 'notes', label: 'Notes & Activity', icon: MessageSquare },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'documents_pending', label: 'Documents Pending' },
  { value: 'documents_required', label: 'Documents Required' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export default function ApplicationDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [app, setApp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [updating, setUpdating] = useState(false);

  // Notes state
  const [notes, setNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Activity state
  const [activity, setActivity] = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Document review modal
  const [reviewModal, setReviewModal] = useState(null); // { docId, action }
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Status-change reason modal (approve / reject require an officer reason)
  const [statusReasonModal, setStatusReasonModal] = useState(null); // { status }
  const [statusReason, setStatusReason] = useState('');

  // Document preview modal
  const [previewModal, setPreviewModal] = useState(null); // { docId, filename, url, mimetype, loading }

  useEffect(() => {
    const fetchApp = async () => {
      try {
        const response = await officerService.getApplicationById(id);
        setApp(response.data);
      } catch (error) {
        console.error('Failed to fetch application', error);
      } finally {
        setLoading(false);
      }
    };
    fetchApp();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'notes' && notes.length === 0 && !notesLoading) {
      fetchNotes();
      fetchActivity();
    }
  }, [activeTab]);

  const fetchNotes = async () => {
    try {
      setNotesLoading(true);
      const response = await officerService.getNotes(id);
      setNotes(response.data);
    } catch (err) {
      console.error('Failed to fetch notes', err);
    } finally {
      setNotesLoading(false);
    }
  };

  const fetchActivity = async () => {
    try {
      setActivityLoading(true);
      const response = await officerService.getActivity(id);
      setActivity(response.data);
    } catch (err) {
      console.error('Failed to fetch activity', err);
    } finally {
      setActivityLoading(false);
    }
  };

  const performStatusChange = async (newStatus, reason) => {
    const previousStatus = app?.status;
    try {
      setUpdating(true);
      const response = await officerService.updateApplicationStatus(id, newStatus, reason);
      setApp(prev => ({ ...prev, ...response.data }));
      const label = STATUS_OPTIONS.find(o => o.value === newStatus)?.label || newStatus;
      toast.success(`Status set to ${label}.`);
      // Refresh activity if on that tab
      if (activeTab === 'notes') fetchActivity();
      setStatusReasonModal(null);
      setStatusReason('');
    } catch (error) {
      // Keep the select in sync with the server: the change never landed.
      setApp(prev => (prev ? { ...prev, status: previousStatus } : prev));
      toast.error(error.message, { title: 'Could not update status' });
    } finally {
      setUpdating(false);
    }
  };

  const handleStatusChange = (newStatus) => {
    // Approving or rejecting is a material credit decision — the backend now
    // requires a reason, so collect one before calling the API. Other status
    // transitions proceed directly.
    if (newStatus === 'approved' || newStatus === 'rejected') {
      setStatusReason('');
      setStatusReasonModal({ status: newStatus });
      return;
    }
    performStatusChange(newStatus);
  };

  const submitStatusReason = () => {
    if (!statusReasonModal || !statusReason.trim()) return;
    performStatusChange(statusReasonModal.status, statusReason.trim());
  };

  const handleDeleteApplication = async () => {
    const ok = await confirm({
      title: 'Archive this application?',
      message:
        'The application will be removed from the active queue. Its documents, notes and full activity history are preserved for audit, and it can be restored later.',
      detail: `${app?.applicant?.name || 'Unknown applicant'} · ${id}`,
      confirmLabel: 'Archive application',
      tone: 'danger',
    });
    if (!ok) return;

    try {
      setUpdating(true);
      await officerService.deleteApplication(id);
      toast.success('Application archived.');
      navigate(ROUTES.OFFICER_APPLICATIONS);
    } catch (error) {
      toast.error(error.message, { title: 'Archive failed' });
      setUpdating(false);
    }
  };

  const handleDownload = async (docId, filename) => {
    try {
      const responseData = await officerService.downloadDocument(docId);
      const blob = responseData instanceof Blob ? responseData : new Blob([responseData]);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(error.message || 'The file could not be downloaded.', {
        title: 'Download failed',
      });
    }
  };

  const handleView = async (docId, filename, mimetype) => {
    try {
      setPreviewModal({ docId, filename, url: null, mimetype, loading: true });
      const responseData = await officerService.viewDocument(docId);
      
      // Ensure we have a valid Blob with explicit mimetype
      let blob;
      if (responseData instanceof Blob) {
        blob = responseData.type ? responseData : new Blob([responseData], { type: mimetype || 'application/pdf' });
      } else {
        blob = new Blob([responseData], { type: mimetype || 'application/pdf' });
      }
      
      const url = window.URL.createObjectURL(blob);
      setPreviewModal({ docId, filename, url, mimetype: blob.type || mimetype, loading: false });
    } catch (error) {
      console.error('Document preview error:', error);
      toast.error(error.message || 'The file could not be opened.', {
        title: 'Preview unavailable',
      });
      setPreviewModal(null);
    }
  };

  const handleDocumentReview = async (docId, status) => {
    if (status === 'rejected') {
      setReviewModal({ docId, action: 'rejected' });
      return;
    }
    try {
      setReviewSubmitting(true);
      const response = await officerService.reviewDocument(docId, status, null);
      // Update the document in local state
      setApp(prev => ({
        ...prev,
        documents: prev.documents.map(d => d._id === docId ? response.data : d),
      }));
      toast.success('Document approved.');
      if (activeTab === 'notes') fetchActivity();
    } catch (error) {
      toast.error(error.message, { title: 'Could not review document' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const submitRejectReview = async () => {
    if (!reviewComment.trim()) return;
    try {
      setReviewSubmitting(true);
      const response = await officerService.reviewDocument(reviewModal.docId, 'rejected', reviewComment.trim());
      setApp(prev => ({
        ...prev,
        documents: prev.documents.map(d => d._id === reviewModal.docId ? response.data : d),
      }));
      setReviewModal(null);
      setReviewComment('');
      toast.warning('Document rejected. The applicant has been asked to re-upload.');
      if (activeTab === 'notes') fetchActivity();
    } catch (error) {
      toast.error(error.message, { title: 'Could not reject document' });
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    try {
      setAddingNote(true);
      const response = await officerService.addNote(id, noteText.trim());
      setNotes([response.data, ...notes]);
      setNoteText('');
      fetchActivity();
    } catch (error) {
      toast.error(error.message, { title: 'Could not add note' });
    } finally {
      setAddingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6 max-w-5xl mx-auto">
        <div className="h-8 bg-cream-300 rounded w-1/3"></div>
        <div className="h-64 bg-cream-300 rounded-lg"></div>
      </div>
    );
  }

  if (!app) {
    return <div className="p-8 text-center text-charcoal-500">Application not found.</div>;
  }

  const requiredDocs = getDocumentRequirements(app.loanType);
  const uploadedDocTypes = app.documents.map(d => d.documentType);
  const missingDocs = requiredDocs.filter(r => !uploadedDocTypes.includes(r.type));

  return (
    <div className="animate-fade-in max-w-6xl mx-auto space-y-6">
      {/* Back Link */}
      <Link to="/officer/applications" className="inline-flex items-center text-sm font-medium text-charcoal-500 hover:text-charcoal-900 mb-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Back to Applications
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-charcoal-900">Application #{app._id.slice(-6)}</h1>
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 uppercase tracking-wide flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
              {app.bankName || 'HDFC Bank'}
            </span>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-cream-200 text-charcoal-700 capitalize">
              {app.loanType} Loan
            </span>
          </div>
          <p className="text-sm text-charcoal-500">
            {app.applicant?.name} • Created {formatShortDate(app.createdAt)}
          </p>
        </div>
        <OfficerStatusActionHub
          currentStatus={app.status}
          onStatusChange={handleStatusChange}
          onDelete={handleDeleteApplication}
          updating={updating}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-cream-300">
        <div className="flex gap-1">
          {TAB_OPTIONS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${isActive
                    ? 'border-charcoal-900 text-charcoal-900 font-semibold'
                    : 'border-transparent text-charcoal-500 hover:text-charcoal-700 hover:border-cream-400'
                  }
                `}
              >
                <Icon className={`w-4 h-4 ${tab.key === 'assistant' ? 'text-indigo-600 animate-pulse' : ''}`} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <OverviewTab app={app} formatAmount={formatAmount} formatDate={formatDate} />
        )}
        {activeTab === 'documents' && (
          <DocumentsTab
            app={app}
            requiredDocs={requiredDocs}
            missingDocs={missingDocs}
            onDownload={handleDownload}
            onView={handleView}
            onReview={handleDocumentReview}
            reviewSubmitting={reviewSubmitting}
          />
        )}
        {activeTab === 'verification' && (
          <VerificationTab applicationId={app._id} app={app} documents={app?.documents} />
        )}
        {activeTab === 'assistant' && (
          <LoanAssistantChat
            application={app}
            onNoteAdded={() => {
              fetchNotes();
              fetchActivity();
            }}
          />
        )}
        {activeTab === 'notes' && (
          <NotesActivityTab
            notes={notes}
            notesLoading={notesLoading}
            activity={activity}
            activityLoading={activityLoading}
            noteText={noteText}
            setNoteText={setNoteText}
            addingNote={addingNote}
            onAddNote={handleAddNote}
            formatDate={formatDate}
          />
        )}
      </div>

      {/* Reject Comment Modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-charcoal-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-error-100 flex items-center justify-center">
                <XCircle className="w-5 h-5 text-error-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-charcoal-900">Reject Document</h3>
                <p className="text-xs text-charcoal-500">The applicant will see this reason.</p>
              </div>
            </div>
            <textarea
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Explain why this document needs to be re-uploaded..."
              rows={4}
              className="w-full border border-cream-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => { setReviewModal(null); setReviewComment(''); }}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitRejectReview}
                loading={reviewSubmitting}
                disabled={!reviewComment.trim()}
                className="bg-error-600 hover:bg-error-700"
              >
                Reject Document
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Status Change Reason Modal (Approve / Reject) */}
      {statusReasonModal && (
        <div className="fixed inset-0 bg-charcoal-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-6 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${statusReasonModal.status === 'approved' ? 'bg-emerald-100' : 'bg-error-100'}`}>
                {statusReasonModal.status === 'approved'
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  : <XCircle className="w-5 h-5 text-error-600" />}
              </div>
              <div>
                <h3 className="text-base font-semibold text-charcoal-900">
                  {statusReasonModal.status === 'approved' ? 'Approve Loan Application' : 'Reject Loan Application'}
                </h3>
                <p className="text-xs text-charcoal-500">A reason is required and recorded in the audit trail.</p>
              </div>
            </div>
            <textarea
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder={statusReasonModal.status === 'approved'
                ? 'Record the basis for approval (eligibility met, verification notes, conditions)...'
                : 'Record the reason for rejection (policy failed, documents inconsistent)...'}
              rows={4}
              className="w-full border border-cream-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="ghost" size="sm" onClick={() => { setStatusReasonModal(null); setStatusReason(''); }}>Cancel</Button>
              <Button
                variant="primary"
                size="sm"
                onClick={submitStatusReason}
                loading={updating}
                disabled={!statusReason.trim()}
                className={statusReasonModal.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-error-600 hover:bg-error-700'}
              >
                {statusReasonModal.status === 'approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Document Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-charcoal-900/70 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="w-full max-w-5xl h-[88vh] flex flex-col p-6 overflow-hidden shadow-2xl border-cream-300">
            <div className="flex items-center justify-between pb-4 border-b border-cream-300">
              <h3 className="text-base font-bold text-charcoal-900 flex items-center gap-2">
                <Eye className="w-5 h-5 text-accent-600" />
                {previewModal.filename}
              </h3>
              <div className="flex items-center gap-3">
                {previewModal.url && (
                  <a
                    href={previewModal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-accent-600 hover:text-accent-700 bg-accent-50 px-3 py-1.5 rounded-lg transition-colors border border-accent-200"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open Fullscreen
                  </a>
                )}
                <button
                  onClick={() => {
                    if (previewModal.url) window.URL.revokeObjectURL(previewModal.url);
                    setPreviewModal(null);
                  }}
                  className="text-charcoal-500 hover:text-charcoal-900 text-sm font-semibold px-3 py-1.5 bg-cream-100 hover:bg-cream-200 rounded-lg transition-colors"
                >
                  ✕ Close
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden py-4 flex items-center justify-center bg-charcoal-950/5 rounded-lg mt-3">
              {previewModal.loading ? (
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-accent-600 mx-auto mb-2" />
                  <p className="text-sm font-medium text-charcoal-600">Loading document preview...</p>
                </div>
              ) : previewModal.mimetype?.includes('pdf') || previewModal.filename?.toLowerCase().endsWith('.pdf') ? (
                <object
                  data={previewModal.url}
                  type="application/pdf"
                  className="w-full h-full rounded-lg"
                >
                  <embed src={previewModal.url} type="application/pdf" className="w-full h-full rounded-lg" />
                  <div className="p-8 text-center bg-white rounded-lg">
                    <p className="text-sm text-charcoal-600 mb-3">Unable to embed PDF viewer directly in browser.</p>
                    <a
                      href={previewModal.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-accent-600 text-white text-sm font-medium rounded-lg hover:bg-accent-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" /> Open PDF in New Tab
                    </a>
                  </div>
                </object>
              ) : (
                <img
                  src={previewModal.url}
                  alt={previewModal.filename}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-sm"
                />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/* ===================== Overview Tab ===================== */
function OverviewTab({ app, formatAmount, formatDate }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card className="p-5 border-t-4 border-t-accent-500">
        <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2 mb-5">
          <User className="w-4 h-4 text-charcoal-400" /> Applicant Information
        </h3>
        <div className="space-y-4">
          <InfoRow label="Full Name" value={app.applicant?.name} />
          <InfoRow label="Email Address" value={app.applicant?.email} />
          <InfoRow label="Role" value={app.applicant?.role} capitalize />
        </div>
      </Card>

      <Card className="p-5 border-t-4 border-t-indigo-600">
        <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2 mb-5">
          <Briefcase className="w-4 h-4 text-indigo-600" /> Lending Partner & Loan Details
        </h3>
        <div className="space-y-4">
          <InfoRow label="Lending Partner / Bank" value={app.bankName || 'HDFC Bank'} />
          <InfoRow label="Loan Type" value={`${app.loanType} Loan`} capitalize />
          <InfoRow label="Requested Amount" value={formatAmount(app.requestedAmount)} />
          <InfoRow label="Preferred Tenure" value={`${app.tenureMonths} months`} />
          <div className="border-t border-cream-200 pt-3">
            <InfoRow label="Employment Type" value={app.employmentType?.replace('-', ' ')} capitalize />
            <div className="mt-3">
              <InfoRow label="Declared Monthly Income" value={formatAmount(app.declaredMonthlyIncome)} />
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 md:col-span-2">
        <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-charcoal-400" /> Application Timeline
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <InfoRow label="Created" value={formatDate(app.createdAt)} />
          <InfoRow label="Last Updated" value={formatDate(app.updatedAt)} />
          <InfoRow label="Documents" value={`${app.documents.length} uploaded`} />
          <InfoRow label="Current Status" value={<StatusBadge status={app.status} />} />
        </div>
      </Card>
    </div>
  );
}

function InfoRow({ label, value, capitalize }) {
  return (
    <div>
      <p className="text-xs text-charcoal-400 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-medium text-charcoal-900 mt-0.5 ${capitalize ? 'capitalize' : ''}`}>
        {value || '—'}
      </p>
    </div>
  );
}

/* ===================== Documents Tab ===================== */
function DocumentsTab({ app, requiredDocs, missingDocs, onDownload, onView, onReview, reviewSubmitting }) {
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [aiData, setAiData] = useState({}); // { docId: { loading, data, error } }
  const [reprocessing, setReprocessing] = useState({});

  const fetchAiAnalysis = useCallback(async (docId) => {
    if (aiData[docId]?.data) return; // Already loaded
    setAiData(prev => ({ ...prev, [docId]: { loading: true, data: null, error: null } }));
    try {
      const response = await officerService.getDocumentAnalysis(docId);
      setAiData(prev => ({ ...prev, [docId]: { loading: false, data: response.data, error: null } }));
    } catch (err) {
      setAiData(prev => ({ ...prev, [docId]: { loading: false, data: null, error: err.message } }));
    }
  }, [aiData]);

  const handleToggleAi = (docId) => {
    if (expandedDoc === docId) {
      setExpandedDoc(null);
    } else {
      setExpandedDoc(docId);
      fetchAiAnalysis(docId);
    }
  };

  const handleReprocess = async (docId) => {
    setReprocessing(prev => ({ ...prev, [docId]: true }));
    try {
      await officerService.reprocessDocument(docId);
      // Clear cached data and refetch after a short delay
      setAiData(prev => ({ ...prev, [docId]: { loading: true, data: null, error: null } }));
      setTimeout(() => fetchAiAnalysis(docId), 3000);
    } catch (err) {
      alert('Reprocessing failed: ' + err.message);
    } finally {
      setReprocessing(prev => ({ ...prev, [docId]: false }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Uploaded Documents */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-charcoal-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-600" /> Uploaded Documents
          </h3>
          <span className="text-xs font-medium bg-cream-200 text-charcoal-600 px-2.5 py-1 rounded-full">
            {app.documents.length} files
          </span>
        </div>

        {app.documents.length > 0 ? (
          <div className="space-y-3">
            {app.documents.map((doc) => {
              const isExpanded = expandedDoc === doc._id;
              const ai = aiData[doc._id];
              const aiStatus = doc.aiProcessing?.status || ai?.data?.aiProcessing?.status || 'pending';

              return (
                <div key={doc._id} className="bg-cream-50 border border-cream-300 rounded-lg hover:border-cream-400 transition-colors overflow-hidden">
                  {/* Document row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                        doc.status === 'approved' ? 'bg-success-100 text-success-600' :
                        doc.status === 'rejected' ? 'bg-error-100 text-error-600' :
                        'bg-accent-100 text-accent-600'
                      }`}>
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-charcoal-900">{doc.originalName}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-xs text-charcoal-500 capitalize">{doc.documentType.replace(/_/g, ' ')}</span>
                          <span className="text-xs text-charcoal-300">•</span>
                          <span className="text-xs text-charcoal-500">{(doc.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span className="text-xs text-charcoal-300">•</span>
                          <span className="text-xs text-charcoal-500">{new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          {/* AI status mini badge */}
                          <AiStatusMini status={aiStatus} />
                        </div>
                        {doc.status === 'rejected' && doc.reviewComment && (
                          <p className="text-xs text-error-600 mt-1.5 flex items-start gap-1">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            {doc.reviewComment}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === 'approved' && (
                        <span className="text-xs font-medium text-success-600 bg-success-50 px-2 py-1 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Approved
                        </span>
                      )}
                      {doc.status === 'rejected' && (
                        <span className="text-xs font-medium text-error-600 bg-error-50 px-2 py-1 rounded-full flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> Rejected
                        </span>
                      )}
                      {doc.status === 'pending_review' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => onReview(doc._id, 'approved')} disabled={reviewSubmitting} className="text-success-600 hover:bg-success-50">
                            <CheckCircle2 className="w-4 h-4 mr-1" /> Approve
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => onReview(doc._id, 'rejected')} disabled={reviewSubmitting} className="text-error-600 hover:bg-error-50">
                            <XCircle className="w-4 h-4 mr-1" /> Reject
                          </Button>
                        </>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => onView(doc._id, doc.originalName, doc.mimetype)} title="View / Preview">
                        <Eye className="w-4 h-4 text-accent-600" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDownload(doc._id, doc.originalName)} title="Download">
                        <Download className="w-4 h-4" />
                      </Button>
                      {/* AI Analysis toggle */}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleAi(doc._id)}
                        className="text-ai-600 hover:bg-ai-50"
                      >
                        <Brain className="w-4 h-4 mr-1" />
                        AI
                        {isExpanded ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />}
                      </Button>
                    </div>
                  </div>

                  {/* AI Analysis Panel (expandable) */}
                  {isExpanded && (
                    <AiAnalysisPanel
                      doc={doc}
                      ai={ai}
                      reprocessing={reprocessing[doc._id]}
                      onReprocess={() => handleReprocess(doc._id)}
                      onRefresh={() => {
                        setAiData(prev => ({ ...prev, [doc._id]: undefined }));
                        fetchAiAnalysis(doc._id);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-cream-50 rounded-lg border border-dashed border-cream-300">
            <Clock className="w-8 h-8 text-charcoal-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-charcoal-900">No documents uploaded yet</p>
          </div>
        )}
      </Card>

      {/* Missing Documents */}
      {missingDocs.length > 0 && (
        <Card className="p-6 border-l-4 border-l-warning-500">
          <h3 className="text-sm font-semibold text-charcoal-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-warning-500" /> Missing Documents
          </h3>
          <div className="space-y-2">
            {missingDocs.map((doc) => (
              <div key={doc.type} className="flex items-center gap-3 p-3 bg-warning-50 rounded-lg">
                <div className="w-6 h-6 rounded-full bg-warning-100 flex items-center justify-center">
                  <AlertTriangle className="w-3 h-3 text-warning-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-charcoal-900">{doc.label}</p>
                  <p className="text-xs text-charcoal-500">{doc.description}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ===================== AI Mini Status Badge ===================== */
function AiStatusMini({ status }) {
  const config = {
    pending: { icon: Clock, label: 'AI Pending', className: 'text-charcoal-400 bg-cream-200' },
    processing: { icon: Loader2, label: 'AI Processing', className: 'text-ai-600 bg-ai-50 animate-ai-pulse' },
    completed: { icon: Sparkles, label: 'AI Done', className: 'text-ai-600 bg-ai-100' },
    failed: { icon: AlertTriangle, label: 'AI Failed', className: 'text-error-600 bg-error-50' },
  };
  const c = config[status] || config.pending;
  const Icon = c.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.className}`}>
      <Icon className={`w-2.5 h-2.5 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

/* ===================== AI Analysis Panel ===================== */
function AiAnalysisPanel({ doc, ai, reprocessing, onReprocess, onRefresh }) {
  const aiProcessing = ai?.data?.aiProcessing || doc.aiProcessing || {};
  const isLoading = ai?.loading;
  const error = ai?.error;
  const status = aiProcessing.status || 'pending';

  // Type label mapping
  const typeLabels = {
    PAN: 'PAN Card',
    AADHAAR: 'Aadhaar Card',
    SALARY_SLIP: 'Salary Slip',
    PAYMENT_SLIP: 'Payment Slip',
    BANK_STATEMENT: 'Bank Statement',
    FORM_16: 'Form 16',
    OTHER: 'Other Document',
    UNKNOWN: 'Unknown',
  };

  // Check if AI predicted type differs from user-selected type
  const userType = doc.documentType?.toUpperCase().replace(/ /g, '_');
  const aiType = aiProcessing.predictedType;
  const typeMismatch = aiType && userType && aiType !== userType &&
    aiType !== 'OTHER' && aiType !== 'UNKNOWN';

  return (
    <div className="border-t border-cream-300 bg-ai-50/40 p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-ai-700 flex items-center gap-2">
          <Brain className="w-4 h-4" /> AI Document Analysis
        </h4>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="text-xs text-charcoal-500 hover:text-charcoal-700 flex items-center gap-1 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button
            onClick={onReprocess}
            disabled={reprocessing}
            className="text-xs font-medium text-ai-600 hover:text-ai-700 bg-ai-100 hover:bg-ai-100/80 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            {reprocessing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            {reprocessing ? 'Reprocessing...' : 'Reprocess'}
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="animate-shimmer rounded-lg p-6 text-center">
          <Loader2 className="w-5 h-5 text-ai-500 animate-spin mx-auto mb-2" />
          <p className="text-xs text-ai-600">Loading AI analysis...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-error-50 border border-error-100 rounded-lg p-4 text-center">
          <AlertTriangle className="w-5 h-5 text-error-500 mx-auto mb-2" />
          <p className="text-xs text-error-600">{error}</p>
        </div>
      )}

      {/* Pending / Processing State */}
      {!isLoading && !error && (status === 'pending' || status === 'processing') && (
        <div className={`rounded-lg p-6 text-center border border-dashed ${status === 'processing' ? 'border-ai-400 bg-ai-50 animate-ai-pulse' : 'border-cream-300 bg-cream-50'}`}>
          {status === 'processing' ? (
            <>
              <Loader2 className="w-6 h-6 text-ai-500 animate-spin mx-auto mb-2" />
              <p className="text-sm font-medium text-ai-700">AI is processing this document...</p>
              <p className="text-xs text-ai-500 mt-1">Classification and extraction in progress</p>
            </>
          ) : (
            <>
              <Clock className="w-6 h-6 text-charcoal-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-charcoal-600">Awaiting AI processing</p>
              <p className="text-xs text-charcoal-400 mt-1">Processing will begin automatically</p>
            </>
          )}
        </div>
      )}

      {/* Failed State */}
      {!isLoading && !error && status === 'failed' && (
        <div className="bg-error-50 border border-error-100 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-error-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-error-700">Processing Failed</p>
              {aiProcessing.processingError && (
                <p className="text-xs text-error-600 mt-1">{aiProcessing.processingError}</p>
              )}
              <p className="text-xs text-charcoal-500 mt-2">Click "Reprocess" to try again.</p>
            </div>
          </div>
        </div>
      )}

      {/* Completed State */}
      {!isLoading && !error && status === 'completed' && (
        <div className="space-y-3">
          {/* Classification Result */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success-500" />
              <span className="text-sm font-semibold text-charcoal-900">
                {typeLabels[aiType] || aiType || 'Unknown'}
              </span>
            </div>
            {aiProcessing.confidence != null && (
              <ConfidenceBadge confidence={aiProcessing.confidence} />
            )}
            {aiProcessing.extractionMethod && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent-50 text-accent-700 text-xs font-semibold rounded-full border border-accent-200">
                {aiProcessing.extractionMethod === 'native' ? '📄 Native Text' : '🔍 OCR Extraction'}
              </span>
            )}
            {typeMismatch && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-warning-50 text-warning-600 text-xs font-medium rounded-full border border-warning-100">
                <AlertTriangle className="w-3 h-3" />
                User selected: {doc.documentType.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {/* Extracted Data */}
          {aiProcessing.extractedData && Object.keys(aiProcessing.extractedData).length > 0 && (
            <ExtractedDataTable data={aiProcessing.extractedData} documentType={aiType} />
          )}

          {/* Processed timestamp */}
          {aiProcessing.processedAt && (
            <p className="text-[10px] text-charcoal-400 mt-2">
              Processed {new Date(aiProcessing.processedAt).toLocaleString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ===================== Confidence Badge ===================== */
function ConfidenceBadge({ confidence }) {
  const pct = Math.round(confidence * 100);
  let color = 'text-success-600 bg-success-50 border-success-100';
  if (pct < 70) color = 'text-error-600 bg-error-50 border-error-100';
  else if (pct < 85) color = 'text-warning-600 bg-warning-50 border-warning-100';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full border ${color}`}>
      {pct}% confidence
    </span>
  );
}

/* ===================== Extracted Data Table ===================== */
function ExtractedDataTable({ data, documentType }) {
  // Format field labels nicely
  const formatLabel = (key) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Format values
  const formatValue = (key, value) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'number') {
      // Format as currency if it looks like a monetary amount
      const moneyFields = ['salary', 'amount', 'balance', 'deduction', 'income', 'tax', 'hra', 'pf', 'gross', 'net', 'credit', 'debit', 'exemption', 'refund'];
      const isMoneyField = moneyFields.some(f => key.toLowerCase().includes(f));
      if (isMoneyField) {
        return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);
      }
      return value.toLocaleString('en-IN');
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return '—';
      // Render arrays as a compact list
      return (
        <div className="space-y-1">
          {value.slice(0, 5).map((item, idx) => (
            <div key={idx} className="text-xs bg-cream-100 rounded px-2 py-1">
              {typeof item === 'object'
                ? Object.entries(item).filter(([, v]) => v != null).map(([k, v]) => (
                    <span key={k} className="mr-2">
                      <span className="text-charcoal-400">{formatLabel(k)}:</span>{' '}
                      <span className="font-medium">{typeof v === 'number' ? v.toLocaleString('en-IN') : String(v)}</span>
                    </span>
                  ))
                : String(item)
              }
            </div>
          ))}
          {value.length > 5 && (
            <p className="text-[10px] text-charcoal-400">+ {value.length - 5} more</p>
          )}
        </div>
      );
    }
    return String(value);
  };

  // Separate scalar fields from array/object fields
  const entries = Object.entries(data);
  const scalarEntries = entries.filter(([, v]) => !Array.isArray(v) && typeof v !== 'object');
  const arrayEntries = entries.filter(([, v]) => Array.isArray(v));

  return (
    <div className="bg-white border border-cream-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-cream-100 border-b border-cream-200">
        <h5 className="text-xs font-semibold text-charcoal-700 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3 text-ai-500" /> Extracted Information
        </h5>
      </div>
      <div className="divide-y divide-cream-100">
        {scalarEntries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between px-3 py-2 hover:bg-cream-50 transition-colors">
            <span className="text-xs text-charcoal-500 shrink-0 w-2/5">{formatLabel(key)}</span>
            <span className="text-xs font-medium text-charcoal-900 text-right">{formatValue(key, value)}</span>
          </div>
        ))}
      </div>
      {arrayEntries.length > 0 && (
        <div className="border-t border-cream-200">
          {arrayEntries.map(([key, value]) => (
            <div key={key} className="px-3 py-2">
              <p className="text-xs text-charcoal-500 mb-1.5">{formatLabel(key)}</p>
              {formatValue(key, value)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


/* ===================== Notes & Activity Tab ===================== */
function NotesActivityTab({ notes, notesLoading, activity, activityLoading, noteText, setNoteText, addingNote, onAddNote, formatDate }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Notes Panel */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-charcoal-900 flex items-center gap-2 mb-5">
          <MessageSquare className="w-5 h-5 text-accent-600" /> Internal Notes
        </h3>

        <form onSubmit={onAddNote} className="mb-6">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Add an internal note about this application..."
            rows={3}
            className="w-full border border-cream-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-accent-500 focus:border-accent-500 resize-none mb-3"
          />
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={addingNote} disabled={!noteText.trim()}>
              <Send className="w-4 h-4 mr-1.5" /> Add Note
            </Button>
          </div>
        </form>

        {notesLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-16 bg-cream-200 rounded-lg"></div>
            <div className="h-16 bg-cream-200 rounded-lg"></div>
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {notes.map((note) => (
              <div key={note._id} className="p-4 bg-cream-50 border border-cream-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-charcoal-700">{note.author?.name}</p>
                  <p className="text-xs text-charcoal-400">{formatDate(note.createdAt)}</p>
                </div>
                <p className="text-sm text-charcoal-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-charcoal-400 text-center py-6">No notes yet.</p>
        )}
      </Card>

      {/* Activity Timeline */}
      <Card className="p-6">
        <h3 className="text-base font-semibold text-charcoal-900 flex items-center gap-2 mb-5">
          <ActivityIcon className="w-5 h-5 text-accent-600" /> Activity Timeline
        </h3>

        {activityLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-12 bg-cream-200 rounded-lg"></div>
            <div className="h-12 bg-cream-200 rounded-lg"></div>
            <div className="h-12 bg-cream-200 rounded-lg"></div>
          </div>
        ) : activity.length > 0 ? (
          <div className="relative max-h-[500px] overflow-y-auto pr-1">
            <div className="absolute left-[11px] top-2 bottom-2 w-px bg-cream-300"></div>
            <div className="space-y-4">
              {activity.map((item) => (
                <div key={item._id} className="relative flex items-start gap-4 pl-8">
                  <div className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] shrink-0 ${
                    item.action.includes('Approved') ? 'bg-success-500' :
                    item.action.includes('Rejected') ? 'bg-error-500' :
                    item.action.includes('Status') ? 'bg-accent-500' :
                    item.action.includes('Note') ? 'bg-charcoal-400' :
                    'bg-cream-400'
                  }`}>
                    {item.action.includes('Approved') ? <CheckCircle2 className="w-3 h-3" /> :
                     item.action.includes('Rejected') ? <XCircle className="w-3 h-3" /> :
                     item.action.includes('Status') ? <Clock className="w-3 h-3" /> :
                     item.action.includes('Document') ? <FileText className="w-3 h-3" /> :
                     <ActivityIcon className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal-900">{item.action}</p>
                    {item.details && (
                      <p className="text-xs text-charcoal-500 mt-0.5">
                        {item.details.from && item.details.to && (
                          <span>{item.details.from.replace(/_/g, ' ')} → {item.details.to.replace(/_/g, ' ')}</span>
                        )}
                        {item.details.documentType && (
                          <span className="capitalize">{item.details.documentType.replace(/_/g, ' ')}</span>
                        )}
                        {item.details.reviewComment && (
                          <span className="block text-error-500 mt-0.5">"{item.details.reviewComment}"</span>
                        )}
                        {item.details.preview && (
                          <span className="italic">"{item.details.preview}"</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-charcoal-400 mt-1">
                      {item.actor?.name || 'System'} • {formatDate(item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-charcoal-400 text-center py-6">No activity recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
