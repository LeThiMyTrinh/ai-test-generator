/**
 * TestCaseRunner - Chạy 1 test case dùng autocannon
 * Hỗ trợ chế độ single-phase (connections + duration) và multi-phase (ramp/spike)
 */

const autocannon = require('autocannon');
const { classifyErrors } = require('./loadHelpers');

class TestCaseRunner {
    /**
     * Run a test case
     * @param {Object} testCase - Test case definition
     * @param {string} url - Target URL
     * @param {Object} opts - { headers, cookies, onPhaseStart }
     * @returns {Promise<Object>} Normalized metrics
     */
    async run(testCase, url, opts = {}) {
        const { config } = testCase;

        if (config.mode === 'ramp' || config.mode === 'spike') {
            return this._runMultiPhase(testCase, url, opts);
        }
        return this._runSinglePhase(testCase, url, opts);
    }

    async _runSinglePhase(testCase, url, opts) {
        const { config } = testCase;
        const start = Date.now();

        const result = await this._runAutocannon({
            url,
            connections: config.connections,
            duration: config.duration,
            pipelining: config.pipelining || 1,
            timeout: config.timeout || 10,
            headers: opts.headers,
        });

        return this._normalize(testCase, result, Date.now() - start, [{
            connections: config.connections,
            duration: config.duration,
            result,
        }]);
    }

    async _runMultiPhase(testCase, url, opts) {
        const { config } = testCase;
        const start = Date.now();
        const phaseResults = [];

        for (let i = 0; i < config.phases.length; i++) {
            const phase = config.phases[i];
            if (opts.onPhaseStart) {
                opts.onPhaseStart({
                    phaseIndex: i,
                    totalPhases: config.phases.length,
                    connections: phase.connections,
                    duration: phase.duration,
                });
            }

            const result = await this._runAutocannon({
                url,
                connections: phase.connections,
                duration: phase.duration,
                pipelining: 1,
                timeout: config.timeout || 10,
                headers: opts.headers,
            });

            phaseResults.push({
                connections: phase.connections,
                duration: phase.duration,
                result,
            });
        }

        // Aggregate multi-phase results
        const aggregated = this._aggregatePhases(phaseResults);
        return this._normalize(testCase, aggregated, Date.now() - start, phaseResults);
    }

    _runAutocannon(opts) {
        return new Promise((resolve, reject) => {
            const instance = autocannon({
                url: opts.url,
                connections: opts.connections,
                duration: opts.duration,
                pipelining: opts.pipelining || 1,
                timeout: opts.timeout || 10,
                headers: opts.headers || {},
                // Worker khi VU lớn để tránh event loop nghẽn ở client
                workers: opts.connections >= 100 ? 2 : 1,
            }, (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });

            // Không cần track progress ở đây; orchestrator handle
            autocannon.track(instance, { renderProgressBar: false, renderResultsTable: false });
        });
    }

    /**
     * Aggregate multiple phase results into one unified result
     * Cần tính lại percentile từ mean/p50/p95 của từng pha — dùng max cho pessimistic
     */
    _aggregatePhases(phases) {
        let totalRequests = 0;
        let totalErrors = 0;
        let totalTimeouts = 0;
        let total2xx = 0;
        let totalNon2xx = 0;
        let totalBytes = 0;
        let maxP50 = 0, maxP90 = 0, maxP975 = 0, maxP99 = 0, maxMax = 0;
        let sumMean = 0;
        const statusCodeStats = {};
        let totalDuration = 0;

        for (const p of phases) {
            const r = p.result;
            totalRequests += r.requests?.total || 0;
            totalErrors += r.errors || 0;
            totalTimeouts += r.timeouts || 0;
            total2xx += r['2xx'] || 0;
            totalNon2xx += r.non2xx || 0;
            totalBytes += r.throughput?.total || 0;
            totalDuration += p.duration;

            if (r.latency) {
                maxP50 = Math.max(maxP50, r.latency.p50 || 0);
                maxP90 = Math.max(maxP90, r.latency.p90 || 0);
                maxP975 = Math.max(maxP975, r.latency.p97_5 || 0);
                maxP99 = Math.max(maxP99, r.latency.p99 || 0);
                maxMax = Math.max(maxMax, r.latency.max || 0);
                sumMean += (r.latency.mean || 0) * (r.requests?.total || 0);
            }

            if (r.statusCodeStats) {
                for (const [code, data] of Object.entries(r.statusCodeStats)) {
                    if (!statusCodeStats[code]) statusCodeStats[code] = { count: 0 };
                    statusCodeStats[code].count += data.count || 0;
                }
            }
        }

        const weightedMean = totalRequests > 0 ? sumMean / totalRequests : 0;
        const avgRps = totalDuration > 0 ? totalRequests / totalDuration : 0;

        return {
            requests: { total: totalRequests, average: avgRps },
            duration: totalDuration,
            errors: totalErrors,
            timeouts: totalTimeouts,
            '2xx': total2xx,
            non2xx: totalNon2xx,
            latency: {
                mean: weightedMean,
                p50: maxP50,
                p90: maxP90,
                // autocannon dùng p97_5 thay vì p95 (do HDR histogram buckets).
                // Dùng p97_5 làm xấp xỉ bảo thủ cho p95.
                p97_5: maxP975,
                p99: maxP99,
                max: maxMax,
            },
            throughput: { total: totalBytes, average: totalDuration > 0 ? totalBytes / totalDuration : 0 },
            statusCodeStats,
        };
    }

    /**
     * Convert autocannon result to our normalized metrics shape
     */
    _normalize(testCase, result, durationMs, phaseBreakdown) {
        const totalReq = result.requests?.total || 0;
        const errorCounts = classifyErrors(result);
        const errorRate = totalReq > 0 ? (errorCounts.total / totalReq) * 100 : 0;

        return {
            id: testCase.id,
            name: testCase.name,
            label: testCase.label,
            description: testCase.description,
            config: {
                connections: testCase.config.connections || testCase.config.maxConnections,
                duration: testCase.config.duration ||
                    (testCase.config.phases || []).reduce((s, p) => s + p.duration, 0),
                mode: testCase.config.mode || 'steady',
                maxConnections: testCase.config.maxConnections,
            },
            metrics: {
                totalRequests: totalReq,
                rps: result.requests?.average || 0,
                bytesPerSec: result.throughput?.average || 0,
                totalBytes: result.throughput?.total || 0,
                latency: {
                    mean: Math.round(result.latency?.mean || 0),
                    p50: Math.round(result.latency?.p50 || 0),
                    p90: Math.round(result.latency?.p90 || 0),
                    // p95 xấp xỉ bằng p97_5 của autocannon (bảo thủ hơn p95 thật)
                    p95: Math.round(result.latency?.p97_5 || result.latency?.p95 || 0),
                    p99: Math.round(result.latency?.p99 || 0),
                    max: Math.round(result.latency?.max || 0),
                },
                errors: errorCounts,
                errorRate,
                statusCodes: result.statusCodeStats || {},
                success2xx: result['2xx'] || 0,
                non2xx: result.non2xx || 0,
            },
            phases: phaseBreakdown.map(p => ({
                connections: p.connections,
                duration: p.duration,
                rps: p.result.requests?.average || 0,
                p95: Math.round(p.result.latency?.p97_5 || p.result.latency?.p95 || 0),
                errors: (p.result.errors || 0) + (p.result.timeouts || 0) + (p.result.non2xx || 0),
            })),
            durationMs,
        };
    }
}

module.exports = TestCaseRunner;
