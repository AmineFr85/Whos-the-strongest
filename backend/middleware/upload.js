// backend/middleware/upload.js
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');

const UPLOAD_DIR = path.join(__dirname, '../../frontend/public/uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, file, cb) => {
    const u = Date.now() + '-' + Math.round(Math.random() * 1e6);
    cb(null, u + path.extname(file.originalname).toLowerCase());
  },
});

const fileFilter = (_req, file, cb) => {
  const ok = /image\/(jpeg|jpg|png|gif|webp)|video\/(mp4|webm|ogg)|audio\/(mpeg|wav|ogg|mp4)/;
  ok.test(file.mimetype) ? cb(null, true) : cb(new Error('Type non autorisé'), false);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 50 * 1024 * 1024 } });
