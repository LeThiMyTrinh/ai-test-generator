/**
 * TestPrioritizer — Smart test ordering based on historical data
 *
 * Priority factors (weighted):
 * 1. Recent failure rate (40%) — tests that failed recently run first
 * 2. Flaky score (20%) — flaky tests need early detection
 * 3. Duration (15%) — faster tests first for quick feedback
 * 4. Time since last run (15%) — stale tests get priority
 * 5. Code change proximity (10%) — tests near recent changes (future)
 */
const db = require('../db/database');
const FlakyDetector = require('./FlakyDetector');

class TestPrioritizer {
    constructor() {
        this.flakyDetector = new FlakyDetector();
        this.weights = {
            recentFailure: 0.40,
            flakyScore: 0.20,
            duration: 0.15,
            staleness: 0.15,
            change: 0.10,
        };
    }

    /**
     * Prioritize test cases in a suite for optimal execution order
     * @param {string} suiteId
     * @returns {Promise<Array<{testCaseId, title, priority, score, factors}>>}
     */
    async prioritize(suiteId) {
        const testCases = await db.testCases.find({ suite_id: suiteId });
        if (testCases.length === 0) return [];

        const scored = [];

        for (const tc of testCases) {
            const factors = await this._calculateFactors(tc.id);
            const score =
                factors.recentFailure * this.weights.recentFailure +
                factors.flakyScore * this.weights.flakyScore +
                factors.duration * this.weights.duration +
                factors.staleness * this.weights.staleness +
                factors.change * this.weights.change;

            scored.push({
                testCaseId: tc.id,
                title: tc.title,
                score: Math.round(score * 100) / 100,
                priority: score >= 0.7 ? 'CRITICAL' : score >= 0.5 ? 'HIGH' : score >= 0.3 ? 'MEDIUM' : 'LOW',
                factors,
            });
        }

        // Sort by score descending (highest priority first)
        scored.sort((a, b) => b.score - a.score);
        return scored;
    }

    /**
     * Calculate individual factor scores (each 0-1)
     */
    async _calculateFactors(testCaseId) {
        // Get recent results
        const results = await db.results.find({ test_case_id: testCaseId })
            .sort({ _id: -1 })
            .limit(10);

        // Factor 1: Recent failure rate
        let recentFailure = 0;
        if (results.length > 0) {
            const recent = results.slice(0, 5); // Last 5 results
            const failCount = recent.filter(r => r.status === 'FAILED').length;
            recentFailure = failCount / recent.length;
            // Boost if last result was FAILED
            if (results[0].status === 'FAILED') recentFailure = Math.min(1, recentFailure + 0.2);
        } else {
            // Never run = moderate priority (unknown risk)
            recentFailure = 0.5;
        }

        // Factor 2: Flaky score
        const flaky = await this.flakyDetector.analyze(testCaseId);
        const flakyScore = flaky.score;

        // Factor 3: Duration (faster = higher priority for quick feedback)
        let duration = 0.5; // default
        if (results.length > 0) {
            const avgDuration = results.reduce((s, r) => s + (r.duration_ms || 0), 0) / results.length;
            // Normalize: <5s = 1.0, 5-30s = 0.5-1.0, >60s = 0.2
            if (avgDuration < 5000) duration = 1.0;
            else if (avgDuration < 30000) duration = 1.0 - (avgDuration - 5000) / 50000;
            else duration = Math.max(0.2, 0.5 - (avgDuration - 30000) / 120000);
        }

        // Factor 4: Staleness (time since last run)
        let staleness = 0.5;
        if (results.length > 0) {
            // Find the most recent run timestamp
            const runs = await db.runs.find({}).sort({ started_at: -1 }).limit(1);
            if (runs.length > 0) {
                const latestRunTime = new Date(runs[0].started_at).getTime();
                // Find when this TC was last run
                const lastRun = results[0];
                const runInfo = await db.runs.findOne({ id: lastRun.run_id });
                if (runInfo) {
                    const lastRunTime = new Date(runInfo.started_at).getTime();
                    const hoursSinceRun = (latestRunTime - lastRunTime) / (1000 * 60 * 60);
                    // >24h = high staleness, <1h = low
                    staleness = Math.min(1, hoursSinceRun / 48);
                }
            }
        } else {
            staleness = 1.0; // Never run = very stale
        }

        // Factor 5: Change proximity (placeholder — future: integrate with git)
        const change = 0.5;

        return {
            recentFailure: Math.round(recentFailure * 100) / 100,
            flakyScore: Math.round(flakyScore * 100) / 100,
            duration: Math.round(duration * 100) / 100,
            staleness: Math.round(staleness * 100) / 100,
            change: Math.round(change * 100) / 100,
        };
    }

    /**
     * Get suite health summary
     * @param {string} suiteId
     * @returns {Promise<Object>}
     */
    async getSuiteHealth(suiteId) {
        const prioritized = await this.prioritize(suiteId);
        const critical = prioritized.filter(t => t.priority === 'CRITICAL').length;
        const high = prioritized.filter(t => t.priority === 'HIGH').length;
        const flaky = prioritized.filter(t => t.factors.flakyScore >= 0.4).length;

        // Get last 5 runs for trend
        const runs = await db.runs.find({ suite_id: suiteId }).sort({ started_at: -1 }).limit(5);
        const trend = runs.map(r => {
            const summary = typeof r.summary_json === 'string' ? JSON.parse(r.summary_json) : r.summary_json;
            return {
                runId: r.id,
                date: r.started_at,
                status: r.status,
                passed: summary?.passed || 0,
                failed: summary?.failed || 0,
                total: summary?.total || 0,
                passRate: summary?.total ? Math.round(((summary?.passed || 0) / summary.total) * 100) : 0,
            };
        }).reverse();

        return {
            totalTests: prioritized.length,
            critical,
            high,
            flaky,
            healthScore: prioritized.length > 0
                ? Math.round((1 - (critical * 2 + high) / (prioritized.length * 2)) * 100)
                : 100,
            trend,
            tests: prioritized,
        };
    }
}

module.exports = TestPrioritizer;
