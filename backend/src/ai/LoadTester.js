/**
 * LoadTester - Orchestrator cho Load Testing
 * Chạy tuần tự các test case, auto-login 1 lần (token pool), tổng hợp báo cáo
 */

const { chromium } = require('playwright');
const AutoLogin = require('./AutoLogin');
const TestCaseRunner = require('./load-tests/TestCaseRunner');
const BottleneckAnalyzer = require('./load-tests/BottleneckAnalyzer');
const {
    getSLO,
    checkSLO,
    aggregateVerdict,
    estimateCapacity,
    estimateBreakpoint,
} = require('./load-tests/loadHelpers');
const { getTestCases, estimateTotalDuration } = require('./load-tests/TestSuite');

// Rest between test cases (server hồi phục)
const REST_BETWEEN_TC_MS = 5000;

class LoadTester {
    constructor() {
        this._runner = new TestCaseRunner();
        this._analyzer = new BottleneckAnalyzer();
    }

    /**
     * Run the full load test suite
     * @param {Object} opts
     * @param {string} opts.url - Target URL
     * @param {string[]} [opts.selectedTestCases] - IDs of test cases to run
     * @param {string} [opts.sloPreset] - 'strict' | 'relaxed' | 'custom'
     * @param {Object} [opts.customSLO] - Custom SLO if preset = 'custom'
     * @param {string} [opts.loginEmail]
     * @param {string} [opts.loginPassword]
     * @param {Function} [opts.emitProgress]
     */
    async run(opts = {}) {
        const {
            url,
            selectedTestCases,
            sloPreset = 'strict',
            customSLO,
            loginEmail,
            loginPassword,
            emitProgress = () => {},
        } = opts;

        if (!url) throw new Error('URL là bắt buộc');

        const slo = getSLO(sloPreset, customSLO);
        const testCases = getTestCases(selectedTestCases);
        const totalSec = estimateTotalDuration(testCases);
        const startedAt = Date.now();

        emitProgress({
            phase: 'init',
            step: 0,
            total: testCases.length + 1,
            message: `Chuẩn bị chạy ${testCases.length} test case (ước tính ${totalSec}s)...`,
        });

        // === Auto-login để lấy session ===
        let authHeaders = {};
        if (loginEmail && loginPassword) {
            emitProgress({
                phase: 'login',
                step: 0,
                total: testCases.length + 1,
                message: 'Đang đăng nhập để lấy session token...',
            });
            try {
                authHeaders = await this._captureAuthHeaders(url, loginEmail, loginPassword);
                emitProgress({
                    phase: 'login',
                    message: `Đăng nhập thành công. Session sẽ được tái dụng cho tất cả test case.`,
                });
            } catch (err) {
                emitProgress({
                    phase: 'login',
                    message: `Đăng nhập thất bại (${err.message}). Sẽ chạy test không auth.`,
                });
                console.warn('[LoadTester] Auto-login failed:', err.message);
            }
        }

        // === Chạy từng test case ===
        const results = [];
        for (let i = 0; i < testCases.length; i++) {
            const tc = testCases[i];
            emitProgress({
                phase: 'running',
                step: i + 1,
                total: testCases.length + 1,
                testCaseId: tc.id,
                testCaseName: tc.name,
                message: `[${i + 1}/${testCases.length}] ${tc.name}: ${tc.description}`,
            });

            try {
                const normalized = await this._runner.run(tc, url, {
                    headers: authHeaders,
                    onPhaseStart: (phase) => {
                        emitProgress({
                            phase: 'running',
                            step: i + 1,
                            total: testCases.length + 1,
                            testCaseId: tc.id,
                            subPhase: phase,
                            message: `[${tc.name}] Pha ${phase.phaseIndex + 1}/${phase.totalPhases}: ${phase.connections} VU × ${phase.duration}s`,
                        });
                    },
                });

                // SLO check
                normalized.sloCheck = checkSLO(normalized.metrics, slo);
                results.push(normalized);

                emitProgress({
                    phase: 'tc-done',
                    step: i + 1,
                    total: testCases.length + 1,
                    testCaseId: tc.id,
                    sloCheck: normalized.sloCheck,
                    message: `${tc.name}: ${normalized.sloCheck.pass ? '✅ PASS' : '❌ FAIL'}`,
                });

                // Rest giữa các TC (trừ TC cuối)
                if (i < testCases.length - 1) {
                    emitProgress({
                        phase: 'resting',
                        step: i + 1,
                        total: testCases.length + 1,
                        message: `Nghỉ ${REST_BETWEEN_TC_MS / 1000}s cho server hồi phục...`,
                    });
                    await new Promise(r => setTimeout(r, REST_BETWEEN_TC_MS));
                }
            } catch (err) {
                console.error(`[LoadTester] TC ${tc.id} error:`, err);
                results.push({
                    id: tc.id,
                    name: tc.name,
                    label: tc.label,
                    description: tc.description,
                    error: err.message,
                    sloCheck: { pass: false, reasons: [`Lỗi runtime: ${err.message}`] },
                    config: tc.config,
                    metrics: null,
                });
            }
        }

        // === Phân tích bottleneck ===
        emitProgress({
            phase: 'analyzing',
            step: testCases.length + 1,
            total: testCases.length + 1,
            message: 'Đang phân tích kết quả và sinh báo cáo...',
        });

        const validResults = results.filter(r => r.metrics);
        const { bottlenecks, recommendations } = this._analyzer.analyze(validResults);
        const verdict = aggregateVerdict(results);
        const capacity = estimateCapacity(results);
        const breakpoint = estimateBreakpoint(results);

        const durationMs = Date.now() - startedAt;

        emitProgress({
            phase: 'done',
            step: testCases.length + 1,
            total: testCases.length + 1,
            message: `Hoàn tất! Verdict: ${verdict.verdict}`,
        });

        return {
            url,
            timestamp: new Date().toISOString(),
            durationMs,
            slo,
            testCases: results,
            bottlenecks,
            recommendations,
            verdict: verdict.verdict,
            verdictLabel: verdict.label,
            capacity,
            breakpoint,
            summary: {
                url,
                verdict: verdict.verdict,
                verdictLabel: verdict.label,
                capacity,
                breakpoint,
                totalTestCases: results.length,
                passedCount: results.filter(r => r.sloCheck?.pass).length,
                failedCount: results.filter(r => !r.sloCheck?.pass).length,
                bottleneckCount: bottlenecks.length,
                durationMs,
                peakRps: Math.max(0, ...validResults.map(r => r.metrics.rps || 0)),
                worstP95: Math.max(0, ...validResults.map(r => r.metrics.latency.p95 || 0)),
                authenticated: !!Object.keys(authHeaders).length,
            },
        };
    }

    /**
     * Login bằng Playwright, trích cookie + auth header để tái dụng cho autocannon
     */
    async _captureAuthHeaders(url, email, password) {
        const browser = await chromium.launch({ headless: true });
        try {
            const context = await browser.newContext();
            const page = await context.newPage();

            // Intercept Authorization header từ request sau login
            let capturedAuth = null;
            page.on('request', (req) => {
                const auth = req.headers()['authorization'];
                if (auth && !capturedAuth) capturedAuth = auth;
            });

            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

            const autoLogin = new AutoLogin();
            const success = await autoLogin.attemptLogin(page, email, password);
            if (!success) throw new Error('Không phát hiện form đăng nhập hợp lệ');

            // Đợi sau login cho AJAX lấy token
            await page.waitForTimeout(2000);

            // Lấy cookies
            const cookies = await context.cookies();
            const cookieHeader = cookies
                .map(c => `${c.name}=${c.value}`)
                .join('; ');

            const headers = {};
            if (cookieHeader) headers['cookie'] = cookieHeader;
            if (capturedAuth) headers['authorization'] = capturedAuth;

            // Cố gắng lấy token từ localStorage/sessionStorage
            try {
                const token = await page.evaluate(() => {
                    const candidates = ['token', 'accessToken', 'access_token', 'authToken', 'jwt', 'Bearer'];
                    for (const key of candidates) {
                        const v = localStorage.getItem(key) || sessionStorage.getItem(key);
                        if (v && v.length > 20) return v;
                    }
                    return null;
                });
                if (token && !headers['authorization']) {
                    headers['authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                }
            } catch (_) { /* ignore */ }

            if (Object.keys(headers).length === 0) {
                throw new Error('Không lấy được cookie hoặc token sau khi đăng nhập');
            }

            return headers;
        } finally {
            await browser.close().catch(() => {});
        }
    }
}

module.exports = LoadTester;
