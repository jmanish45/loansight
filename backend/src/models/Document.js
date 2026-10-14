const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
  {
    application: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LoanApplication',
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    documentType: {
      type: String,
      required: true,
      enum: ['payment_slip', 'salary_slip', 'bank_statement', 'form16', 'pan', 'aadhaar', 'property_document', 'other'],
    },
    originalName: {
      type: String,
      required: true,
    },
    filename: {
      type: String,
      required: true,
    },
    path: {
      type: String,
      required: true,
    },
    mimetype: {
      type: String,
      required: true,
    },
    size: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending_review', 'approved', 'rejected', 'superseded'],
      default: 'pending_review',
    },
    reviewComment: {
      type: String,
      default: null,
      trim: true,
    },
    // Local OCR fields
    ocr: {
      text: {
        type: String,
        default: null,
      },
      engine: {
        type: String,
        default: null,
      },
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending',
      },
      processedAt: {
        type: Date,
        default: null,
      },
    },
    // AI Document Intelligence fields
    aiProcessing: {
      status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'retry_pending'],
        default: 'pending',
      },
      predictedType: {
        type: String,
        enum: [
          'PAN',
          'AADHAAR',
          'SALARY_SLIP',
          'PAYMENT_SLIP',
          'BANK_STATEMENT',
          'FORM_16',
          'FORM16',
          'PROPERTY_DOCUMENT',
          'SUPPORTING_DOC',
          'IDENTITY_RECORD',
          'OTHER',
          'UNKNOWN',
        ],
        default: null,
      },
      confidence: {
        type: Number,
        min: 0,
        max: 1,
        default: null,
      },
      extractionMethod: {
        type: String,
        enum: ['native', 'ocr', null],
        default: null,
      },
      extractedData: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
      },
      processedAt: {
        type: Date,
        default: null,
      },
      processingError: {
        type: String,
        default: null,
      },
      // Optimization fields
      fileHash: {
        type: String,
        default: null,
      },
      retryCount: {
        type: Number,
        default: 0,
      },
      promptVersion: {
        type: String,
        default: null,
      },
      documentTypeMatch: {
        type: Boolean,
        default: null,
      },
      geminiCallsMade: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

documentSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.__v;
  return obj;
};

const Document = mongoose.model('Document', documentSchema);

module.exports = Document;
