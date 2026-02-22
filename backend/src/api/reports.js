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

module.exports = router;
