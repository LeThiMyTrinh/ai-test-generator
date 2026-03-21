const express = require('express');
const router = express.Router();
const Recorder = require('../runner/Recorder');

// POST /api/recorder/start — Start a new recording session
router.post('/start', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'url is required' });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const sessionId = await Recorder.start(url);
    res.json({ sessionId });
  } catch (err) {
    const status = err.message.includes('Maximum concurrent') ? 429 : 500;
    res.status(status).json({ error: err.message });
  }
});

// POST /api/recorder/stop — Stop a recording session and return captured steps
router.post('/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const steps = await Recorder.stop(sessionId);
    res.json({ sessionId, steps });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/recorder/steps/:sessionId — Get current steps for an active session
router.get('/steps/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const steps = Recorder.getSteps(sessionId);
    res.json({ sessionId, steps });
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// GET /api/recorder/sessions — List all active recording sessions
router.get('/sessions', (req, res) => {
  try {
    const sessions = Recorder.getSessions();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
