'use strict';

const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');
const sharp = require('sharp');

const uploadDir = path.join(__dirname, '..', '..', 'public', 'img');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  cb(null, allowed.includes(file.mimetype));
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter,
});

async function processUploadedImage(file) {
  if (!file) return null;
  const targetFilename = `${path.parse(file.filename).name}-optimized.jpg`;
  const targetPath = path.join(uploadDir, targetFilename);

  try {
    await sharp(file.path)
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toFile(targetPath);
  } catch (error) {
    try {
      fs.unlinkSync(targetPath);
    } catch {}
    throw error;
  } finally {
    try {
      fs.unlinkSync(file.path);
    } catch {}
  }

  return `/img/${path.basename(targetPath)}`;
}

module.exports = { upload, processUploadedImage };
