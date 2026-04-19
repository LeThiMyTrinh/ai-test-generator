/**
 * loadHelpers - Hỗ trợ tính toán cho Load Testing
 * Percentile, SLO check, format, phân loại error
 */

const SLO_PRESETS = {
    strict: {
        key: 'strict',
        label: 'Strict (API/SPA)',
        p95Ms: 500,
        p99Ms: 1000,
        errorRatePct: 0.5,
    },
    relaxed: {
        key: 'relaxed',
        label: 'Relaxed (content/admin)',
        p95Ms: 1500,
        p99Ms: 3000,
        errorRatePct: 2,
    },
};

function getSLO(preset, custom) {
    if (preset === 'custom' && custom) {
        return {
            key: 'custom',
            label: 'Custom',
            p95Ms: Number(custom.p95Ms) || 1000,
            p99Ms: Number(custom.p99Ms) || 2000,
            errorRatePct: Number(custom.errorRatePct) || 1,
        };
    }
    return SLO_PRESETS[preset] || SLO_PRESETS.strict;
}

/**
 * Check if a test case result passes SLO
 */
function checkSLO(metrics, slo) {
    const reasons = [];
    const p95 = metrics.latency?.p95 ?? 0;
    const p99 = metrics.latency?.p99 ?? 0;
    const errorRate = metrics.errorRate ?? 0;

    if (p95 > slo.p95Ms) reasons.push(`p95 = ${formatMs(p95)} vượt ngưỡng ${formatMs(slo.p95Ms)}`);
    if (p99 > slo.p99Ms) reasons.push(`p99 = ${formatMs(p99)} vượt ngưỡng ${formatMs(slo.p99Ms)}`);
    if (errorRate > slo.errorRatePct) reasons.push(`error rate = ${errorRate.toFixed(2)}% vượt ngưỡng ${slo.errorRatePct}%`);

    return {
        pass: reasons.length === 0,
        reasons,
    };
}

/**
 * Verdict aggregation: PASS | WARN | FAIL
 * - FAIL: TC1 Smoke fail hoặc Load-TB/Load-nhẹ fail
 * - WARN: Stress/Spike fail nhưng load cơ bản đạt
 * - PASS: tất cả pass
 */
function aggregateVerdict(testCases) {
    const critical = ['smoke', 'load-light', 'load-medium'];
    const passedAll = testCases.every(tc => tc.sloCheck?.pass);
    if (passedAll) return { verdict: 'PASS', label: 'Đạt', color: '#16a34a' };

    const criticalFailed = testCases.some(tc => critical.includes(tc.id) && !tc.sloCheck?.pass);
    if (criticalFailed) return { verdict: 'FAIL', label: 'Không đạt', color: '#dc2626' };

    return { verdict: 'WARN', label: 'Cảnh báo', color: '#ca8a04' };
}

/**
 * Classify autocannon errors by code pattern
 * Returns: { timeouts, resets, server5xx, client4xx, other }
 */
function classifyErrors(result) {
    const status = result.statusCodeStats || {};
    let server5xx = 0;
    let client4xx = 0;
    for (const [code, data] of Object.entries(status)) {
        const c = parseInt(code, 10);
        if (c >= 500 && c < 600) server5xx += data.count || 0;
        else if (c >= 400 && c < 500) client4xx += data.count || 0;
    }

    const timeouts = result.timeouts || 0;
    const totalErrors = result.errors || 0;
    const resets = Math.max(0, totalErrors - timeouts);

    return {
        timeouts,
        resets,
        server5xx,
        client4xx,
        total: timeouts + resets + server5xx + client4xx,
    };
}

/**
 * Capacity estimate = max VU of passing test case
 */
function estimateCapacity(testCases) {
    const passing = testCases.filter(tc => tc.sloCheck?.pass && tc.config?.connections);
    if (passing.length === 0) return 0;
    return Math.max(...passing.map(tc => tc.config.connections || 0));
}

/**
 * Breakpoint = VU at which stress test first crosses SLO
 * (approximation: use the stress case's connections if failed, else null)
 */
function estimateBreakpoint(testCases) {
    const stress = testCases.find(tc => tc.id === 'stress');
    if (!stress) return null;
    if (!stress.sloCheck?.pass) {
        return stress.config?.maxConnections || stress.config?.connections || null;
    }
    return null;
}

function formatMs(ms) {
    if (ms == null || isNaN(ms)) return 'N/A';
    return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
}

function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

module.exports = {
    SLO_PRESETS,
    getSLO,
    checkSLO,
    aggregateVerdict,
    classifyErrors,
    estimateCapacity,
    estimateBreakpoint,
    formatMs,
    formatBytes,
};
