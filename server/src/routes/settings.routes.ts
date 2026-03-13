import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import {
  getPublicSettings,
  updateIdentity,
  uploadLogo,
  removeLogo,
  selectAccentColor,
} from '../controllers/settingsController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateIdentitySchema } from '../validators/settings.validator.js';

const router: Router = Router();

// Multer config for logo upload
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.resolve('uploads'));
  },
  filename: (_req, file, cb) => {
    const uniqueName = `logo-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .png, .jpg, and .webp files are allowed'));
    }
  },
});

// Public
router.get('/public', getPublicSettings);

// Protected
router.put('/identity', authenticate, authorize('REGISTRAR'), validate(updateIdentitySchema), updateIdentity);
router.post('/logo', authenticate, authorize('REGISTRAR'), upload.single('logo'), uploadLogo);
router.delete('/logo', authenticate, authorize('REGISTRAR'), removeLogo);
router.put('/accent', authenticate, authorize('REGISTRAR'), selectAccentColor);

export default router;
