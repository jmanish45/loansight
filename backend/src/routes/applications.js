const express = require('express');
const {
  createApplication,
  getApplications,
  getApplication,
  getNotifications,
  uploadApplicationDocument,
  submitApplication
} = require('../controllers/applicationController');
const { validateApplication } = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.use(protect); // All application routes require authentication

router.post('/', validateApplication, createApplication);
router.get('/', getApplications);
// Declared before '/:id' so the literal path is not read as an application id.
router.get('/notifications', getNotifications);
router.get('/:id', getApplication);
router.post('/:id/documents', upload.single('file'), upload.validateUploadedFile, uploadApplicationDocument);
router.post('/:id/submit', submitApplication);

module.exports = router;
