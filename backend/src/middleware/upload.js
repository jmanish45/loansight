const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ApiError = require('../utils/ApiError');

const uploadDir = path.join(__dirname, '../../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const ALLOWED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];

const fileFilter = (req, file, cb) => {
  // First pass: cheap declared-mimetype + extension check. This runs BEFORE the
  // file is written to disk, so it rejects obvious bad types early. It is NOT
  // sufficient on its own — mimetype and extension are both attacker-controlled,
  // which is why validateUploadedFile below verifies real content bytes.
  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (allowedTypes.includes(file.mimetype) && ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, JPEG, and PNG are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Magic-byte (file signature) definitions. The stored file must actually BE
// one of these types — a renamed executable or a spoofed mimetype will not
// carry a valid signature and is rejected + deleted.
const SIGNATURES = [
  {
    // "%PDF"
    ext: ['.pdf'],
    mimes: ['application/pdf'],
    test: (b) => b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
  },
  {
    // JPEG: FF D8 FF
    ext: ['.jpg', '.jpeg'],
    mimes: ['image/jpeg'],
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    // PNG: 89 50 4E 47 0D 0A 1A 0A
    ext: ['.png'],
    mimes: ['image/png'],
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
      b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
];

/**
 * Post-upload content validation middleware.
 *
 * multer has already written the file to disk by the time this runs, so we read
 * the leading bytes and confirm the real content matches an allowed type AND
 * agrees with BOTH the declared mimetype and the file extension. Any mismatch
 * (e.g. `virus.exe` renamed to `payslip.pdf`, or a PDF sent as `image/png`)
 * causes the file to be deleted and the request rejected with 400.
 */
const validateUploadedFile = (req, res, next) => {
  if (!req.file) return next();

  const removeFile = () => {
    try {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    } catch (err) {
      console.error(`[upload] Failed to remove rejected file ${req.file.path}:`, err.message);
    }
  };

  let fd;
  try {
    const buffer = Buffer.alloc(8);
    fd = fs.openSync(req.file.path, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
    fs.closeSync(fd);
    fd = undefined;

    const bytes = buffer.subarray(0, bytesRead);
    const ext = path.extname(req.file.originalname || req.file.filename || '').toLowerCase();
    const match = SIGNATURES.find((sig) => sig.test(bytes));

    const contentOk = Boolean(match);
    const extOk = match && match.ext.includes(ext);
    const mimeOk = match && match.mimes.includes(req.file.mimetype);

    if (!contentOk || !extOk || !mimeOk) {
      removeFile();
      return next(new ApiError(400, 'File content does not match an allowed PDF, JPEG, or PNG file.'));
    }

    return next();
  } catch (err) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_) { /* ignore */ }
    }
    removeFile();
    return next(new ApiError(400, 'Uploaded file could not be validated.'));
  }
};

module.exports = upload;
module.exports.validateUploadedFile = validateUploadedFile;
