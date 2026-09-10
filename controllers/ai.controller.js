const axios = require('axios');
const FormData = require('form-data');

// Python AI service URL — set AI_SERVICE_URL in your .env, defaults to local dev port
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Predict face shape and return personalized hairstyle recommendations.
 * Proxies the uploaded image to the Python FastAPI AI service (/predict).
 */
exports.predictFaceShape = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: true,
        code: 'no_file',
        message: 'No image file uploaded. Please attach a face photo.',
      });
    }

    const gender = (req.body.gender || 'all').toLowerCase();

    // Build multipart/form-data for the Python AI service
    const form = new FormData();
    form.append('file', req.file.buffer, {
      filename: req.file.originalname || 'upload.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });
    form.append('gender', gender);

    // Forward to the Python FastAPI AI service
    const aiRes = await axios.post(`${AI_SERVICE_URL}/predict`, form, {
      headers: {
        ...form.getHeaders(),
      },
      timeout: 60000, // 60s — model inference can be slow on cold start
      // Axios treats 4xx/5xx as errors by default, but the AI service
      // returns structured JSON error bodies even on 4xx/5xx.
      // We validate ourselves so we can pass the JSON back cleanly.
      validateStatus: () => true,
    });

    const data = aiRes.data;

    // Pass through error responses from the AI service with their status code
    if (data?.error) {
      return res.status(aiRes.status >= 400 ? aiRes.status : 422).json(data);
    }

    return res.status(200).json(data);
  } catch (error) {
    // Network-level failure (AI service unreachable / timed out)
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        error: true,
        code: 'ai_service_unavailable',
        message: 'AI analysis service is currently unavailable. Please try again later.',
      });
    }
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: true,
        code: 'ai_service_timeout',
        message: 'AI analysis timed out — the model may be loading. Please try again in a moment.',
      });
    }
    next(error);
  }
};
