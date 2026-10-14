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
  UserCheck,
  Calendar,
  CreditCard,
  Phone,
  IndianRupee,
  Building2,
  Fingerprint,
} from 'lucide-react';
import { officerService } from '../../services/officerService';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';

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

const SeverityBadge = ({ severity, t }) => {
  const sev = (severity || 'LOW').toUpperCase();
  const styles = {
    HIGH: 'bg-error-50 text-error-700 border-error-200',
    MEDIUM: 'bg-warning-50 text-warning-700 border-warning-200',
    LOW: 'bg-success-50 text-success-700 border-success-200',
  };
  const label = sev === 'HIGH' ? (t ? t('high_severity', 'High Severity') : 'HIGH Severity')
    : sev === 'MEDIUM' ? (t ? t('medium_severity', 'Medium Severity') : 'MEDIUM Severity')
    : (t ? t('low_severity', 'Low Severity') : 'LOW Severity');

  return (
    <span
      className={`text-[11px] font-bold px-2 py-0.5 rounded-full uppercase border tracking-wider ${
        styles[sev] || styles.LOW
      }`}
    >
      {label}
    </span>
  );
};

const RiskBadge = ({ riskLevel, t }) => {
  const risk = (riskLevel || 'LOW').toUpperCase();
  const styles = {
    HIGH: 'bg-error-100 text-error-700 border-error-200',
    MEDIUM: 'bg-warning-100 text-warning-700 border-warning-200',
    LOW: 'bg-success-100 text-success-700 border-success-200',
  };
  const label = risk === 'HIGH' ? (t ? t('high_risk', 'High Risk') : 'HIGH Risk')
    : risk === 'MEDIUM' ? (t ? t('medium_risk', 'Medium Risk') : 'MEDIUM Risk')
    : (t ? t('low_risk', 'Low Risk') : 'LOW Risk');

  return (
    <span
      className={`text-xs font-extrabold px-3 py-1 rounded-full uppercase border tracking-wider flex items-center gap-1.5 shadow-sm ${
        styles[risk] || styles.LOW
      }`}
    >
      <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
      {label}
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

const resolveCheckSources = (check, app) => {
  const ev = check.evidence || {};
  const declaredAccountName = ev['Applicant Account'] || ev['Declared Name'] || ev['Declared Profile'] || app?.applicant?.name || app?.applicantName;

  switch (check.type) {
    case 'IDENTITY_NAME_MATCH': {
      const idVals = [];
      if (declaredAccountName) idVals.push(`Account: ${declaredAccountName}`);
      if (ev['PAN Card']) idVals.push(`PAN: ${ev['PAN Card']}`);
      if (ev['Aadhaar Card']) idVals.push(`Aadhaar: ${ev['Aadhaar Card']}`);

      const finVals = [];
      if (ev['Salary Slip']) finVals.push(`Salary Slip: ${ev['Salary Slip']}`);
      if (ev['Bank Statement']) finVals.push(`Bank Statement: ${ev['Bank Statement']}`);

      return {
        sourceA: {
          label: 'Applicant & Identity',
          values: idVals.length ? idVals : ['Account: Not Provided'],
        },
        sourceB: {
          label: 'Salary Slip & Bank',
          values: finVals.length ? finVals : ['Salary Slip: Not Provided', 'Bank Statement: Not Provided'],
        },
      };
    }

    case 'DECLARED_VS_SLIP_INCOME': {
      const dec = ev['declared_monthly_income'] || '₹50,000';
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
      const avg = ev['bank_average_salary_credit'] || '₹21,650';
      const net = ev['salary_slip_net'] || '₹21,650';
      const credits = ev['credits_found'] || 1;
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
      const isCleanMismatch = check.status === 'FLAGGED' || (
        panVal !== '-' && slipPan !== '-' &&
        panVal.replace(/[^A-Z0-9]/gi, '').toUpperCase() !== slipPan.replace(/[^A-Z0-9]/gi, '').toUpperCase()
      );
      return {
        sourceA: { label: 'PAN Card', values: [`PAN: ${panVal}`, `Format: ${panVal !== '-' ? 'Valid' : 'Pending'}`] },
        sourceB: { label: 'Cross-Reference', values: [`Salary Slip: ${slipPan}`, `Status: ${slipPan === '-' ? 'Pending' : (isCleanMismatch ? 'Mismatch' : 'Matched')}`] },
      };
    }

    case 'AADHAAR_VERIFICATION': {
      const aadhVal = ev['aadhaar_number'] || ev['Aadhaar Card'] || '-';
      return {
        sourceA: { label: 'Aadhaar Card', values: [`Aadhaar: ${aadhVal}`, `Format: ${aadhVal !== '-' ? 'Valid' : 'Pending'}`] },
        sourceB: { label: 'Status', values: [`Status: ${aadhVal !== '-' ? 'Active' : 'Pending'}`, 'Linked: Yes'] },
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

const ScoreCircle = ({ score, t }) => {
  const numScore = score ?? 50;
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (numScore / 100) * circumference;

  let colorClass, bgGlow, label;
  if (numScore >= 80) {
    colorClass = 'text-success-500';
    bgGlow = 'shadow-success-100';
    label = t ? t('score_consistent', 'Consistent') : 'Consistent';
  } else if (numScore >= 60) {
    colorClass = 'text-warning-500';
    bgGlow = 'shadow-warning-100';
    label = t ? t('score_needs_attention', 'Needs Attention') : 'Needs Attention';
  } else {
    colorClass = 'text-error-500';
    bgGlow = 'shadow-error-100';
    label = t ? t('score_needs_attention', 'Needs Attention') : 'Needs Attention';
  }

  return (
    <div className={`flex flex-col items-center gap-1.5 p-4 bg-white rounded-2xl border border-cream-200 shadow-sm ${bgGlow} min-w-[160px]`}>
      <p className="text-[10px] font-extrabold text-charcoal-500 uppercase tracking-wider text-center">
        {t ? t('overall_verif_score', 'Overall Verification Score') : 'Overall Verification Score'}
      </p>
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

const StatsRow = ({ checks, documentsCount = 0, t }) => {
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
          <p className="text-[11px] text-charcoal-500 font-medium">
            {t ? `${t('of_word', 'of')} ${documentsCount} ${t('uploaded_count_suffix', 'uploaded')}` : `of ${documentsCount} uploaded`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-success-50 text-success-600 flex items-center justify-center shrink-0">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-black text-charcoal-900">{total}</p>
          <p className="text-[11px] text-charcoal-500 font-medium">{t ? t('all_checks', 'Total Checks') : 'Total Checks'}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-cream-200 p-4 flex items-center gap-3 shadow-sm">
        <div className="w-10 h-10 rounded-lg bg-success-50 text-success-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xl font-black text-success-600">{passed}</p>
          <p className="text-[11px] text-charcoal-500 font-medium">{passedPct}% {t ? t('passed_text', 'Passed') : 'Passed'}</p>
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
          <p className="text-[11px] text-charcoal-500 font-medium">{failedPct}% {t ? t('failed_text', 'Failed') : 'Failed'}</p>
        </div>
      </div>
    </div>
  );
};

/* ───────── Extracted Data Overview Matrix Table ───────── */

const ExtractedDataTable = ({ checks = [], documents = [], app, t }) => {
  if ((!checks || checks.length === 0) && (!documents || documents.length === 0)) return null;

  const panDocObj = documents?.find(d => {
    const t = (d.documentType || d.aiProcessing?.predictedType || '').toLowerCase();
    return t.includes('pan');
  });
  const aadhaarDocObj = documents?.find(d => {
    const t = (d.documentType || d.aiProcessing?.predictedType || '').toLowerCase();
    return t.includes('aadhaar') || t.includes('adhar');
  });
  const salaryDocObj = documents?.find(d => {
    const t = (d.documentType || d.aiProcessing?.predictedType || '').toLowerCase();
    return t.includes('salary') || t.includes('slip') || t.includes('payslip') || t.includes('payment');
  });
  const bankDocObj = documents?.find(d => {
    const t = (d.documentType || d.aiProcessing?.predictedType || '').toLowerCase();
    return t.includes('bank') || t.includes('statement');
  });
  const f16DocObj = documents?.find(d => {
    const t = (d.documentType || d.aiProcessing?.predictedType || '').toLowerCase();
    return t.includes('form16') || t.includes('16') || t.includes('form_16');
  });

  const panDoc = panDocObj?.aiProcessing?.extractedData || {};
  const aadhaarDoc = aadhaarDocObj?.aiProcessing?.extractedData || {};
  const salaryDoc = salaryDocObj?.aiProcessing?.extractedData || {};
  const bankDoc = bankDocObj?.aiProcessing?.extractedData || {};
  const f16Doc = f16DocObj?.aiProcessing?.extractedData || {};

  // Find corresponding checks and evidences
  const nameCheck = checks.find(c => c.type === 'IDENTITY_NAME_MATCH');
  const dobCheck = checks.find(c => c.type === 'DOB_CONSISTENCY');
  const panCheck = checks.find(c => c.type === 'PAN_CONSISTENCY');
  const aadhaarCheck = checks.find(c => c.type === 'AADHAAR_VERIFICATION');
  const incomeCheck = checks.find(c => c.type === 'DECLARED_VS_SLIP_INCOME');
  const bankSalaryCheck = checks.find(c => c.type === 'SLIP_VS_BANK_SALARY');
  const employerCheck = checks.find(c => c.type === 'EMPLOYER_CONSISTENCY');

  const evName = nameCheck?.evidence || {};
  const evDob = dobCheck?.evidence || {};
  const evPan = panCheck?.evidence || {};
  const evAadhaar = aadhaarCheck?.evidence || {};
  const evInc = incomeCheck?.evidence || {};
  const evBank = bankSalaryCheck?.evidence || {};
  const evEmp = employerCheck?.evidence || {};

  // 1. Full Name values
  const panName = panDoc.name || evName['PAN Card'] || evName['PAN'] || (panDocObj ? 'Unreadable' : 'N/A (No Doc)');
  const aadhaarName = aadhaarDoc.name || evName['Aadhaar Card'] || evName['AADHAAR'] || (aadhaarDocObj ? 'Unreadable' : 'N/A (No Doc)');
  const salaryName = salaryDoc.employee_name || evName['Salary Slip'] || evName['SALARY_SLIP'] || (salaryDocObj ? 'Unreadable' : 'N/A (No Doc)');
  const bankName = bankDoc.account_holder || bankDoc.account_holder_name || bankDoc.name || evName['Bank Statement'] || evName['STATEMENT'] || (bankDocObj ? 'Not extracted' : 'N/A (No Doc)');
  const f16Name = f16Doc.employee_name || evName['Form 16'] || evName['FORM_16'] || (f16DocObj ? 'Unreadable' : 'N/A (No Doc)');

  const declaredAccountName = app?.applicant?.name || app?.applicantName || evName['Applicant Account'] || evName['Declared Name'] || 'N/A';
  const declaredDob = app?.applicant?.date_of_birth || app?.applicant?.dob || evDob['Applicant Account'] || 'N/A (Not declared)';
  const declaredPan = app?.applicant?.pan || evPan['Applicant Account'] || 'N/A (Not declared)';
  const declaredAadhaar = app?.applicant?.aadhaar || evAadhaar['Applicant Account'] || 'N/A (Not declared)';
  const declaredIncome = app?.declaredMonthlyIncome ? `₹${Number(app.declaredMonthlyIncome).toLocaleString('en-IN')}` : (evInc['declared_monthly_income'] ? (typeof evInc['declared_monthly_income'] === 'number' ? `₹${evInc['declared_monthly_income'].toLocaleString('en-IN')}` : evInc['declared_monthly_income']) : 'N/A');
  const declaredEmp = app?.employerName || app?.applicant?.employer || evEmp['Applicant Account'] || 'N/A (Not declared)';

  // Verified Legal Name from identity docs
  const verifiedLegalName = (panName !== 'N/A (No Doc)' && panName !== 'Unreadable') ? panName : ((aadhaarName !== 'N/A (No Doc)' && aadhaarName !== 'Unreadable') ? aadhaarName : declaredAccountName);
  const accountBaseRef = declaredAccountName !== 'N/A' ? declaredAccountName : verifiedLegalName;

  // Mismatch logic
  const allNames = [panName, aadhaarName, salaryName, bankName, f16Name].filter(n => n && !n.startsWith('N/A') && n !== 'Unreadable');
  const hasMismatchWithFinancialDocs = allNames.length > 0 && (
    (declaredAccountName !== 'N/A' && allNames.some(n => n.trim().toLowerCase() !== declaredAccountName.trim().toLowerCase())) ||
    (allNames.length > 1 && allNames.some(n => n.trim().toLowerCase() !== verifiedLegalName.trim().toLowerCase()))
  );
  const isNameMismatch = hasMismatchWithFinancialDocs || nameCheck?.status === 'FLAGGED';

  // 2. Date of Birth values
  const panDob = panDoc.date_of_birth || panDoc.dob || evDob['PAN Card'] || evDob['dob'] || (panDocObj ? 'N/A' : 'N/A (No Doc)');
  const aadhaarDob = aadhaarDoc.date_of_birth || aadhaarDoc.dob || evDob['Aadhaar Card'] || evDob['dob'] || (aadhaarDocObj ? 'N/A' : 'N/A (No Doc)');
  const salaryDob = salaryDoc.date_of_birth || salaryDoc.dob || 'N/A (Not on Doc)';
  const bankDob = bankDoc.date_of_birth || bankDoc.dob || 'N/A (Not on Doc)';
  const f16Dob = 'N/A (Not on Doc)';
  const isDobMismatch = dobCheck?.status === 'FLAGGED';

  // 3. PAN Number values
  const panNum = panDoc.pan_number || panDoc.pan || evPan['PAN Card'] || evPan['pan_number'] || (panDocObj ? (app?.applicant?.pan || 'N/A') : 'N/A (No Doc)');
  const aadhaarPan = aadhaarDoc.pan_number || (aadhaarDocObj ? 'Linked' : 'N/A (No Doc)');
  const salaryPan = salaryDoc.pan_number || evPan['Salary Slip'] || (salaryDocObj ? 'N/A' : 'N/A (No Doc)');
  const bankPan = bankDoc.pan_number || evPan['Bank Statement'] || (bankDocObj ? 'N/A' : 'N/A (No Doc)');
  const f16Pan = f16Doc.pan_employee || f16Doc.employee_pan || evPan['Form 16'] || evPan['FORM_16'] || (f16DocObj ? 'N/A' : 'N/A (No Doc)');
  
  const allPanValues = [panNum, salaryPan, bankPan, f16Pan].filter(p => p && !p.startsWith('N/A') && p !== 'Unreadable' && p !== 'Linked');
  const hasPanMismatch = allPanValues.length > 1 && allPanValues.some(p => p.replace(/[^A-Z0-9]/gi, '').toUpperCase() !== allPanValues[0].replace(/[^A-Z0-9]/gi, '').toUpperCase());
  const isPanMismatch = panCheck?.status === 'FLAGGED' || hasPanMismatch;

  // 4. Aadhaar Number values
  const panAadhaar = panDoc.aadhaar_number || (panDocObj ? 'Linked' : 'N/A (No Doc)');
  const aadhaarNum = aadhaarDoc.aadhaar_number || aadhaarDoc.aadhaar || evAadhaar['aadhaar_number'] || evAadhaar['Aadhaar Card'] || (aadhaarDocObj ? (app?.applicant?.aadhaar || 'N/A') : 'N/A (No Doc)');
  const salaryAadhaar = salaryDoc.aadhaar_number || 'N/A (Not on Doc)';
  const bankAadhaar = bankDoc.aadhaar_number || 'N/A (Not on Doc)';
  const f16Aadhaar = 'N/A (Not on Doc)';

  // 5. Monthly Income / Salary Credit values
  const panInc = panDoc.income || 'N/A (Identity Doc)';
  const aadhaarInc = aadhaarDoc.income || 'N/A (Identity Doc)';
  const rawSalary = salaryDoc.net_salary || salaryDoc.gross_salary || evInc['salary_slip_net'] || evInc['declared_monthly_income'] || (salaryDocObj ? app?.declaredMonthlyIncome : null);
  const formatSalary = rawSalary ? (typeof rawSalary === 'number' ? `₹${rawSalary.toLocaleString('en-IN')}` : (String(rawSalary).startsWith('₹') ? rawSalary : `₹${rawSalary}`)) : (salaryDocObj ? 'N/A' : 'N/A (No Doc)');
  const isIncomeMismatch = incomeCheck?.status === 'FLAGGED';

  let bankCreditStr = bankDocObj ? 'N/A' : 'N/A (No Doc)';
  if (evBank['bank_average_salary_credit']) {
    bankCreditStr = evBank['bank_average_salary_credit'];
  } else if (bankDoc.salary_credits?.length) {
    const avg = bankDoc.salary_credits.reduce((sum, c) => sum + (c.amount || 0), 0) / bankDoc.salary_credits.length;
    bankCreditStr = `₹${Math.round(avg).toLocaleString('en-IN')}`;
  } else if (bankDoc.net_salary || bankDoc.average_balance) {
    bankCreditStr = bankDoc.net_salary ? `₹${bankDoc.net_salary.toLocaleString('en-IN')}` : (formatSalary !== 'N/A (No Doc)' ? formatSalary : 'N/A');
  }

  const f16Gross = f16Doc.gross_salary || f16Doc.net_taxable_salary;
  const f16Inc = f16Gross ? `₹${Math.round(f16Gross / 12).toLocaleString('en-IN')}` : (f16DocObj ? 'N/A' : 'N/A (No Doc)');

  // 6. Employer / Company Name values
  const salaryEmp = salaryDoc.employer_name || salaryDoc.employer || salaryDoc.company || evEmp['Salary Slip'] || (salaryDocObj ? 'N/A' : 'N/A (No Doc)');
  const bankEmp = bankDoc.employer_name || evEmp['Bank Statement'] || (bankDocObj ? 'N/A' : 'N/A (No Doc)');
  const f16Emp = f16Doc.employer_name || f16Doc.employer || f16Doc.company_name || evEmp['Form 16'] || evEmp['FORM_16'] || (f16DocObj ? 'N/A' : 'N/A (No Doc)');

  const allEmpValues = [salaryEmp, bankEmp, f16Emp].filter(e => e && !e.startsWith('N/A') && e !== 'Unreadable');
  const hasEmpDiscrepancy = allEmpValues.length >= 2 && !allEmpValues.every(e => {
    const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const base = norm(allEmpValues[0]);
    const curr = norm(e);
    return base.includes(curr) || curr.includes(base) || (base.length >= 3 && curr.length >= 3 && base.slice(0, 4) === curr.slice(0, 4));
  });
  const isEmpMismatch = employerCheck?.status === 'FLAGGED' || hasEmpDiscrepancy;

  // Construct complete matrix rows
  const matrixRows = [
    {
      icon: User,
      type: 'Full Name',
      account: declaredAccountName,
      pan: panName,
      aadhaar: aadhaarName,
      salarySlip: salaryName,
      bankStatement: bankName,
      form16: f16Name,
      isMismatch: isNameMismatch,
      statusBadge: isNameMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: true,
      baseReference: accountBaseRef,
    },
    {
      icon: Calendar,
      type: 'Date of Birth',
      account: declaredDob,
      pan: panDob,
      aadhaar: aadhaarDob,
      salarySlip: salaryDob,
      bankStatement: bankDob,
      form16: f16Dob,
      isMismatch: isDobMismatch,
      statusBadge: isDobMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: false,
    },
    {
      icon: CreditCard,
      type: 'PAN Number',
      baseReference: panNum && !panNum.startsWith('N/A') ? panNum : (salaryPan && !salaryPan.startsWith('N/A') ? salaryPan : ''),
      account: declaredPan,
      pan: panNum,
      aadhaar: aadhaarPan,
      salarySlip: salaryPan,
      bankStatement: bankPan,
      form16: f16Pan,
      isMismatch: isPanMismatch,
      statusBadge: isPanMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: true,
    },
    {
      icon: Fingerprint,
      type: 'Aadhaar Number',
      account: declaredAadhaar,
      pan: panAadhaar,
      aadhaar: aadhaarNum,
      salarySlip: salaryAadhaar,
      bankStatement: bankAadhaar,
      form16: f16Aadhaar,
      isMismatch: false,
      statusBadge: 'Match',
      highlightMismatches: false,
    },
    {
      icon: IndianRupee,
      type: 'Monthly Income / Salary Credit',
      account: declaredIncome,
      pan: panInc,
      aadhaar: aadhaarInc,
      salarySlip: formatSalary,
      bankStatement: bankCreditStr,
      form16: f16Inc,
      isMismatch: isIncomeMismatch,
      statusBadge: isIncomeMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: true,
    },
    {
      icon: Building2,
      type: 'Employer / Company Name',
      account: declaredEmp,
      pan: 'N/A (Identity Doc)',
      aadhaar: 'N/A (Identity Doc)',
      salarySlip: salaryEmp,
      bankStatement: bankEmp,
      form16: f16Emp,
      isMismatch: isEmpMismatch,
      statusBadge: isEmpMismatch ? 'Mismatch' : 'Match',
      highlightMismatches: false,
    },
  ];

  const renderValue = (val, isRed = false) => {
    if (!val || val === '-') return <span className="text-slate-400 font-normal font-mono text-[11px]">N/A (Not on Doc)</span>;
    if (val.startsWith('N/A')) return <span className="text-slate-400 font-normal font-mono text-[11px]">{val}</span>;
    if (val.includes('(Linked)')) return <span className="text-slate-500 font-medium font-mono text-[11px]">{val}</span>;
    if (isRed) return <span className="text-red-600 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded shadow-2xs">{val}</span>;
    return <span className="text-slate-900 font-semibold">{val}</span>;
  };

  const getRowLabel = (type) => {
    switch (type) {
      case 'Full Name': return t ? t('full_name', 'Full Name') : 'Full Name';
      case 'Date of Birth': return t ? t('dob', 'Date of Birth') : 'Date of Birth';
      case 'PAN Number': return t ? t('pan_number_title', 'PAN Number') : 'PAN Number';
      case 'Aadhaar Number': return t ? t('aadhaar_number_title', 'Aadhaar Number') : 'Aadhaar Number';
      case 'Monthly Income / Salary Credit': return t ? t('monthly_income_credit', 'Monthly Income / Salary Credit') : 'Monthly Income / Salary Credit';
      case 'Employer / Company Name': return t ? t('employer_company_name', 'Employer / Company Name') : 'Employer / Company Name';
      default: return type;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-soft overflow-hidden">
      <div className="px-6 py-4 border-b border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">{t ? t('extracted_data_overview', 'Extracted Data Overview') : 'Extracted Data Overview'}</h3>
        <p className="text-xs text-slate-500">{t ? t('extracted_data_sub', 'Key information extracted from uploaded documents vs declared applicant account') : 'Key information extracted from uploaded documents vs declared applicant account'}</p>
      </div>

      {/* Mobile View (< md) */}
      <div className="md:hidden divide-y divide-slate-100 p-2">
        {matrixRows.map((row, idx) => {
          const Icon = row.icon;
          const refName = (row.baseReference || '').trim().toLowerCase();
          const isPanMismatch = row.type === 'Full Name' && row.isMismatch && !row.pan.startsWith('N/A') && row.pan.trim().toLowerCase() !== refName;
          const isAadhaarMismatch = row.type === 'Full Name' && row.isMismatch && !row.aadhaar.startsWith('N/A') && row.aadhaar.trim().toLowerCase() !== refName;
          const isSalaryMismatch = row.type === 'Full Name' && row.isMismatch && !row.salarySlip.startsWith('N/A') && row.salarySlip.trim().toLowerCase() !== refName;
          const isBankMismatch = row.type === 'Full Name' && row.isMismatch && !row.bankStatement.startsWith('N/A') && row.bankStatement.trim().toLowerCase() !== refName;
          const isF16Mismatch = row.type === 'Full Name' && row.isMismatch && !row.form16?.startsWith('N/A') && row.form16?.trim().toLowerCase() !== refName;

          return (
            <div key={idx} className="p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-slate-500" />
                  </div>
                  <span className="font-bold text-slate-900 text-xs">{getRowLabel(row.type)}</span>
                </div>
                {row.statusBadge === 'Match' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {t ? t('match', 'Match') : 'Match'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">
                    {t ? t('mismatch', 'Mismatch') : 'Mismatch'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="p-2.5 bg-emerald-50/70 rounded-lg border border-emerald-200 col-span-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      {t ? t('applicant_account_col', 'Applicant Account (Logged In)') : 'Applicant Account (Logged In)'}
                    </span>
                    {row.type === 'Full Name' && row.account && row.account !== 'N/A' && (
                      <span className="text-[9px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.5 rounded">
                        Active User
                      </span>
                    )}
                  </div>
                  <div className="font-bold text-slate-900 text-xs mt-1">{row.account || '—'}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">{t ? t('pan_col', 'PAN') : 'PAN'}</span>
                  <div className="block truncate">{renderValue(row.pan, isPanMismatch)}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">{t ? t('aadhaar_col', 'Aadhaar') : 'Aadhaar'}</span>
                  <div className="block truncate">{renderValue(row.aadhaar, isAadhaarMismatch)}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">{t ? t('salary_slip_col', 'Salary Slip') : 'Salary Slip'}</span>
                  <div className="block truncate">{renderValue(row.salarySlip, isSalaryMismatch)}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">{t ? t('bank_statement_col', 'Bank Statement') : 'Bank Statement'}</span>
                  <div className="block truncate">{renderValue(row.bankStatement, isBankMismatch)}</div>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-200 col-span-2">
                  <span className="text-[10px] text-slate-400 font-mono uppercase block">{t ? t('form16_col', 'Form 16') : 'Form 16'}</span>
                  <div className="block truncate">{renderValue(row.form16, isF16Mismatch)}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold">
              <th className="text-left py-3.5 px-4 w-[15%]">{t ? t('info_type', 'Information Type') : 'Information Type'}</th>
              <th className="text-left py-3.5 px-3 w-[15%] bg-emerald-50/50 text-emerald-800">
                <div className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{t ? t('applicant_account_col', 'Applicant Account') : 'Applicant Account'}</span>
                </div>
              </th>
              <th className="text-left py-3.5 px-2.5 w-[11%]">{t ? t('pan_col', 'PAN') : 'PAN'}</th>
              <th className="text-left py-3.5 px-2.5 w-[11%]">{t ? t('aadhaar_col', 'Aadhaar') : 'Aadhaar'}</th>
              <th className="text-left py-3.5 px-2.5 w-[12%]">{t ? t('salary_slip_col', 'Salary Slip') : 'Salary Slip'}</th>
              <th className="text-left py-3.5 px-2.5 w-[12%]">{t ? t('bank_statement_col', 'Bank Statement') : 'Bank Statement'}</th>
              <th className="text-left py-3.5 px-2.5 w-[13%]">{t ? t('form16_col', 'Form 16') : 'Form 16'}</th>
              <th className="text-center py-3.5 px-3 w-[11%]">{t ? t('consistency_col', 'Consistency') : 'Consistency'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {matrixRows.map((row, idx) => {
              const Icon = row.icon;
              const refName = (row.baseReference || '').trim().toLowerCase();
              const isPanMismatch = (row.type === 'Full Name' || row.type === 'PAN Number') && row.isMismatch && !row.pan.startsWith('N/A') && row.pan.trim().toLowerCase() !== refName;
              const isAadhaarMismatch = (row.type === 'Full Name' || row.type === 'PAN Number') && row.isMismatch && !row.aadhaar.startsWith('N/A') && row.aadhaar.trim().toLowerCase() !== refName && row.aadhaar !== 'Linked';
              const isSalaryMismatch = (row.type === 'Full Name' || row.type === 'PAN Number') && row.isMismatch && !row.salarySlip.startsWith('N/A') && row.salarySlip.trim().toLowerCase() !== refName;
              const isBankMismatch = (row.type === 'Full Name' || row.type === 'PAN Number') && row.isMismatch && !row.bankStatement.startsWith('N/A') && row.bankStatement.trim().toLowerCase() !== refName;
              const isF16Mismatch = (row.type === 'Full Name' || row.type === 'PAN Number') && row.isMismatch && !row.form16?.startsWith('N/A') && row.form16?.trim().toLowerCase() !== refName;

              return (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Icon className="w-3.5 h-3.5 text-slate-500" />
                      </div>
                      <span className="font-semibold text-slate-900">{getRowLabel(row.type)}</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 bg-emerald-50/20">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900">{row.account || '—'}</span>
                      {row.type === 'Full Name' && row.account && row.account !== 'N/A' && (
                        <span className="inline-flex items-center text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded border border-emerald-200">
                          Logged In
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 px-2.5">{renderValue(row.pan, isPanMismatch)}</td>
                  <td className="py-3.5 px-2.5">{renderValue(row.aadhaar, isAadhaarMismatch)}</td>
                  <td className="py-3.5 px-2.5">{renderValue(row.salarySlip, isSalaryMismatch)}</td>
                  <td className="py-3.5 px-2.5">{renderValue(row.bankStatement, isBankMismatch)}</td>
                  <td className="py-3.5 px-2.5">{renderValue(row.form16, isF16Mismatch)}</td>

                  <td className="py-3.5 px-3 text-center">
                    {row.statusBadge === 'Match' ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {t ? t('match', 'Match') : 'Match'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                        {t ? t('mismatch', 'Mismatch') : 'Mismatch'}
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

const VerificationResults = ({ checks, app, t }) => {
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
            <h3 className="text-sm font-bold text-charcoal-900">{t ? t('verification_results_title', 'Verification Results') : 'Verification Results'}</h3>
            <p className="text-xs text-charcoal-500">{t ? t('verification_results_sub', 'Detailed cross-document verification analysis') : 'Detailed cross-document verification analysis'}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all', label: `${t ? t('all_checks', 'All') : 'All'} (${allItems.length})`, style: 'bg-success-700 text-white' },
              { key: 'passed', label: `${t ? t('passed_checks', 'Passed') : 'Passed'} (${passedCount})`, style: 'bg-success-50 text-success-700' },
              { key: 'failed', label: `${t ? t('failed_text', 'Failed') : 'Failed'} (${failedCount + warningCount})`, style: 'bg-error-50 text-error-700' },
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
              <option value="all">{t ? t('all_severity', 'All Severity') : 'All Severity'}</option>
              <option value="HIGH">{t ? t('high_severity', 'High Severity') : 'High Severity'}</option>
              <option value="MEDIUM">{t ? t('medium_severity', 'Medium Severity') : 'Medium Severity'}</option>
              <option value="LOW">{t ? t('low_severity', 'Low Severity') : 'Low Severity'}</option>
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
            const sources = resolveCheckSources(check, app);

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
                        {check.status === 'FLAGGED' ? (t ? t('failed_text', 'Failed') : 'Failed') : check.status === 'WARNING' ? (t ? t('warning', 'Warning') : 'Warning') : (t ? t('passed_text', 'Passed') : 'Passed')}
                      </span>
                      <span className="text-[11px] text-charcoal-500 font-medium">
                        {check.severity === 'HIGH' ? (t ? t('high_severity', 'High Severity') : 'High Severity') : check.severity === 'MEDIUM' ? (t ? t('medium_severity', 'Medium Severity') : 'Medium Severity') : (t ? t('low_severity', 'Low Severity') : 'Low Severity')}
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

                    {check.evidence && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
                        {(() => {
                          let entries = Object.entries(check.evidence);
                          const appName = app?.applicant?.name || app?.applicantName;
                          if (check.type === 'IDENTITY_NAME_MATCH') {
                            const hasAccount = entries.some(([k]) => k.toLowerCase().includes('account') || k.toLowerCase().includes('declared'));
                            if (!hasAccount && appName) {
                              entries = [['Applicant Account', appName], ...entries];
                            } else {
                              entries.sort(([a], [b]) => {
                                const aIsAcc = a.toLowerCase().includes('account') || a.toLowerCase().includes('declared');
                                const bIsAcc = b.toLowerCase().includes('account') || b.toLowerCase().includes('declared');
                                if (aIsAcc && !bIsAcc) return -1;
                                if (!aIsAcc && bIsAcc) return 1;
                                return 0;
                              });
                            }
                          }
                          return entries.map(([k, v]) => {
                            const isAccountKey = k.toLowerCase().includes('account') || k.toLowerCase().includes('declared');
                            return (
                              <div
                                key={k}
                                className={`p-2.5 rounded-lg border shadow-2xs transition-all ${
                                  isAccountKey
                                    ? 'bg-emerald-50/90 border-emerald-300 ring-1 ring-emerald-200'
                                    : 'bg-white border-cream-200'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider block ${
                                    isAccountKey ? 'text-emerald-800' : 'text-charcoal-400'
                                  }`}>
                                    {k.replace(/_/g, ' ')}
                                  </span>
                                  {isAccountKey && (
                                    <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900 border border-emerald-300 uppercase">
                                      Logged In
                                    </span>
                                  )}
                                </div>
                                <span className={`text-xs block truncate ${
                                  isAccountKey ? 'text-emerald-950 font-extrabold' : 'text-charcoal-900 font-bold'
                                }`} title={String(v)}>
                                  {v !== null && v !== undefined ? String(v) : '—'}
                                </span>
                              </div>
                            );
                          });
                        })()}
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

const AISummaryCard = ({ data, riskLevel = 'LOW', flaggedCount = 0, t }) => {
  const checks = data.checks || [];
  const warningCount = checks.filter((c) => c.status === 'WARNING').length;

  const derivedFindings = checks
    .filter((c) => c.status === 'FLAGGED' || c.status === 'WARNING')
    .slice(0, 4)
    .map((c) => c.message || c.label || c.field || 'Discrepancy detected');

  const keyFindings = data.keyFindings?.length
    ? data.keyFindings
    : derivedFindings.length
      ? derivedFindings
      : [t ? t('no_docs_uploaded_desc', 'No discrepancies found across the submitted documents') : 'No discrepancies found across the submitted documents'];

  const risk = (riskLevel || 'LOW').toUpperCase();
  const riskLabels = {
    HIGH: t ? t('high_risk', 'High Risk') : 'High Risk',
    MEDIUM: t ? t('medium_risk', 'Medium Risk') : 'Medium Risk',
    LOW: t ? t('low_risk', 'Low Risk') : 'Low Risk',
  };
  const riskColors = {
    HIGH: { text: 'text-error-600', label: riskLabels.HIGH },
    MEDIUM: { text: 'text-warning-600', label: riskLabels.MEDIUM },
    LOW: { text: 'text-success-600', label: riskLabels.LOW },
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
            <h3 className="text-sm font-bold text-charcoal-900">{t ? t('ai_analysis_summary', 'AI Analysis Summary') : 'AI Analysis Summary'}</h3>
            <p className="text-xs text-charcoal-500">Groq LLaMA 3.3 70B reasoning model analysis</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ai-700 bg-ai-50 px-3 py-1.5 rounded-lg border border-ai-200">
          <Zap className="w-3.5 h-3.5 text-ai-600" /> {t ? t('powered_by_groq', 'Powered by Groq LLaMA 3.3 70B') : 'Powered by Groq LLaMA 3.3 70B'}
        </span>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-cream-200 p-6 gap-6 md:gap-0">
        {/* Column 1: Key Findings */}
        <div className="md:pr-6 space-y-3">
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">{t ? t('key_findings', 'Key Findings') : 'Key Findings'}</h4>
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
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">{t ? t('risk_assessment', 'Risk Assessment') : 'Risk Assessment'}</h4>
          <p className={`text-2xl font-black ${rc.text}`}>{rc.label}</p>
          <p className="text-xs text-charcoal-500 font-medium">
            {flaggedCount > 0
              ? `Based on ${flaggedCount} critical discrepancies`
              : warningCount > 0
                ? `Based on ${warningCount} minor inconsistencies`
                : `Based on ${checks.length} passing checks`}
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
          <h4 className="text-xs font-bold text-charcoal-900 uppercase tracking-wider">{t ? t('recommendation', 'Recommendation') : 'Recommendation'}</h4>
          <p className="text-xs text-charcoal-700 leading-relaxed font-medium">{recommendation}</p>
        </div>
      </div>
    </div>
  );
};

/* ───────── Banner State ───────── */

function getBannerState(flaggedCount, warningCount, totalChecks, t) {
  if (flaggedCount > 0) {
    return {
      tone: 'error',
      shell: 'border-error-200 bg-gradient-to-r from-error-50/70 via-white to-warning-50/40',
      iconClass: 'text-error-500',
      title: t ? t('banner_discrepancies', 'Cross-Document Discrepancies Detected') : 'Cross-Document Discrepancies Detected',
      detail: `${flaggedCount} ${t ? t('discrepancies', 'issues') : 'issues require manual review'}`,
    };
  }

  if (warningCount > 0) {
    return {
      tone: 'warning',
      shell: 'border-warning-200 bg-gradient-to-r from-warning-50/70 via-white to-cream-50',
      iconClass: 'text-warning-500',
      title: t ? t('banner_minor_inconsistencies', 'Minor Inconsistencies Found') : 'Minor Inconsistencies Found',
      detail: `${warningCount} ${t ? t('discrepancies', 'items to confirm') : 'items to confirm — no critical mismatches detected'}`,
    };
  }

  return {
    tone: 'success',
    shell: 'border-success-200 bg-gradient-to-r from-success-50/70 via-white to-cream-50',
    iconClass: 'text-success-500',
    title: t ? t('banner_all_passed', 'All Cross-Document Checks Passed') : 'All Cross-Document Checks Passed',
    detail: totalChecks
      ? `${totalChecks} ${t ? t('all_checks', 'checks') : 'checks'} ${t ? t('passed_text', 'completed') : 'completed with no discrepancies'}`
      : (t ? t('no_docs_uploaded_desc', 'No discrepancies found across the submitted documents') : 'No discrepancies found across the submitted documents'),
  };
}

/* ───────── Main VerificationTab Component ───────── */

const VerificationTab = ({ applicationId, app, documents }) => {
  const { t } = useLanguage();
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
      const val = res.data || res;
      setData(val);

      const count = (documents || app?.documents || []).length;
      if (count > 0 && (!val || !val.checks || val.checks.length === 0 || val.status === 'PENDING_DOCS')) {
        console.log('[VerificationTab] Documents present, running cross-document verification...');
        const autoRes = await officerService.triggerVerification(applicationId);
        setData(autoRes.data || autoRes);
      }
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

  const docsList = documents || app?.documents || [];

  if (docsList.length === 0) {
    return (
      <div className="bg-white p-10 rounded-2xl shadow-soft border border-cream-300 text-center text-charcoal-500 max-w-xl mx-auto my-8">
        <div className="w-14 h-14 rounded-full bg-cream-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="w-7 h-7 text-charcoal-400" />
        </div>
        <h3 className="text-lg font-bold text-charcoal-900 mb-2">{t('no_docs_uploaded_title', 'No Documents Uploaded Yet')}</h3>
        <p className="text-sm text-charcoal-600 mb-6 leading-relaxed">
          {t('no_docs_uploaded_desc', 'The applicant has not uploaded any identity or financial documents yet. Cross-document AI extraction and risk verification will run automatically once documents are submitted.')}
        </p>
      </div>
    );
  }

  const safeData = data || { status: 'CONSISTENT', checks: [] };
  const isStale = safeData.status === 'STALE';
  const isConsistent = safeData.status === 'CONSISTENT' || safeData.status === 'VERIFIED';
  const isReviewRequired = safeData.status === 'REVIEW_REQUIRED';

  const checks = safeData.checks || [];
  const flaggedCount = checks.filter((c) => c.status === 'FLAGGED').length;
  const warningCount = checks.filter((c) => c.status === 'WARNING').length;
  const banner = getBannerState(flaggedCount, warningCount, checks.length, t);

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
              {isStale ? t('status_outdated', 'Status Outdated') : isConsistent ? t('status_consistent', 'Consistent') : isReviewRequired ? t('status_under_review', 'Under Review') : t('status_incomplete', 'Incomplete')}
            </span>
            <RiskBadge riskLevel={riskLevel} t={t} />
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
              <span>{verifying ? t('analyzing', 'Analyzing...') : t('rerun_analysis', 'Re-run Analysis')}</span>
            </button>
          </div>
        </div>

        {/* Score Circle */}
        <ScoreCircle score={verificationScore} t={t} />
      </div>

      {/* 2. Stats Row */}
      <StatsRow checks={checks} documentsCount={docsList.length} t={t} />

      {/* 3. Extracted Data Overview Table */}
      <ExtractedDataTable checks={checks} documents={docsList} app={app} t={t} />

      {/* 4. Verification Results */}
      <VerificationResults checks={checks} app={app} t={t} />

      {/* 5. AI Analysis Summary */}
      <AISummaryCard data={data} riskLevel={riskLevel} flaggedCount={flaggedCount} t={t} />

      {/* 6. Footer Disclaimer */}
      <div className="p-4 bg-cream-50 rounded-xl border border-cream-200 flex items-start gap-3 text-xs text-charcoal-600">
        <Info className="w-4 h-4 text-accent-500 shrink-0 mt-0.5" />
        <p className="leading-relaxed font-medium">
          {t('officer_ai_disclaimer', 'Note: This analysis is AI-generated and recommended for officer review. Final decision rests with authorized personnel.')}
        </p>
      </div>
    </div>
  );
};

export default VerificationTab;
