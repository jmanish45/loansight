const mongoose = require('mongoose');

const evidenceSideSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      required: true,
    },
    values: [
      {
        type: String,
      },
    ],
  },
  { _id: false }
);

const checkSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
    },
    status: {
      type: String,
      enum: ['PASSED', 'WARNING', 'FLAGGED'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    sourceA: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sourceB: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const findingSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    severity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      required: true,
    },
    explanation: {
      type: [String],
      default: [],
    },
    documents: [
      {
        type: String,
      },
    ],
    sourceA: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    sourceB: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  { _id: false }
);

const validationResultSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
      unique: true,
    },
    status: {
      type: String,
      enum: ['CONSISTENT', 'REVIEW_REQUIRED', 'INCOMPLETE', 'VERIFIED', 'PENDING_DOCS', 'STALE'],
      default: 'PENDING_DOCS',
    },
    overallSeverity: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
    },
    summary: {
      type: String,
      default: null,
    },
    riskLevel: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH'],
      default: 'LOW',
    },
    verificationScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50,
    },
    keyFindings: [
      {
        type: String,
      },
    ],
    findings: [findingSchema],
    recommendedAction: {
      type: String,
      default: null,
    },
    checks: [checkSchema],
    validatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

validationResultSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const ValidationResult = mongoose.model('ValidationResult', validationResultSchema);

module.exports = ValidationResult;
