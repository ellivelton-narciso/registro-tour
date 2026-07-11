const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const CHAMPIONS_GEN = 9;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function getTeamImagesDir() {
  const dir = process.env.TEAM_IMAGES_DIR || path.join(__dirname, '..', 'uploads', 'team-images');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function isChampionsGen(gen) {
  return Number(gen) === CHAMPIONS_GEN;
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, getTeamImagesDir());
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.png';
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${safeExt}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter(_req, file, cb) {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('Formato inválido. Use PNG, JPEG ou WebP.'));
    }
    cb(null, true);
  }
});

function resolveTeamImagePath(filename) {
  if (!filename || typeof filename !== 'string') return null;
  const base = path.basename(filename);
  if (base !== filename || base.includes('..')) return null;
  const fullPath = path.join(getTeamImagesDir(), base);
  if (!fs.existsSync(fullPath)) return null;
  return fullPath;
}

module.exports = {
  CHAMPIONS_GEN,
  upload,
  getTeamImagesDir,
  isChampionsGen,
  resolveTeamImagePath
};
