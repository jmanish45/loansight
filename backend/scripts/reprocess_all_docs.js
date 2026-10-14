const mongoose = require('mongoose');
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}

const connectDB = require('../src/config/db');
const Document = require('../src/models/Document');
const LoanApplication = require('../src/models/LoanApplication');
const aiService = require('../src/services/aiService');

async function reprocessAll() {
  await connectDB();
  console.log('Connecting to database...');

  const docs = await Document.find({});
  console.log(`Found ${docs.length} total documents.`);

  for (const doc of docs) {
    doc.ocr = doc.ocr || {};
    doc.ocr.status = 'pending';
    doc.aiProcessing = doc.aiProcessing || {};
    doc.aiProcessing.status = 'pending';
    doc.aiProcessing.extractedData = null;
    doc.aiProcessing.fileHash = null;
    doc.aiProcessing.promptVersion = null;
    await doc.save();
    
    console.log(`Re-queuing doc: ${doc.originalName} (${doc._id})`);
    await aiService.processDocument(doc._id);
  }

  console.log('✅ Re-processing queued for all documents!');
  setTimeout(() => process.exit(0), 4000);
}

reprocessAll().catch(err => {
  console.error(err);
  process.exit(1);
});
