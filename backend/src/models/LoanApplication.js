const mongoose = require('mongoose');

const LOAN_TYPES = ['home', 'personal', 'auto', 'education', 'business', 'vehicle', 'lap'];
const EMPLOYMENT_TYPES = ['salaried', 'self-employed', 'business-owner'];
const APPLICATION_STATUSES = ['draft', 'submitted', 'documents_pending', 'documents_required', 'under_review', 'approved', 'rejected', 'withdrawn'];

const loanApplicationSchema = new mongoose.Schema(
  {
    applicant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    bankId: {
      type: String,
      default: 'hdfc',
      trim: true,
    },
    bankName: {
      type: String,
      default: 'HDFC Bank',
      trim: true,
    },
    loanType: {
      type: String,
      required: [true, 'Loan type is required'],
      enum: LOAN_TYPES,
    },
    requestedAmount: {
      type: Number,
      required: [true, 'Requested amount is required'],
      min: [10000, 'Minimum loan amount is 10,000'],
    },
    tenureMonths: {
      type: Number,
      required: [true, 'Tenure is required'],
      min: [6, 'Minimum tenure is 6 months'],
      max: [360, 'Maximum tenure is 360 months'],
    },
    employmentType: {
      type: String,
      required: [true, 'Employment type is required'],
      enum: EMPLOYMENT_TYPES,
    },
    declaredMonthlyIncome: {
      type: Number,
      required: [true, 'Monthly income is required'],
      min: [1000, 'Minimum monthly income is 1,000'],
    },
    status: {
      type: String,
      enum: APPLICATION_STATUSES,
      default: 'draft',
    },
    documents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
      },
    ],
    // Soft-delete / archival. Applications are NEVER hard-deleted (that would
    // destroy the audit trail); they are flagged archived and hidden from the
    // active queues instead. Documents, notes, activity and validation history
    // are all preserved.
    archived: {
      type: Boolean,
      default: false,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

loanApplicationSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const LoanApplication = mongoose.model('LoanApplication', loanApplicationSchema);

module.exports = LoanApplication;
