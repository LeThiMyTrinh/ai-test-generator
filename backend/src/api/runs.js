const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const TestRunner = require('../runner/TestRunner');
const fs = require('fs');
const path = require('path');

const visualRegression = require('../runner/VisualRegression');
const EVIDENCE_BASE = path.join(__dirname, '../../../evidence');

let io_ref = null;
router.setIO = (io) => { io_ref = io; };

// GET all runs
router.get('/', async (req, res) => {
    try {
        const { suite_id, limit = 100, skip = 0 } = req.query;
        let query = suite_id ? { suite_id } : {};
        if (req.user.role !== 'ADMIN') {
            query.created_by = req.user.email;
        }
        const runs = await db.runs.find(query).sort({ started_at: -1 }).skip(parseInt(skip)).limit(parseInt(limit));
        const total = await db.runs.count(query);
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
        const { suite_id, test_case_ids, continueOnFailure, retryCount, concurrency } = req.body;
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
        await db.runs.insert({
            id: runId, suite_id, created_by: req.user.email, started_at: startedAt, status: 'RUNNING', summary_json: null,
            options: { continueOnFailure: !!continueOnFailure, retryCount: parseInt(retryCount) || 0, concurrency: parseInt(concurrency) || 1 }
        });

        res.json({ run_id: runId, status: 'RUNNING', total: testCases.length });

        setImmediate(async () => {
            try {
                const runner = new TestRunner({
                    io: io_ref,
                    continueOnFailure: !!continueOnFailure,
                    retryCount: parseInt(retryCount) || 0,
                    concurrency: parseInt(concurrency) || 1,
                });
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
                        video_path: r.video_path || null,
                        attempt: r.attempt || 1,
                    });
                }
                const finalStatus = runner._cancelled ? 'CANCELLED' : 'DONE';
                await db.runs.update({ id: runId }, { $set: { status: finalStatus, finished_at: new Date().toISOString(), summary_json: JSON.stringify(summary) } });
            } catch (err) {
                await db.runs.update({ id: runId }, { $set: { status: 'ERROR', finished_at: new Date().toISOString() } });
                if (io_ref) io_ref.emit('run_error', { runId, error: err.message });
            }
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST cancel a running test
router.post('/:id/cancel', async (req, res) => {
    try {
        const runner = TestRunner.getActiveRunner(req.params.id);
        if (!runner) return res.status(404).json({ error: 'Run không đang chạy hoặc không tìm thấy' });
        runner.cancel();
        res.json({ success: true, message: 'Đã gửi yêu cầu hủy' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST pause a running test
router.post('/:id/pause', async (req, res) => {
    try {
        const runner = TestRunner.getActiveRunner(req.params.id);
        if (!runner) return res.status(404).json({ error: 'Run không đang chạy' });
        runner.pause();
        res.json({ success: true, message: 'Đã tạm dừng' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST resume a paused test
router.post('/:id/resume', async (req, res) => {
    try {
        const runner = TestRunner.getActiveRunner(req.params.id);
        if (!runner) return res.status(404).json({ error: 'Run không đang chạy' });
        runner.resume();
        res.json({ success: true, message: 'Đã tiếp tục' });
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
        const options = originalRun.options || {};
        await db.runs.insert({
            id: runId, suite_id: originalRun.suite_id, created_by: req.user.email,
            started_at: startedAt, status: 'RUNNING', summary_json: null,
            parent_run_id: req.params.runId, options
        });

        res.json({ run_id: runId, parent_run_id: req.params.runId, status: 'RUNNING', total: testCases.length, failed_tc_ids: failedTcIds });

        setImmediate(async () => {
            try {
                const runner = new TestRunner({
                    io: io_ref,
                    continueOnFailure: !!options.continueOnFailure,
                    retryCount: parseInt(options.retryCount) || 0,
                    concurrency: parseInt(options.concurrency) || 1,
                });
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
                        video_path: r.video_path || null,
                        attempt: r.attempt || 1,
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

        res.json({ run_id: req.params.id, parent_run_id: run.parent_run_id, comparison });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ===== VISUAL REGRESSION ENDPOINTS =====

// POST save baselines from a run
router.post('/:id/save-baseline', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Run not found' });
        const results = await db.results.find({ run_id: req.params.id });
        let saved = 0;
        for (const r of results) {
            const steps = typeof r.steps_result_json === 'string' ? JSON.parse(r.steps_result_json) : (r.steps_result_json || []);
            for (const step of steps) {
                if (step.screenshot) {
                    const absPath = path.join(__dirname, '../../../', step.screenshot);
                    if (fs.existsSync(absPath)) {
                        await visualRegression.saveBaseline(run.suite_id, r.test_case_id, step.step_id, absPath);
                        saved++;
                    }
                }
            }
        }
        res.json({ success: true, saved, message: `Đã lưu ${saved} baseline screenshots` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST compare a run against baselines
router.post('/:id/visual-compare', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Run not found' });
        const dbResults = await db.results.find({ run_id: req.params.id });

        // Flatten DB results into per-step objects that compareRun expects
        const flatSteps = [];
        for (const r of dbResults) {
            const steps = typeof r.steps_result_json === 'string'
                ? JSON.parse(r.steps_result_json)
                : (r.steps_result_json || []);
            for (const step of steps) {
                if (step.screenshot) {
                    const absPath = path.join(__dirname, '../../../', step.screenshot);
                    flatSteps.push({
                        tc_id: r.test_case_id,
                        test_case_title: r.test_case_title,
                        step_id: step.step_id,
                        screenshotPath: absPath,
                    });
                }
            }
        }

        if (flatSteps.length === 0) {
            return res.json({ results: [], message: 'Không tìm thấy screenshot nào để so sánh' });
        }

        const comparisons = await visualRegression.compareRun(run.suite_id, flatSteps, path.join(__dirname, '../../../'));

        // Enrich comparisons with test_case_title and convert paths to relative
        const rootDir = path.join(__dirname, '../../../');
        const enriched = comparisons.map((c, i) => ({
            test_case_id: flatSteps[i].tc_id,
            test_case_title: flatSteps[i].test_case_title,
            step_id: c.step_id,
            match: c.status === 'match',
            diff_percent: c.matchPercent !== undefined ? (100 - c.matchPercent) : 0,
            baseline_path: c.baselinePath ? path.relative(rootDir, c.baselinePath).replace(/\\/g, '/') : null,
            current_path: c.currentPath ? path.relative(rootDir, c.currentPath).replace(/\\/g, '/') : null,
            diff_path: c.diffImagePath ? path.relative(rootDir, c.diffImagePath).replace(/\\/g, '/') : null,
            status: c.status,
        }));

        await db.runs.update({ id: req.params.id }, { $set: { visual_regression: enriched } });
        res.json({ results: enriched });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST accept a visual change (update baseline)
router.post('/:id/visual-accept', async (req, res) => {
    try {
        const { test_case_id, step_id } = req.body;
        if (!test_case_id || !step_id) return res.status(400).json({ error: 'test_case_id and step_id required' });
        const run = await db.runs.findOne({ id: req.params.id });
        if (!run) return res.status(404).json({ error: 'Run not found' });
        const result = await db.results.findOne({ run_id: req.params.id, test_case_id });
        if (!result) return res.status(404).json({ error: 'Result not found' });
        const steps = typeof result.steps_result_json === 'string' ? JSON.parse(result.steps_result_json) : (result.steps_result_json || []);
        const step = steps.find(s => s.step_id == step_id);
        if (!step || !step.screenshot) return res.status(404).json({ error: 'Screenshot not found for step' });
        const absPath = path.join(__dirname, '../../../', step.screenshot);
        await visualRegression.acceptChange(run.suite_id, test_case_id, step_id, absPath);
        res.json({ success: true, message: 'Baseline updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET baseline info for a test case
router.get('/baselines/:suiteId/:tcId', async (req, res) => {
    try {
        const info = visualRegression.getBaselineInfo(req.params.suiteId, req.params.tcId);
        const has = visualRegression.hasBaseline(req.params.suiteId, req.params.tcId);
        res.json({ hasBaseline: has, baselines: info });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
