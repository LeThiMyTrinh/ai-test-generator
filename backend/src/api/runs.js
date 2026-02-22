const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const TestRunner = require('../runner/TestRunner');

let io_ref = null;
router.setIO = (io) => { io_ref = io; };

// GET all runs
router.get('/', async (req, res) => {
    try {
        const { suite_id } = req.query;
        const query = suite_id ? { suite_id } : {};
        const runs = await db.runs.find(query).sort({ started_at: -1 }).limit(100);
        res.json(runs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single run with results
router.get('/:id', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const results = await db.results.find({ run_id: req.params.id }).sort({ _id: 1 });
        res.json({ ...run, results });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST start a new run
router.post('/', async (req, res) => {
    try {
        const { suite_id } = req.body;
        if (!suite_id) return res.status(400).json({ error: 'suite_id required' });

        const suite = await db.suites.findOne({ id: suite_id });
        if (!suite) return res.status(404).json({ error: 'Suite not found' });

        const testCases = await db.testCases.find({ suite_id }).sort({ created_at: 1 });
        if (testCases.length === 0) return res.status(400).json({ error: 'Suite has no test cases' });

        const runId = 'RUN-' + Date.now();
        const startedAt = new Date().toISOString();
        await db.runs.insert({ id: runId, suite_id, started_at: startedAt, status: 'RUNNING', summary_json: null });

        res.json({ run_id: runId, status: 'RUNNING' });

        setImmediate(async () => {
            try {
                const runner = new TestRunner({ io: io_ref });
                const { summary, results } = await runner.runSuite(testCases, runId);
                for (const r of results) {
                    await db.results.insert({
                        run_id: runId,
                        test_case_id: r.test_case_id,
                        test_case_title: r.test_case_title,
                        status: r.status,
                        duration_ms: r.duration_ms,
                        error_message: r.error_message || null,
                        steps_result_json: JSON.stringify(r.steps_result),
                        video_path: r.video_path || null
                    });
                }
                await db.runs.update({ id: runId }, { $set: { status: 'DONE', finished_at: new Date().toISOString(), summary_json: JSON.stringify(summary) } });
            } catch (err) {
                await db.runs.update({ id: runId }, { $set: { status: 'ERROR', finished_at: new Date().toISOString() } });
                if (io_ref) io_ref.emit('run_error', { runId, error: err.message });
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
