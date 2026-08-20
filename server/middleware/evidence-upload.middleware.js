const multer = require('multer');
const { AppError } = require('../utils/http-error');
const {
  MAX_EVIDENCE_FILES,
  MAX_EVIDENCE_FILE_SIZE_BYTES,
  ALLOWED_EVIDENCE_TYPES
} = require('../config/evidence');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: MAX_EVIDENCE_FILES,
    fileSize: MAX_EVIDENCE_FILE_SIZE_BYTES,
    parts: MAX_EVIDENCE_FILES + 1
  },
  fileFilter: (_request, file, callback) => {
    if (!ALLOWED_EVIDENCE_TYPES.has(file.mimetype)) {
      return callback(new AppError(400, 'INVALID_EVIDENCE_TYPE', 'Only JPEG, PNG and WebP images are allowed'));
    }

    return callback(null, true);
  }
});

function uploadEvidenceFiles(request, response, next) {
  upload.array('evidence', MAX_EVIDENCE_FILES)(request, response, (error) => {
    if (!error) return next();
    if (error instanceof AppError) return next(error);

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(400, 'EVIDENCE_FILE_TOO_LARGE', `Each evidence image must be smaller than ${MAX_EVIDENCE_FILE_SIZE_BYTES / (1024 * 1024)} MB`));
      }

      if (error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE') {
        return next(new AppError(400, 'EVIDENCE_LIMIT_REACHED', `A report can contain at most ${MAX_EVIDENCE_FILES} evidence files`));
      }

      return next(new AppError(400, 'INVALID_EVIDENCE_UPLOAD', 'The evidence upload could not be processed'));
    }

    return next(new AppError(400, 'INVALID_EVIDENCE_UPLOAD', 'The evidence upload could not be processed'));
  });
}

module.exports = { uploadEvidenceFiles };
