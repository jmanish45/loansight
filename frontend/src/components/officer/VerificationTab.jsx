import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  FileText,
  Clock,
  ArrowRight,
  Loader2,
  BarChart3,
  Zap,
  User,
  Calendar,
  CreditCard,
  Phone,
  IndianRupee,
  Building2,
  Fingerprint,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import { useToast } from '../../context/ToastContext';

/* ───────── Utility Sub-Components ───────── */

const StatusIcon = ({ status, size = 'w-5 h-5' }) => {
  switch (status) {
    case 'PASSED':
      return <CheckCircle2 className={`${size} text-success-600 shrink-0`} />;
    case 'WARNING':
      return <AlertTriangle className={`${size} text-warning-500 shrink-0`} />;
    case 'FLAGGED':
      return <XCircle className={`${size} text-error-600 shrink-0`} />;
    default:
      return <Info className={`${size} text-charcoal-400 shrink-0`} />;
  }
};

const SeverityBadge = ({ severity }) => {
  const sev = (severity || 'LOW').toUpperCase();
  const styles = {
    HIGH: 'bg-error-50 text-error-700 border-error-200',
    MEDIUM: 'bg-warning-50 text-warning-700 border-warning-200',
    LOW: 'bg-success-50 text-success-700 border-success-200',
  };
  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase border tracking-wider ${
        styles[sev] || styles.LOW
      }`}
    >
      {sev} Severity
    </span>
  );
};

const RiskBadge = ({ riskLevel }) => {
  const risk = (riskLevel || 'LOW').toUpperCase();
  const styles = {
    HIGH: 'bg-error-100 text-error-700 border-error-200',
    MEDIUM: 'bg-warning-100 text-warning-700 border-warning-200',
    LOW: 'bg-success-100 text-success-700 border-success-200',
  };
  return (
    <span
      className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase border tracking-wider flex items-center gap-1.5 shadow-sm ${
        styles[risk] || styles.LOW
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      {risk} Risk
    </span>
  );
};

const ActionBadge = ({ action }) => {
  const labels = {
    APPROVE_RECOMMENDED: { label: 'Eligible for Standard Approval', color: 'bg-success-600 text-white' },
    MANUAL_REVIEW: { label: 'Manual Officer Review Recommended', color: 'bg-warning-600 text-white' },
    REQUEST_ADDITIONAL_DOCS: { label: 'Request Additional Documents', color: 'bg-accent-600 text-white' },
  };
  const item = labels[action] || { label: (action || 'Manual Review').replace(/_/g, ' '), color: 'bg-charcoal-800 text-white' };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-lg ${item.color} shadow-sm`}>
      {item.label}
    </span>
  );
};

/* ───────── Source Resolution Helper for Cards ───────── */

const resolveCheckSources = (check) => {
  if (check.sourceA?.values?.length && check.sourceB?.values?.length) {
    return { sourceA: check.sourceA, sourceB: check.sourceB };
  }

  const ev = check.evidence || {};

  switch (check.type) {
    case 'IDENTITY_NAME_MATCH': {
      const idVals = [];
      if (ev['PAN Card']) idVals.push(`PAN: ${ev['PAN Card']}`);
      if (ev['Aadhaar Card']) idVals.push(`Aadhaar: ${ev['Aadhaar Card']}`);
      if (ev['Declared Name'] && !idVals.length) idVals.push(`Declared: ${ev['Declared Name']}`);

      const finVals = [];
      if (ev['Salary Slip']) finVals.push(`Salary Slip: ${ev['Salary Slip']}`);
      if (ev['Bank Statement']) finVals.push(`Bank Statement: ${ev['Bank Statement']}`);

      return {
        sourceA: {
          label: 'PAN & Aadhaar',
          values: idVals.length ? idVals : ['PAN: Not Provided', 'Aadhaar: Not Provided'],
        },
        sourceB: {
          label: 'Salary Slip & Bank',
          values: finVals.length ? finVals : ['Salary Slip: Not Provided', 'Bank Statement: Not Provided'],
        },
      };
    }

    case 'DECLARED_VS_SLIP_INCOME': {
      const dec = ev['declared_monthly_income'] || 'Not provided';
      const net = ev['salary_slip_net'] || '';
      const gross = ev['salary_slip_gross'] || '';
      const srcA = [`Declared Income (Slip): ${dec}`];
      if (net && net !== 'N/A') srcA.push(`Salary Slip Net: ${net}`);
      else if (gross && gross !== 'N/A') srcA.push(`Salary Slip Gross: ${gross}`);

      const diff = ev['variance'] || '';
      const srcB = diff ? [`Variance: ${diff}`, `Status: ${check.status}`] : ['Reference: Salary Slip'];
      return {
        sourceA: { label: 'Declared Income (Slip)', values: srcA },
        sourceB: { label: 'Variance Analysis', values: srcB },
      };
    }

    case 'SLIP_VS_BANK_SALARY': {
      const avg = ev['bank_average_salary_credit'] || 'Not available';
      const net = ev['salary_slip_net'] || 'Not provided';
      const credits = ev['credits_found'] ?? '—';
      return {
        sourceA: {
          label: 'Expected (Salary Slip)',
          values: [`Declared Income (Slip): ${net}`, 'Expected: Regular Credits'],
        },
        sourceB: {
          label: 'Average Monthly Credit (Bank)',
          values: [`Avg Bank Credit: ${avg}`, `Credits Found: ${credits}`],
        },
      };
    }

    case 'DOB_CONSISTENCY': {
      const panDob = ev['PAN Card'] || ev['Declared Profile'] || '-';
      const aadhaarDob = ev['Aadhaar Card'] || (ev['Declared Profile'] && ev['PAN Card'] ? ev['Declared Profile'] : '-');
      return {
        sourceA: { label: 'PAN Card', values: [`Date of Birth: ${panDob}`] },
        sourceB: { label: 'Aadhaar / Declared', values: [`Date of Birth: ${aadhaarDob}`] },
      };
    }

    case 'PAN_CONSISTENCY': {
      const panVal = ev['PAN Card'] || '-';
      const slipPan = ev['Salary Slip'] || ev['Form 16'] || '-';
      return {
        // Show only the observed PAN values being compared. The match verdict is
        // the check's own computed status (rendered on the card) — we must NOT
        // assert "Valid"/"Matched" from mere value presence.
        sourceA: { label: 'PAN Card', values: [`PAN: ${panVal}`] },
        sourceB: { label: 'Cross-Reference (Salary Slip / Form 16)', values: [`PAN: ${slipPan}`] },
      };
    }

    case 'AADHAAR_VERIFICATION': {
      const aadhVal = ev['aadhaar_number'] || ev['Aadhaar Card'] || '-';
      return {
        // Only the number captured from the document is shown. No UIDAI/live
        // Aadhaar verification is performed, so we must NOT claim "Active" or
        // "Linked". The consistency verdict is the check's own status on the card.
        sourceA: { label: 'Aadhaar Card', values: [`Aadhaar: ${aadhVal}`] },
        sourceB: { label: 'Verification Basis', values: ['Number captured from document', 'No UIDAI/live verification performed'] },
      };
    }

    case 'EMPLOYER_CONSISTENCY': {
      const empA = ev['Salary Slip'] || 'Employer';
      const empB = ev['Form 16'] || 'Employer';
      return {
        sourceA: { label: 'Salary Slip', values: [`Employer: ${empA}`] },
        sourceB: { label: 'Form 16', values: [`Employer: ${empB}`] },
      };
    }

    case 'EXISTING_EMI_BURDEN': {
      const totalEmi = ev['detected_monthly_emi_total'] || '₹0';
      const dti = ev['existing_obligation_ratio'] || '0%';
      return {
        sourceA: { label: 'EMI Obligations', values: [`Total Monthly EMI: ${totalEmi}`] },
        sourceB: { label: 'Income Reference', values: [`DTI Ratio: ${dti}`] },
      };
    }

    default: {
      const keys = Object.keys(ev).filter(k => !k.includes('score'));
      if (keys.length >= 2) {
        const mid = Math.ceil(keys.length / 2);
        return {
          sourceA: { label: 'Source A', values: keys.slice(0, mid).map(k => `${k}: ${ev[k]}`) },
          sourceB: { label: 'Source B', values: keys.slice(mid).map(k => `${k}: ${ev[k]}`) },
        };
      }
      return {
        sourceA: { label: 'Verified Evidence', values: [check.message] },
        sourceB: { label: 'Outcome', values: [`Status: ${check.status}`] },
      };
    }
  }
};

/* ───────── Verification Score Circle ───────── */

const ScoreCircle = ({ score }) => {
  const numScore = score ?? 50;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (numScore / 100) * circumference;

  let colorClass, bgGlow, label;
  if (numScore >= 80) {
    colorClass = 'text-success-500';
    bgGlow = 'shadow-success-100';
    label = 'Consistent';
  } else if (numScore >= 60) {
    colorClass = 'text-warning-500';
    bgGlow = 'shadow-warning-100';
    label = 'Needs Attention';
  } else {
    colorClass = 'text-error-500';
    bgGlow = 'shadow-error-100';
    label = 'Needs Attention';
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 p-4 bg-white rounded-2xl border border-cream-200 shadow-sm ${bgGlow} min-w-[160px]`}>
      <p className="text-[10px] font-extrabold text-charcoal-500 uppercase tracking-wider text-center">Overall Verification Score</p>
      <div className="relative w-24 h-24 my-1">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#f1f0ed" strokeWidth="8" />
          <circle
            cx="50" cy="50" r="40"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-2xl font-black ${colorClass}`}>{numScore}</span>
          <span className="text-[9px] text-charcoal-400 font-semibold">/100</span>
        </div>
      </div>
      <span className={`text-xs font-bold ${colorClass}`}>{label}</span>
    </div>
  );
};

/* ───────── Stats Row ───────── */

const StatsRow = ({ checks, documentsCount = 0 }) => {
  if (!checks || checks.length === 0) return null;

  const total = checks.length;
  const passed = checks.filter(c => c.status === 'PASSED').length;
  const failed = checks.filter(c => c.status === 'FLAGGED').length;
  const warnings = checks.filter(c => c.status === 'WARNING').length;
  const discrepancies = failed + warnings;
  const passedPct = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  const failedPct = total > 0 ? ((discrepancies / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-accent-50 text-accent-600 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-black text-charcoal-900">{documentsCount}</p>
          <p className="text-[11px] text-charcoal-500 font-medium">of {documentsCount} uploaded</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-success-50 text-success-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-black text-charcoal-900">{total}</p>
          <p className="text-[11px] text-charcoal-500 font-medium">Total Checks</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-success-50 text-success-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-black text-success-600">{passed}</p>
          <p className="text-[11px] text-charcoal-500 font-medium">{passedPct}% Passed</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            discrepancies > 0 ? 'bg-error-50 text-error-600' : 'bg-cream-100 text-charcoal-400'
          }`}
        >
          <XCircle className="w-5 h-5" />
        </div>
        <div>
          <p
            className={`text-xl font-black ${
              discrepancies > 0 ? 'text-error-600' : 'text-charcoal-900'
            }`}
          >
            {discrepancies}
          </p>
          <p className="text-[11px] text-charcoal-500 font-medium">{failedPct}% Failed</p>
        </div>
      </div>
    </div>
  );
};

/* ───────── Extracted Data Overview Matrix Table ───────── */

const ExtractedDataTable = ({ checks, documents, app }) => {
  if (!checks || checks.length === 0) return null;

  // Extract from uploaded documents if available
  const findDocExtracted = (type) => {
    const doc = documents?.find(d => d.documentType?.toLowerCase() === type.toLowerCase());
    return doc?.aiProcessing?.extractedData || {};
  };

  const panDoc = findDocExtracted('pan');
  const aadhaarDoc = findDocExtracted('aadhaar');
  const salaryDoc = findDocExtracted('salary_slip') || findDocExtracted('payment_slip');
  const bankDoc = findDocExtracted('bank_statement');

  // Find corresponding checks and evidences
  const nameCheck = checks.find(c => c.type === 'IDENTITY_NAME_MATCH');
  const dobCheck = checks.find(c => c.type === 'DOB_CONSISTENCY');
  const panCheck = checks.find(c => c.type === 'PAN_CONSISTENCY');
  const aadhaarCheck = checks.find(c => c.type === 'AADHAAR_VERIFICATION');
  const incomeCheck = checks.find(c => c.type === 'DECLARED_VS_SLIP_INCOME');
  const bankSalaryCheck = checks.find(c => c.type === 'SLIP_VS_BANK_SALARY');

  const evName = nameCheck?.evidence || {};
  const evDob = dobCheck?.evidence || {};
  const evPan = panCheck?.evidence || {};
  const evAadhaar = aadhaarCheck?.evidence || {};
  const evInc = incomeCheck?.evidence || {};
  const evBank = bankSalaryCheck?.evidence || {};

  // 1. Full Name values (PAN & Aadhaar must reflect the registered applicant name for cross-checking)
  const registeredApplicantName = app?.applicant?.name || '-';
  const panName = panDoc.name || evName['PAN Card'] || evName['PAN'] || registeredApplicantName;
  const aadhaarName = aadhaarDoc.name || evName['Aadhaar Card'] || evName['AADHAAR'] || registeredApplicantName;
  const salaryName = salaryDoc.employee_name || evName['Salary Slip'] || evName['SALARY_SLIP'] || '-';
  const bankName = bankDoc.account_holder || evName['Bank Statement'] || evName['BANK_STATEMENT'] || '-';

  // Determine name consistency dynamically against registered applicant name
  const presentNames = [salaryName, bankName].filter(n => n && n !== '-');
  const hasMismatchWithFinancialDocs = registeredApplicantName !== '-' && presentNames.some(
    n => n.trim().toLowerCase() !== registeredApplicantName.trim().toLowerCase()
  );
  const isNameMismatch = hasMismatchWithFinancialDocs || nameCheck?.status === 'FLAGGED';

  // 2. Date of Birth values (shown on PAN & Aadhaar)
  const panDob = panDoc.date_of_birth || evDob['PAN Card'] || '-';
  const aadhaarDob = aadhaarDoc.date_of_birth || evDob['Aadhaar Card'] || '-';
  const isDobMismatch = dobCheck?.status === 'FLAGGED';

  // 3. PAN Number values
  const panNum = panDoc.pan_number || evPan['PAN Card'] || app?.applicant?.pan || '-';
  const salaryPan = salaryDoc.pan_number || evPan['Salary Slip'] || '-';
  const bankPan = bankDoc.pan_number || evPan['Bank Statement'] || '-';
  const isPanMismatch = panCheck?.status === 'FLAGGED';

  // 4. Aadhaar Number values
  const aadhaarNum = aadhaarDoc.aadhaar_number || evAadhaar['aadhaar_number'] || evAadhaar['Aadhaar Card'] || app?.applicant?.aadhaar || '-';

  // 5. Declared Monthly Income & Bank Credit values
  const rawSalary = salaryDoc.net_salary || salaryDoc.gross_salary || evInc['salary_slip_net'] || evInc['declared_monthly_income'] || app?.declaredMonthlyIncome;
  const formatSalary = typeof rawSalary === 'number' ? `₹${rawSalary.toLocaleString('en-IN')}` : rawSalary ? (String(rawSalary).startsWith('₹') ? rawSalary : `₹${rawSalary}`) : '-';
  const isIncomeMismatch = incomeCheck?.status === 'FLAGGED';

  let bankCreditStr = '-';
  if (evBank['bank_average_salary_credit']) {
    bankCreditStr = evBank['bank_average_salary_credit'];
  } else if (bankDoc.salary_credits?.length) {
    const avg = bankDoc.salary_credits.reduce((sum, c) => sum + (c.amount || 0), 0) / bankDoc.salary_credits.length;
    bankCreditStr = `₹${Math.round(avg).toLocaleString('en-IN')}`;
  } else if (evBank['salary_slip_net'] && bankSalaryCheck?.status === 'PASSED') {
    bankCreditStr = evBank['salary_slip_net'];
  }

  // Construct streamlined matrix rows (without unnecessary empty rows)
  const matrixRows = [
    {
      icon: User,
      type: 'Full Name',
      pan: panName,
      aadhaar: aadhaarName,
      salarySlip: salaryName,
      bankStatement: bankName,
      isMismatch: isNameMismatch,
      statusBadge: isNameMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: true,
      baseReference: registeredApplicantName,
    },
    {
      icon: Calendar,
      type: 'Date of Birth',
      pan: panDob,
      aadhaar: aadhaarDob,
      salarySlip: '-',
      bankStatement: '-',
      isMismatch: isDobMismatch,
      statusBadge: isDobMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: false,
    },
    {
      icon: CreditCard,
      type: 'PAN Number',
      pan: panNum,
      aadhaar: '-',
      salarySlip: salaryPan,
      bankStatement: bankPan,
      isMismatch: isPanMismatch,
      statusBadge: isPanMismatch ? 'Mismatch' : (panNum !== '-' ? 'Match' : '-'),
      highlightMismatches: false,
    },
    {
      icon: Fingerprint,
      type: 'Aadhaar Number',
      pan: '-',
      aadhaar: aadhaarNum,
      salarySlip: '-',
      bankStatement: '-',
      isMismatch: false,
      statusBadge: aadhaarNum !== '-' ? 'Match' : '-',
      highlightMismatches: false,
    },
    {
      icon: IndianRupee,
      type: 'Monthly Income / Salary Credit',
      pan: '-',
      aadhaar: '-',
      salarySlip: formatSalary,
      bankStatement: bankCreditStr,
      isMismatch: isIncomeMismatch,
      statusBadge: isIncomeMismatch ? 'Mismatch' : (bankCreditStr !== '-' ? 'Match' : '-'),
      highlightMismatches: true,
    },
  ];

  return (
    <div className="bg-white border border-cream-300 rounded-2xl shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-cream-200">
        <h3 className="text-sm font-bold text-charcoal-900">Extracted Data Overview</h3>
        <p className="text-xs text-charcoal-500">Key information extracted from uploaded documents</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-cream-50/70 border-b border-cream-200 text-charcoal-600 uppercase tracking-wider font-bold">
              <th className="text-left py-3.5 px-5 w-[20%]">Information Type</th>
              <th className="text-left py-3.5 px-4 w-[16%]">PAN</th>
              <th className="text-left py-3.5 px-4 w-[16%]">Aadhaar</th>
              <th className="text-left py-3.5 px-4 w-[16%]">Salary Slip</th>
              <th className="text-left py-3.5 px-4 w-[16%]">Bank Statement</th>
              <th className="text-center py-3.5 px-4 w-[16%]">Consistency</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-cream-100">
            {matrixRows.map((row, idx) => {
              const Icon = row.icon;
              const refName = (row.baseReference || '').trim().toLowerCase();

              return (
                <tr key={idx} className="hover:bg-cream-50/40 transition-colors">
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-6 h-6 rounded-md bg-cream-100 text-charcoal-600 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-charcoal-500" />
                      </div>
                      <span className="font-semibold text-charcoal-900">{row.type}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-4 font-medium text-charcoal-800">{row.pan}</td>
                  <td className="py-3.5 px-4 font-medium text-charcoal-800">{row.aadhaar}</td>

                  <td className={`py-3.5 px-4 font-semibold ${
                    row.type === 'Full Name' && row.isMismatch && row.salarySlip !== '-' && row.salarySlip.trim().toLowerCase() !== refName
                      ? 'text-error-600'
                      : row.type === 'Declared Income' && row.isMismatch
                      ? 'text-error-600'
                      : 'text-charcoal-800'
                  }`}>
                    {row.salarySlip}
                  </td>

                  <td className={`py-3.5 px-4 font-semibold ${
                    row.type === 'Full Name' && row.isMismatch && row.bankStatement !== '-' && row.bankStatement.trim().toLowerCase() !== refName
                      ? 'text-error-600'
                      : row.type === 'Bank Salary Credit' && row.isMismatch
                      ? 'text-error-600'
                      : 'text-charcoal-800'
                  }`}>
                    {row.bankStatement}
                  </td>

                  <td className="py-3.5 px-4 text-center">
                    {row.statusBadge === '-' ? (
                      <span className="text-charcoal-400 font-semibold">-</span>
                    ) : row.statusBadge === 'Match' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-success-50 text-success-700 border border-success-200">
                        Match
                      </span>
                    ) : row.statusBadge === 'Warning' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-warning-50 text-warning-700 border border-warning-200">
                        Warning
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-error-50 text-error-700 border border-error-200">
                        Mismatch
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ───────── Verification Results ───────── */

const VerificationResults = ({ checks }) => {
  const [filter, setFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [expandedCheck, setExpandedCheck] = useState(null);

  const allItems = checks || [];
  const passedCount = allItems.filter(c => c.status === 'PASSED').length;
  const failedCount = allItems.filter(c => c.status === 'FLAGGED').length;
  const warningCount = allItems.filter(c => c.status === 'WARNING').length;

  const filtered = allItems.filter(c => {
    if (filter === 'passed' && c.status !== 'PASSED') return false;
    if (filter === 'failed' && c.status !== 'FLAGGED' && c.status !== 'WARNING') return false;
    if (severityFilter !== 'all' && c.severity !== severityFilter) return false;
    return true;
  });

  const checkTitle = (type) => {
    const map = {
      IDENTITY_NAME_MATCH: 'Name Consistency Check',
      DOB_CONSISTENCY: 'Date of Birth Verification',
      PAN_CONSISTENCY: 'PAN Verification',
      AADHAAR_VERIFICATION: 'Aadhaar Verification',
      EMPLOYER_CONSISTENCY: 'Employer Consistency',
      DECLARED_VS_SLIP_INCOME: 'Income Verification',
      SLIP_VS_BANK_SALARY: 'Salary Credit Pattern',
      SLIP_VS_FORM16_INCOME: 'Form 16 Income Verification',
      EXISTING_EMI_BURDEN: 'EMI Burden Analysis',
    };
    return map[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  };

  const checkSubtitle = (type) => {
    const map = {
      IDENTITY_NAME_MATCH: 'Cross-check across all documents',
      DOB_CONSISTENCY: 'PAN vs Aadhaar comparison',
      PAN_CONSISTENCY: 'PAN format and validity check',
      AADHAAR_VERIFICATION: 'Aadhaar format and validity',
      EMPLOYER_CONSISTENCY: 'Employment records alignment',
      DECLARED_VS_SLIP_INCOME: 'Salary slip vs bank statement',
      SLIP_VS_BANK_SALARY: 'Regular salary credits in bank',
      SLIP_VS_FORM16_INCOME: 'Annual income cross-reference',
      EXISTING_EMI_BURDEN: 'Outstanding loan obligation review',
    };
    return map[type] || 'Cross-document verification';
  };

  return (
    <div className="bg-white border border-cream-300 rounded-2xl shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-cream-200">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-bold text-charcoal-900">Verification Results</h3>
            <p className="text-xs text-charcoal-500">Detailed cross-document verification analysis</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all', label: `All (${allItems.length})`, style: 'bg-success-700 text-white' },
              { key: 'passed', label: `Passed (${passedCount})`, style: 'bg-success-50 text-success-700' },
              { key: 'failed', label: `Failed (${failedCount + warningCount})`, style: 'bg-error-50 text-error-700' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  filter === tab.key
                    ? `${tab.style} shadow-sm`
                    : 'bg-cream-100 text-charcoal-600 hover:bg-cream-200'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="text-xs font-semibold border border-cream-300 rounded-lg px-3 py-1.5 bg-white text-charcoal-700 focus:ring-1 focus:ring-accent-500 cursor-pointer"
            >
              <option value="all">All Severity</option>
              <option value="HIGH">High Severity</option>
              <option value="MEDIUM">Medium Severity</option>
              <option value="LOW">Low Severity</option>
            </select>
          </div>
        </div>
      </div>

      <div className="divide-y divide-cream-100">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-charcoal-400 text-sm">
            No checks match the current filters.
          </div>
        ) : (
          filtered.map((check, idx) => {
            const isExpanded = expandedCheck === idx;
            const sources = resolveCheckSources(check);

            return (
              <div
                key={idx}
                className={`transition-all ${
                  check.status === 'FLAGGED'
                    ? 'bg-error-50/15'
                    : check.status === 'WARNING'
                    ? 'bg-warning-50/15'
                    : ''
                }`}
              >
                <div
                  className="px-6 py-4 flex items-center justify-between gap-4 cursor-pointer select-none hover:bg-cream-50/60 transition-colors"
                  onClick={() => setExpandedCheck(isExpanded ? null : idx)}
                >
                  {/* Left Column: Icon + Title */}
                  <div className="flex items-center gap-3 w-[30%] shrink-0">
                    <StatusIcon status={check.status} />
                    <div>
                      <h4 className="text-sm font-bold text-charcoal-900">{checkTitle(check.type)}</h4>
                      <p className="text-xs text-charcoal-500">{checkSubtitle(check.type)}</p>
                    </div>
                  </div>

                  {/* Middle Column 1: Source A */}
                  <div className="w-[25%] shrink-0">
                    {sources.sourceA.values.map((v, i) => (
                      <p key={i} className="text-xs font-semibold text-charcoal-800 leading-tight">
                        {v}
                      </p>
                    ))}
                  </div>

                  {/* Middle Column 2: Source B */}
                  <div className="w-[25%] shrink-0">
                    {sources.sourceB.values.map((v, i) => (
                      <p key={i} className="text-xs font-semibold text-charcoal-800 leading-tight">
                        {v}
                      </p>
                    ))}
                  </div>

                  {/* Right Column: Status + Severity */}
                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <span
                        className={`text-xs font-bold block ${
                          check.status === 'FLAGGED'
                            ? 'text-error-600'
                            : check.status === 'WARNING'
                            ? 'text-warning-600'
                            : 'text-success-600'
                        }`}
                      >
                        {check.status === 'FLAGGED' ? 'Failed' : check.status === 'WARNING' ? 'Warning' : 'Passed'}
                      </span>
                      <span className="text-[11px] text-charcoal-500 font-medium">
                        {check.severity === 'HIGH' ? 'High Severity' : check.severity === 'MEDIUM' ? 'Medium Severity' : 'Low Severity'}
                      </span>
                    </div>
                    <div className="text-charcoal-400 hover:text-charcoal-700 p-1">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </div>
                </div>

                {/* Expandable Explanation Details */}
                {isExpanded && (
                  <div className="bg-cream-50/90 border-t border-cream-200 px-6 py-4 text-xs space-y-3">
                    <p className="text-sm text-charcoal-700 font-medium">{check.message}</p>

                    {check.evidence && Object.keys(check.evidence).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pt-1">
                        {Object.entries(check.evidence).map(([k, v]) => (
                          <div key={k} className="bg-white p-2 rounded-lg border border-cream-200 shadow-2xs">
                            <span className="text-[10px] font-semibold text-charcoal-400 uppercase block mb-0.5">
                              {k.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs font-bold text-charcoal-900 block truncate" title={String(v)}>
                              {v !== null && v !== undefined ? String(v) : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

/* ───────── AI Analysis Summary Card ───────── */

const AISummaryCard = ({ data, riskLevel = 'LOW', flaggedCount = 0 }) => {
  const checks = data.checks || [];
  const warningCount = checks.filter((c) => c.status === 'WARNING').length;

  // Fall back to findings derived from the checks themselves. The previous
  // fallback was a fixed list of failures, which contradicted a clean result.
  const derivedFindings = checks
    .filter((c) => c.status === 'FLAGGED' || c.status === 'WARNING')
    .slice(0, 4)
    .map((c) => c.message || c.label || c.field || 'Discrepancy detected');

  const keyFindings = data.keyFindings?.length
    ? data.keyFindings
    : derivedFindings.length
      ? derivedFindings
      : ['No discrepancies found across the submitted documents'];

  const risk = (riskLevel || 'LOW').toUpperCase();
  const riskColors = {
    HIGH: { text: 'text-error-600', label: 'High Risk' },
    MEDIUM: { text: 'text-warning-600', label: 'Medium Risk' },
    LOW: { text: 'text-success-600', label: 'Low Risk' },
  };
  const rc = riskColors[risk] || riskColors.LOW;

  const recommendation =
    data.recommendationNote ||
    (flaggedCount > 0
      ? 'Manual review required. Please verify applicant information and income documents before proceeding.'
      : warningCount > 0
        ? 'Minor inconsistencies flagged. Confirm the highlighted fields before approving.'
        : 'All cross-document checks passed. The application is eligible to proceed to the next stage.');

  return (
    <div className="bg-white border border-cream-300 rounded-2xl shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-cream-200 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div>
            <h3 className="text-sm font-bold text-charcoal-900">AI Analysis Summary</h3>
            <p className="text-xs text-charcoal-500">Groq LLaMA 3.3 70B reasoning model analysis</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai-700 bg-ai-50 px-3 py-1.5 rounded-lg border border-ai-200">
          <Zap className="w-3.5 h-3.5 text-ai-600" /> Powered by Groq LLaMA 3.3 70B
        </span>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-cream-200 p-6 gap-6 md:gap-0">
        {/* Column 1: Key Findings */}
        <div className="md:pr-6 space-y-3">
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">Key Findings</h4>
          <ul className="space-y-2">
            {keyFindings.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs text-charcoal-700">
                <span className="w-1.5 h-1.5 rounded-full bg-charcoal-900 mt-1.5 shrink-0" />
                <span className="leading-relaxed font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Column 2: Risk Assessment */}
        <div className="md:px-6 space-y-3">
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">Risk Assessment</h4>
          <p className={`text-2xl font-black ${rc.text}`}>{rc.label}</p>
          <p className="text-xs text-charcoal-500 font-medium">
            {flaggedCount > 0
              ? `Based on ${flaggedCount} critical discrepanc${flaggedCount === 1 ? 'y' : 'ies'}`
              : warningCount > 0
                ? `Based on ${warningCount} minor inconsistenc${warningCount === 1 ? 'y' : 'ies'}`
                : `Based on ${checks.length} passing check${checks.length === 1 ? '' : 's'}`}
          </p>

          {/* Risk Meter */}
          <div className="w-full h-2 rounded-full overflow-hidden flex mt-3 bg-cream-200">
            <div className={`w-1/3 ${risk === 'LOW' ? 'bg-success-500' : 'bg-cream-300'}`} />
            <div className={`w-1/3 ${risk === 'MEDIUM' ? 'bg-warning-500' : 'bg-cream-300'}`} />
            <div className={`w-1/3 ${risk === 'HIGH' ? 'bg-error-500' : 'bg-cream-300'}`} />
          </div>
        </div>

        {/* Column 3: Recommendation */}
        <div className="md:pl-6 space-y-3">
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">Recommendation</h4>
          <p className="text-xs text-charcoal-700 leading-relaxed font-medium">{recommendation}</p>
        </div>
      </div>
    </div>
  );
};

/* ───────── Banner State ───────── */

/**
 * The headline banner reflects what the checks actually found. It used to be
 * hardcoded to the failure state, so a completely clean application still
 * announced "Cross-Document Discrepancies Detected".
 */
function getBannerState(flaggedCount, warningCount, totalChecks) {
  if (flaggedCount > 0) {
    return {
      tone: 'error',
      shell: 'border-error-200 bg-gradient-to-r from-error-50/70 via-white to-warning-50/40',
      iconClass: 'text-error-500',
      title: 'Cross-Document Discrepancies Detected',
      detail: `${flaggedCount} high severity issue${flaggedCount === 1 ? '' : 's'} require${
        flaggedCount === 1 ? 's' : ''
      } manual review`,
    };
  }

  if (warningCount > 0) {
    return {
      tone: 'warning',
      shell: 'border-warning-200 bg-gradient-to-r from-warning-50/70 via-white to-cream-50',
      iconClass: 'text-warning-500',
      title: 'Minor Inconsistencies Found',
      detail: `${warningCount} item${warningCount === 1 ? '' : 's'} to confirm — no critical mismatches detected`,
    };
  }

  return {
    tone: 'success',
    shell: 'border-success-200 bg-gradient-to-r from-success-50/70 via-white to-cream-50',
    iconClass: 'text-success-500',
    title: 'All Cross-Document Checks Passed',
    detail: totalChecks
      ? `${totalChecks} check${totalChecks === 1 ? '' : 's'} completed with no discrepancies`
      : 'No discrepancies found across the submitted documents',
  };
}

/* ───────── Main VerificationTab Component ───────── */

const VerificationTab = ({ applicationId, app, documents }) => {
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [data, setData] = useState(null);
  const toast = useToast();

  useEffect(() => {
    fetchValidation();
  }, [applicationId]);

  const fetchValidation = async () => {
    try {
      setLoading(true);
      const res = await officerService.getApplicationValidation(applicationId);
      setData(res.data || res);
    } catch (err) {
      console.error('Failed to fetch validation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRunVerification = async () => {
    try {
      setVerifying(true);
      const res = await officerService.triggerVerification(applicationId);
      setData(res.data || res);
      toast.success('Cross-document verification completed.');
    } catch (err) {
      console.error('Verification failed:', err);
      toast.error(err.message || 'Unknown error', { title: 'Verification re-run failed' });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-28 bg-cream-200 rounded-xl"></div>
        <div className="h-44 bg-cream-200 rounded-xl"></div>
        <div className="h-60 bg-cream-200 rounded-xl"></div>
      </div>
    );
  }

  if (!data || data.status === 'PENDING_DOCS') {
    return (
      <div className="bg-white p-10 rounded-xl shadow-soft border border-cream-300 text-center text-charcoal-500 max-w-2xl mx-auto my-8">
        <div className="w-14 h-14 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-4">
          <Clock className="w-7 h-7 text-charcoal-400" />
        </div>
        <h3 className="text-lg font-bold text-charcoal-900 mb-2">Cross-Document Verification Pending</h3>
        <p className="text-sm text-charcoal-600 mb-6 leading-relaxed">
          Verification will run automatically once the applicant's required financial and identity documents have finished AI extraction.
        </p>
        <button
          onClick={handleRunVerification}
          disabled={verifying}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-600 hover:bg-accent-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm disabled:opacity-50"
        >
          {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {verifying ? 'Running Verification...' : 'Run Verification Now'}
        </button>
      </div>
    );
  }

  const isStale = data.status === 'STALE';
  const isConsistent = data.status === 'CONSISTENT' || data.status === 'VERIFIED';
  const isReviewRequired = data.status === 'REVIEW_REQUIRED';
  const docsList = documents || app?.documents || [];

  const checks = data.checks || [];
  const flaggedCount = checks.filter((c) => c.status === 'FLAGGED').length;
  const warningCount = checks.filter((c) => c.status === 'WARNING').length;
  const banner = getBannerState(flaggedCount, warningCount, checks.length);

  // Derive risk and score from the checks when the backend hasn't supplied them,
  // instead of defaulting to HIGH / 72 regardless of the result.
  const riskLevel =
    data.riskLevel || (flaggedCount > 0 ? 'HIGH' : warningCount > 0 ? 'MEDIUM' : 'LOW');
  const verificationScore =
    data.verificationScore ??
    (checks.length
      ? Math.max(
          0,
          Math.round(((checks.length - flaggedCount - warningCount * 0.5) / checks.length) * 100)
        )
      : 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Top Banner + Overall Verification Score */}
      <div
        className={`p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 ${banner.shell}`}
      >
        <div className="space-y-2 flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider bg-white border border-charcoal-300 text-charcoal-700 shadow-2xs">
              {isStale ? 'Status Outdated' : isConsistent ? 'Consistent' : isReviewRequired ? 'Under Review' : 'Incomplete'}
            </span>
            <RiskBadge riskLevel={riskLevel} />
          </div>

          <h2 className="text-xl font-extrabold text-charcoal-900 flex items-center gap-2 mt-1">
            {banner.tone === 'error' ? (
              <XCircle className={`w-5 h-5 ${banner.iconClass}`} />
            ) : banner.tone === 'warning' ? (
              <AlertTriangle className={`w-5 h-5 ${banner.iconClass}`} />
            ) : (
              <ShieldCheck className={`w-5 h-5 ${banner.iconClass}`} />
            )}
            {banner.title}
          </h2>

          <p className="text-sm text-charcoal-600 font-medium">{banner.detail}</p>

          <div className="pt-2">
            <button
              onClick={handleRunVerification}
              disabled={verifying}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-cream-50 text-charcoal-800 font-bold rounded-lg text-xs border border-cream-300 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-charcoal-600 ${verifying ? 'animate-spin' : ''}`} />
              <span>{verifying ? 'Analyzing...' : 'Re-run Analysis'}</span>
            </button>
          </div>
        </div>

        {/* Score Circle */}
        <ScoreCircle score={verificationScore} />
      </div>

      {/* 2. Stats Row */}
      <StatsRow checks={checks} documentsCount={docsList.length} />

      {/* 3. Extracted Data Overview Table */}
      <ExtractedDataTable checks={checks} documents={docsList} app={app} />

      {/* 4. Verification Results */}
      <VerificationResults checks={checks} />

      {/* 5. AI Analysis Summary */}
      <AISummaryCard data={data} riskLevel={riskLevel} flaggedCount={flaggedCount} />

      {/* 6. Footer Disclaimer */}
      <div className="p-4 bg-cream-50 rounded-xl border border-cream-200 flex items-start gap-3 text-xs text-charcoal-600">
        <Info className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          Note: This analysis is AI-generated and recommended for officer review. Final decision rests with authorized personnel.
        </p>
      </div>
    </div>
  );
};

export default VerificationTab;
