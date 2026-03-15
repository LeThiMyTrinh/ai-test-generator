const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const TestRunner = require('../runner/TestRunner');
const fs = require('fs');
const path = require('path');

const EVIDENCE_BASE = path.join(__dirname, '../../../evidence');

let io_ref = null;
router.setIO = (io) => { io_ref = io; };

// GET all runs
router.get('/', async (req, res) => {
    try {
        const { suite_id } = req.query;
        let query = suite_id ? { suite_id } : {};
        if (req.user.role !== 'ADMIN') {
            query.created_by = req.user.email;
        }
        const runs = await db.runs.find(query).sort({ started_at: -1 }).limit(100);
        res.json(runs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single run with results
router.get('/:id', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'ADMIN' && run.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        const results = await db.results.find({ run_id: req.params.id }).sort({ _id: 1 });
        res.json({ ...run, results });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST start a new run
router.post('/', async (req, res) => {
    try {
        const { suite_id, test_case_ids } = req.body;
        if (!suite_id) return res.status(400).json({ error: 'suite_id required' });

        const suite = await db.suites.findOne({ id: suite_id });
        if (!suite) return res.status(404).json({ error: 'Suite not found' });

        let testCases = await db.testCases.find({ suite_id }).sort({ created_at: 1 });
        if (testCases.length === 0) return res.status(400).json({ error: 'Suite has no test cases' });

        if (Array.isArray(test_case_ids) && test_case_ids.length > 0) {
            testCases = testCases.filter(tc => test_case_ids.includes(tc.id));
            if (testCases.length === 0) return res.status(400).json({ error: 'Không có test case hợp lệ nào được chọn' });
        }

        const runId = 'RUN-' + Date.now();
        const startedAt = new Date().toISOString();
        await db.runs.insert({ id: runId, suite_id, created_by: req.user.email, started_at: startedAt, status: 'RUNNING', summary_json: null });

        res.json({ run_id: runId, status: 'RUNNING', total: testCases.length });

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

// Helper: delete a single run and its associated data
async function deleteRunData(runId) {
    await db.runs.remove({ id: runId }, {});
    const removedResults = await db.results.remove({ run_id: runId }, { multi: true });
    const evidenceDir = path.join(EVIDENCE_BASE, runId);
    if (fs.existsSync(evidenceDir)) {
        fs.rmSync(evidenceDir, { recursive: true, force: true });
    }
    return removedResults;
}

// DELETE single run
router.delete('/:id', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Run not found' });
        if (req.user.role !== 'ADMIN' && run.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        await deleteRunData(req.params.id);
        res.json({ deleted: 1, id: req.params.id });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST bulk delete runs
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array required' });
        }
        let deleted = 0;
        for (const id of ids) {
            const run = await db.runs.findOne({ id });
            if (run) {
                if (req.user.role !== 'ADMIN' && run.created_by !== req.user.email) continue;
                await deleteRunData(id);
                deleted++;
            }
        }
        res.json({ deleted });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH update priority for a specific result
router.patch('/:runId/results/:testCaseId/priority', async (req, res) => {
    try {
        const { priority } = req.body;
        const validPriorities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
        if (!priority || !validPriorities.includes(priority)) {
            return res.status(400).json({ error: 'Priority phải là CRITICAL, HIGH, MEDIUM hoặc LOW' });
        }
        const result = await db.results.findOne({ run_id: req.params.runId, test_case_id: req.params.testCaseId });
        if (!result) return res.status(404).json({ error: 'Result not found' });

        await db.results.update(
            { run_id: req.params.runId, test_case_id: req.params.testCaseId },
            { $set: { priority } }
        );
        res.json({ success: true, priority });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST rerun only FAILED test cases from a previous run
router.post('/rerun-failed/:runId', async (req, res) => {
    try {
        const originalRun = await db.runs.findOne({ id: req.params.runId });
        if (!originalRun) return res.status(404).json({ error: 'Run not found' });
        if (req.user.role !== 'ADMIN' && originalRun.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });

        const originalResults = await db.results.find({ run_id: req.params.runId });
        const failedTcIds = originalResults.filter(r => r.status === 'FAILED').map(r => r.test_case_id);

        if (failedTcIds.length === 0) return res.status(400).json({ error: 'Không có test case FAILED nào để chạy lại' });

        let testCases = await db.testCases.find({ suite_id: originalRun.suite_id });
        testCases = testCases.filter(tc => failedTcIds.includes(tc.id));

        if (testCases.length === 0) return res.status(400).json({ error: 'Không tìm thấy test case tương ứng trong suite' });

        const runId = 'RUN-' + Date.now();
        const startedAt = new Date().toISOString();
        await db.runs.insert({
            id: runId,
            suite_id: originalRun.suite_id,
            created_by: req.user.email,
            started_at: startedAt,
            status: 'RUNNING',
            summary_json: null,
            parent_run_id: req.params.runId
        });

        res.json({ run_id: runId, parent_run_id: req.params.runId, status: 'RUNNING', total: testCases.length, failed_tc_ids: failedTcIds });

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

// GET comparison between a re-run and its parent run
router.get('/:id/comparison', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Run not found' });
        if (!run.parent_run_id) return res.status(400).json({ error: 'Run này không phải là lần chạy lại (không có parent_run_id)' });

        const oldResults = await db.results.find({ run_id: run.parent_run_id });
        const newResults = await db.results.find({ run_id: req.params.id });

        const comparison = newResults.map(nr => {
            const oldResult = oldResults.find(or => or.test_case_id === nr.test_case_id);
            return {
                test_case_id: nr.test_case_id,
                title: nr.test_case_title,
                old_status: oldResult ? oldResult.status : 'N/A',
                new_status: nr.status,
                verdict: nr.status === 'PASSED' ? 'FIXED' : 'STILL_FAILED'
            };
        });

        res.json({
            run_id: req.params.id,
            parent_run_id: run.parent_run_id,
            comparison
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
