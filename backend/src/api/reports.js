const express = require('express');
const router = express.Router();
const db = require('../db/database');
const Reporter = require('../reporter/Reporter');

const reporter = new Reporter();

router.get('/:runId/html', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.runId });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const suite = await db.suites.findOne({ id: run.suite_id }) || { name: 'N/A' };
        const results = await db.results.find({ run_id: req.params.runId }).sort({ _id: 1 });
        const { path: htmlPath, filename } = await reporter.generateHTML(run, suite, results);
        res.download(htmlPath, filename);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:runId/pdf', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.runId });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const suite = await db.suites.findOne({ id: run.suite_id }) || { name: 'N/A' };
        const results = await db.results.find({ run_id: req.params.runId }).sort({ _id: 1 });
        const { path: htmlPath } = await reporter.generateHTML(run, suite, results);
        const { path: pdfPath, filename } = await reporter.generatePDF(htmlPath);
        res.download(pdfPath, filename);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:runId/failed/html', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.runId });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const suite = await db.suites.findOne({ id: run.suite_id }) || { name: 'N/A' };
        const results = await db.results.find({ run_id: req.params.runId }).sort({ _id: 1 });
        const failedCount = results.filter(r => r.status === 'FAILED').length;
        if (failedCount === 0) return res.status(400).json({ error: 'Không có test case FAILED nào' });
        const { path: htmlPath, filename } = await reporter.generateFailedHTML(run, suite, results);
        res.download(htmlPath, filename);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /:runId/json — Export run results as JSON
router.get('/:runId/json', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.runId });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const suite = await db.suites.findOne({ id: run.suite_id }) || { name: 'N/A' };
        const results = await db.results.find({ run_id: req.params.runId }).sort({ _id: 1 });

        const summary = run.summary_json ? JSON.parse(run.summary_json) : {};
        const report = {
            run: {
                id: run.id,
                suite_id: run.suite_id,
                suite_name: suite.name,
                status: run.status,
                started_at: run.started_at,
                finished_at: run.finished_at,
                created_by: run.created_by,
                options: run.options,
            },
            summary,
            results: results.map(r => ({
                test_case_id: r.test_case_id,
                test_case_title: r.test_case_title,
                status: r.status,
                duration_ms: r.duration_ms,
                error_message: r.error_message,
                attempt: r.attempt,
                steps: typeof r.steps_result_json === 'string' ? JSON.parse(r.steps_result_json) : r.steps_result_json,
            })),
        };

        res.setHeader('Content-Disposition', `attachment; filename="${run.id}-report.json"`);
        res.setHeader('Content-Type', 'application/json');
        res.json(report);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /:runId/junit — Export as JUnit XML format (for CI/CD integration)
router.get('/:runId/junit', async (req, res) => {
    try {
        const run = await db.runs.findOne({ id: req.params.runId });
        if (!run) return res.status(404).json({ error: 'Not found' });
        const suite = await db.suites.findOne({ id: run.suite_id }) || { name: 'N/A' };
        const results = await db.results.find({ run_id: req.params.runId }).sort({ _id: 1 });

        const summary = run.summary_json ? JSON.parse(run.summary_json) : {};
        const duration = run.finished_at && run.started_at
            ? (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
            : 0;

        const escXml = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += `<testsuites name="${escXml(suite.name)}" tests="${summary.total || results.length}" failures="${summary.failed || 0}" time="${duration.toFixed(2)}" timestamp="${run.started_at}">\n`;
        xml += `  <testsuite name="${escXml(suite.name)}" tests="${results.length}" failures="${results.filter(r => r.status === 'FAILED').length}" time="${duration.toFixed(2)}">\n`;

        for (const r of results) {
            const tcDuration = (r.duration_ms || 0) / 1000;
            xml += `    <testcase name="${escXml(r.test_case_title)}" classname="${escXml(r.test_case_id)}" time="${tcDuration.toFixed(2)}">\n`;

            if (r.status === 'FAILED') {
                xml += `      <failure message="${escXml(r.error_message)}" type="AssertionError">\n`;
                xml += `        ${escXml(r.error_message)}\n`;
                // Include step details
                const steps = typeof r.steps_result_json === 'string' ? JSON.parse(r.steps_result_json) : r.steps_result_json;
                if (Array.isArray(steps)) {
                    const failedSteps = steps.filter(s => s.status === 'FAILED');
                    for (const s of failedSteps) {
                        xml += `        Step ${s.step_id} [${s.action}]: ${escXml(s.error)}\n`;
                    }
                }
                xml += `      </failure>\n`;
            }

            if (r.status === 'CANCELLED') {
                xml += `      <skipped message="Test was cancelled" />\n`;
            }

            xml += `    </testcase>\n`;
        }

        xml += `  </testsuite>\n`;
        xml += `</testsuites>\n`;

        res.setHeader('Content-Disposition', `attachment; filename="${run.id}-junit.xml"`);
        res.setHeader('Content-Type', 'application/xml');
        res.send(xml);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
