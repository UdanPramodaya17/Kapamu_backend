const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('../controllers/ai.controller');

// Memory storage for fast image processing without disk I/O
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

// POST /api/ai/predict
router.post('/predict', upload.single('file'), aiController.predictFaceShape);

module.exports = router;
