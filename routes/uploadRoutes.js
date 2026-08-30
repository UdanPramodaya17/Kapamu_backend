const express = require('express');
const router = express.Router();
const { upload } = require('../utils/cloudinary');
const { protect } = require('../middleware/auth');

// Upload a single file
router.post('/', protect, upload.single('image'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Return the image URL
    res.status(200).json({
      success: true,
      data: {
        url: req.file.path,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

// Upload multiple files 
router.post('/multiple', protect, upload.array('images', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded' });
    }
    
    const urls = req.files.map(file => ({
      url: file.path,
      filename: file.filename
    }));

    res.status(200).json({
      success: true,
      data: urls
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ success: false, message: 'Upload failed', error: error.message });
  }
});

module.exports = router;
