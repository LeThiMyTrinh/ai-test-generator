const express = require('express');
const router = express.Router();
const FlakyDetector = require('../analytics/FlakyDetector');
const TestPrioritizer = require('../analytics/TestPrioritizer');
const db = require('../db/database');

const flakyDetector = new FlakyDetector();
const prioritizer = new TestPrioritizer();

// GET /api/analytics/flaky/:suiteId — Flaky test analysis for a suite
router.get('/flaky/:suiteId', async (req, res) => {
    try {
        const results = await flakyDetector.analyzeSuite(req.params.suiteId);
        const flakyTests = results.filter(r => r.isFlaky);
        res.json({
            total: results.length,
            flakyCount: flakyTests.length,
            tests: results,
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/flaky/tc/:testCaseId — Flaky analysis for a single test case
router.get('/flaky/tc/:testCaseId', async (req, res) => {
    try {
        const result = await flakyDetector.analyze(req.params.testCaseId);
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/priority/:suiteId — Smart test prioritization
router.get('/priority/:suiteId', async (req, res) => {
    try {
        const results = await prioritizer.prioritize(req.params.suiteId);
        res.json(results);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/health/:suiteId — Suite health summary
router.get('/health/:suiteId', async (req, res) => {
    try {
        const health = await prioritizer.getSuiteHealth(req.params.suiteId);
        res.json(health);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/trends/:suiteId — Run trends over time
router.get('/trends/:suiteId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const runs = await db.runs.find({ suite_id: req.params.suiteId })
            .sort({ started_at: -1 })
            .limit(limit);

        const trends = runs.map(r => {
            const summary = typeof r.summary_json === 'string' ? JSON.parse(r.summary_json) : r.summary_json;
            return {
                runId: r.id,
                date: r.started_at,
                status: r.status,
                passed: summary?.passed || 0,
                failed: summary?.failed || 0,
                total: summary?.total || 0,
                passRate: summary?.total ? Math.round(((summary?.passed || 0) / summary.total) * 100) : 0,
                duration: r.finished_at && r.started_at
                    ? new Date(r.finished_at).getTime() - new Date(r.started_at).getTime()
                    : null,
                healedSelectors: summary?.healedSelectors || 0,
            };
        }).reverse();

        // Compute averages
        const avgPassRate = trends.length > 0
            ? Math.round(trends.reduce((s, t) => s + t.passRate, 0) / trends.length)
            : 0;
        const avgDuration = trends.filter(t => t.duration).length > 0
            ? Math.round(trends.filter(t => t.duration).reduce((s, t) => s + t.duration, 0) / trends.filter(t => t.duration).length)
            : 0;

        res.json({
            runs: trends,
            stats: {
                totalRuns: trends.length,
                avgPassRate,
                avgDuration,
                lastRun: trends.length > 0 ? trends[trends.length - 1] : null,
            },
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/analytics/errors/:suiteId — Error pattern analysis
router.get('/errors/:suiteId', async (req, res) => {
    try {
        const testCases = await db.testCases.find({ suite_id: req.params.suiteId });
        const tcIds = testCases.map(tc => tc.id);

        const results = await db.results.find({
            test_case_id: { $in: tcIds },
            status: 'FAILED',
        }).sort({ _id: -1 }).limit(100);

        // Group errors by pattern
        const errorMap = {};
        for (const r of results) {
            if (!r.error_message) continue;
            const normalized = r.error_message
                .replace(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/g, '<timestamp>')
                .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
                .replace(/\d+ms/g, '<duration>')
                .substring(0, 150);

            if (!errorMap[normalized]) {
                errorMap[normalized] = { pattern: normalized, count: 0, testCases: new Set(), lastSeen: null, sample: r.error_message };
            }
            errorMap[normalized].count++;
            errorMap[normalized].testCases.add(r.test_case_id);
            if (!errorMap[normalized].lastSeen) errorMap[normalized].lastSeen = r.run_id;
        }

        const errors = Object.values(errorMap)
            .map(e => ({ ...e, testCases: [...e.testCases], affectedCount: e.testCases.size || e.testCases.length }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 20);

        res.json({ totalFailures: results.length, patterns: errors });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
