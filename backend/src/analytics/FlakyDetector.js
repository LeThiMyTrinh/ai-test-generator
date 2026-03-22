/**
 * FlakyDetector — Detect flaky tests based on run history
 *
 * A test is considered flaky if it alternates between PASSED and FAILED
 * across recent runs without code changes. Tracks per-test-case metrics:
 * - Failure rate (last N runs)
 * - Flip rate (PASS→FAIL or FAIL→PASS transitions)
 * - Confidence score (how sure we are it's flaky vs genuinely broken)
 *
 * Flaky thresholds:
 * - flipRate ≥ 0.3 AND failureRate between 0.15 and 0.85
 * - OR: passed on retry (attempt > 1) more than 2 times in last N runs
 */
const db = require('../db/database');

class FlakyDetector {
    constructor(options = {}) {
        this.windowSize = options.windowSize || 20; // Analyze last N runs
        this.flakyFlipThreshold = options.flakyFlipThreshold || 0.3;
        this.flakyFailMin = options.flakyFailMin || 0.15;
        this.flakyFailMax = options.flakyFailMax || 0.85;
        this.retryHealedThreshold = options.retryHealedThreshold || 2;
    }

    /**
     * Analyze a single test case for flakiness based on recent run history
     * @param {string} testCaseId
     * @returns {Promise<{isFlaky: boolean, score: number, metrics: Object}>}
     */
    async analyze(testCaseId) {
        // Get recent results for this test case, sorted by time
        const results = await db.results.find({ test_case_id: testCaseId })
            .sort({ _id: -1 })
            .limit(this.windowSize);

        if (results.length < 3) {
            return { isFlaky: false, score: 0, metrics: { runs: results.length, message: 'Insufficient data' } };
        }

        // Reverse to chronological order
        results.reverse();

        const statuses = results.map(r => r.status);
        const total = statuses.length;
        const failed = statuses.filter(s => s === 'FAILED').length;
        const passed = statuses.filter(s => s === 'PASSED').length;
        const failureRate = failed / total;

        // Count flips (status transitions)
        let flips = 0;
        for (let i = 1; i < statuses.length; i++) {
            if (statuses[i] !== statuses[i - 1] && statuses[i] !== 'CANCELLED') flips++;
        }
        const flipRate = flips / (total - 1);

        // Count retry-healed (passed on attempt > 1)
        const retryHealed = results.filter(r => r.status === 'PASSED' && r.attempt > 1).length;

        // Calculate flaky score (0-1)
        let score = 0;
        if (flipRate >= this.flakyFlipThreshold && failureRate >= this.flakyFailMin && failureRate <= this.flakyFailMax) {
            score = Math.min(1, flipRate * 1.5);
        }
        if (retryHealed >= this.retryHealedThreshold) {
            score = Math.max(score, 0.5 + (retryHealed / total) * 0.5);
        }

        // Boost score if recent results show alternation
        const recent5 = statuses.slice(-5);
        let recentFlips = 0;
        for (let i = 1; i < recent5.length; i++) {
            if (recent5[i] !== recent5[i - 1]) recentFlips++;
        }
        if (recentFlips >= 3) score = Math.min(1, score + 0.2);

        const isFlaky = score >= 0.4;

        // Error pattern analysis
        const errors = results.filter(r => r.error_message).map(r => r.error_message);
        const errorGroups = this._groupErrors(errors);

        return {
            isFlaky,
            score: Math.round(score * 100) / 100,
            metrics: {
                runs: total,
                passed,
                failed,
                failureRate: Math.round(failureRate * 100) / 100,
                flipRate: Math.round(flipRate * 100) / 100,
                flips,
                retryHealed,
                recentTrend: recent5,
                errorGroups,
            },
        };
    }

    /**
     * Analyze all test cases in a suite
     * @param {string} suiteId
     * @returns {Promise<Array<{testCaseId, title, isFlaky, score, metrics}>>}
     */
    async analyzeSuite(suiteId) {
        const testCases = await db.testCases.find({ suite_id: suiteId });
        const results = [];

        for (const tc of testCases) {
            const analysis = await this.analyze(tc.id);
            results.push({
                testCaseId: tc.id,
                title: tc.title,
                ...analysis,
            });
        }

        // Sort by flaky score descending
        results.sort((a, b) => b.score - a.score);
        return results;
    }

    /**
     * Get recommended retry count based on flakiness
     * @param {string} testCaseId
     * @returns {Promise<number>} Suggested retry count (0-3)
     */
    async suggestRetryCount(testCaseId) {
        const { isFlaky, score } = await this.analyze(testCaseId);
        if (!isFlaky) return 0;
        if (score >= 0.8) return 3;
        if (score >= 0.6) return 2;
        return 1;
    }

    /**
     * Group similar error messages
     */
    _groupErrors(errors) {
        const groups = {};
        for (const err of errors) {
            // Normalize error: remove dynamic values (numbers, timestamps, IDs)
            const normalized = err
                .replace(/\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2}/g, '<timestamp>')
                .replace(/\b[0-9a-f]{8,}\b/gi, '<id>')
                .replace(/\d+ms/g, '<duration>')
                .replace(/:\d+/g, ':<port>')
                .substring(0, 120);

            groups[normalized] = (groups[normalized] || 0) + 1;
        }

        return Object.entries(groups)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([pattern, count]) => ({ pattern, count }));
    }
}

module.exports = FlakyDetector;
