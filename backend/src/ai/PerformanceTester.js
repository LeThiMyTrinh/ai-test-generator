/**
 * PerformanceTester - Orchestrator cho Performance Testing
 * Kết hợp 5 sub-modules để đo lường hiệu năng web toàn diện
 * Sử dụng Playwright CDP + PerformanceObserver, KHÔNG cần thêm dependency
 */

const { chromium, devices } = require('playwright');
const AutoLogin = require('./AutoLogin');
const PageLoadMetrics = require('./performance-tests/PageLoadMetrics');
const CoreWebVitals = require('./performance-tests/CoreWebVitals');
const RuntimeMetrics = require('./performance-tests/RuntimeMetrics');
const ResourceAnalysis = require('./performance-tests/ResourceAnalysis');
const NetworkAnalysis = require('./performance-tests/NetworkAnalysis');
const {
    calculateOverallScore,
    getOverallRating,
    getMetricRating,
    calculateMetricScore,
    formatMetricValue,
    generateRecommendations,
    THRESHOLDS,
} = require('./performance-tests/performanceHelpers');

const VIEWPORT_PRESETS = {
    desktop: { width: 1920, height: 1080, label: 'Desktop 1920x1080' },
    mobile: { ...devices['iPhone 15'], label: 'Mobile (iPhone 15)' },
};

class PerformanceTester {
    constructor() {
        this._pageLoadMetrics = new PageLoadMetrics();
        this._coreWebVitals = new CoreWebVitals();
        this._runtimeMetrics = new RuntimeMetrics();
        this._resourceAnalysis = new ResourceAnalysis();
    }

    /**
     * Run performance test on a URL
     * @param {string} url - URL to test
     * @param {Object} opts - Options
     * @param {string} [opts.loginEmail] - Auto-login email
     * @param {string} [opts.loginPassword] - Auto-login password
     * @param {string[]} [opts.viewports] - Viewports to test ['desktop', 'mobile']
     * @param {Function} [opts.emitProgress] - Socket.IO progress callback
     * @returns {Promise<Object>} Performance test results
     */
    async test(url, opts = {}) {
        const {
            loginEmail,
            loginPassword,
            viewports = ['desktop', 'mobile'],
            emitProgress = () => {},
        } = opts;

        const startTime = Date.now();
        const results = {};
        let browser = null;

        try {
            emitProgress({ step: 1, total: 7, message: 'Đang khởi động trình duyệt...' });
            browser = await chromium.launch({ headless: true });

            let stepCount = 1;
            for (const vpKey of viewports) {
                const preset = VIEWPORT_PRESETS[vpKey] || VIEWPORT_PRESETS.desktop;
                stepCount++;
                emitProgress({
                    step: stepCount,
                    total: 7,
                    message: `Đang kiểm tra viewport: ${preset.label}...`,
                });

                results[vpKey] = await this._testViewport(
                    browser, url, vpKey, preset, loginEmail, loginPassword, emitProgress
                );
            }

            // Calculate overall scores
            emitProgress({ step: 6, total: 7, message: 'Đang tính điểm và tạo recommendations...' });

            const viewportResults = {};
            for (const [vpKey, vpData] of Object.entries(results)) {
                const webVitals = vpData.coreWebVitals || {};
                const score = calculateOverallScore({
                    lcp: webVitals.lcp,
                    fcp: webVitals.fcp,
                    cls: webVitals.cls,
                    tbt: webVitals.tbt,
                    ttfb: vpData.pageLoad?.ttfb,
                });

                viewportResults[vpKey] = {
                    ...vpData,
                    score,
                    rating: getOverallRating(score),
                    metricScores: {
                        LCP: { value: webVitals.lcp, score: calculateMetricScore(webVitals.lcp, 'LCP'), rating: getMetricRating(webVitals.lcp, 'LCP'), formatted: formatMetricValue(webVitals.lcp, 'LCP') },
                        FCP: { value: webVitals.fcp, score: calculateMetricScore(webVitals.fcp, 'FCP'), rating: getMetricRating(webVitals.fcp, 'FCP'), formatted: formatMetricValue(webVitals.fcp, 'FCP') },
                        CLS: { value: webVitals.cls, score: calculateMetricScore(webVitals.cls, 'CLS'), rating: getMetricRating(webVitals.cls, 'CLS'), formatted: formatMetricValue(webVitals.cls, 'CLS') },
                        TBT: { value: webVitals.tbt, score: calculateMetricScore(webVitals.tbt, 'TBT'), rating: getMetricRating(webVitals.tbt, 'TBT'), formatted: formatMetricValue(webVitals.tbt, 'TBT') },
                        TTFB: { value: vpData.pageLoad?.ttfb, score: calculateMetricScore(vpData.pageLoad?.ttfb, 'TTFB'), rating: getMetricRating(vpData.pageLoad?.ttfb, 'TTFB'), formatted: formatMetricValue(vpData.pageLoad?.ttfb, 'TTFB') },
                    },
                };
            }

            // Use desktop score as primary, fallback to first available
            const primaryVp = viewportResults.desktop || Object.values(viewportResults)[0] || {};
            const overallScore = primaryVp.score || 0;

            // Generate recommendations from primary viewport
            const recommendations = generateRecommendations({
                coreWebVitals: primaryVp.coreWebVitals || {},
                pageLoad: primaryVp.pageLoad || {},
                runtime: primaryVp.runtime || {},
                resources: primaryVp.resources || {},
                network: primaryVp.network || {},
            });

            emitProgress({ step: 7, total: 7, message: 'Hoàn tất!' });

            return {
                url,
                timestamp: new Date().toISOString(),
                duration_ms: Date.now() - startTime,
                viewports: viewportResults,
                score: overallScore,
                rating: getOverallRating(overallScore),
                recommendations,
                thresholds: THRESHOLDS,
                summary: {
                    score: overallScore,
                    rating: getOverallRating(overallScore),
                    lcp: primaryVp.coreWebVitals?.lcp,
                    fcp: primaryVp.coreWebVitals?.fcp,
                    cls: primaryVp.coreWebVitals?.cls,
                    tbt: primaryVp.coreWebVitals?.tbt,
                    ttfb: primaryVp.pageLoad?.ttfb,
                    totalResources: primaryVp.resources?.totalCount || 0,
                    totalSize: primaryVp.resources?.totalSize || 0,
                    totalRequests: primaryVp.network?.totalRequests || 0,
                    failedRequests: primaryVp.network?.failed?.length || 0,
                    duration_ms: Date.now() - startTime,
                    viewportsTested: viewports,
                },
            };
        } catch (err) {
            console.error('[PerformanceTester] Error:', err);
            throw err;
        } finally {
            if (browser) {
                await browser.close().catch(() => {});
            }
        }
    }

    /**
     * Test a single viewport
     */
    async _testViewport(browser, url, vpKey, preset, loginEmail, loginPassword, emitProgress) {
        const networkAnalysis = new NetworkAnalysis();
        let context = null;

        try {
            // Create context with viewport settings
            const contextOpts = {};
            if (vpKey === 'mobile' && preset.viewport) {
                // Use device descriptor for mobile
                Object.assign(contextOpts, {
                    viewport: preset.viewport,
                    userAgent: preset.userAgent,
                    deviceScaleFactor: preset.deviceScaleFactor,
                    isMobile: preset.isMobile,
                    hasTouch: preset.hasTouch,
                });
            } else {
                contextOpts.viewport = { width: preset.width, height: preset.height };
            }

            context = await browser.newContext(contextOpts);
            const page = await context.newPage();

            // Step 1: Setup network listeners BEFORE navigation
            networkAnalysis.setupListeners(page);

            // Step 2: Inject PerformanceObserver BEFORE navigation
            await this._coreWebVitals.injectObservers(page);

            // Step 3: Auto-login if needed
            if (loginEmail && loginPassword) {
                emitProgress({ step: 3, total: 7, message: `[${vpKey}] Đang auto-login...` });
                try {
                    const autoLogin = new AutoLogin();
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await autoLogin.attemptLogin(page, loginEmail, loginPassword);
                    // Re-inject observers after login navigation
                    await this._coreWebVitals.injectObservers(page);
                } catch (loginErr) {
                    console.warn('[PerformanceTester] Auto-login failed:', loginErr.message);
                }
            }

            // Step 4: Navigate to URL
            emitProgress({ step: 4, total: 7, message: `[${vpKey}] Đang tải trang và thu thập metrics...` });
            await page.goto(url, { waitUntil: 'load', timeout: 30000 });

            // Wait for LCP to stabilize
            await page.waitForTimeout(3000);

            // Step 5: Collect all metrics
            emitProgress({ step: 5, total: 7, message: `[${vpKey}] Đang phân tích performance...` });

            const [pageLoad, coreWebVitals, runtime, resources] = await Promise.all([
                this._pageLoadMetrics.collect(page),
                this._coreWebVitals.collect(page),
                this._runtimeMetrics.collect(page),
                this._resourceAnalysis.collect(page, url),
            ]);

            const network = networkAnalysis.collect();

            // Take screenshot
            let screenshot = null;
            try {
                const buf = await page.screenshot({ fullPage: false, type: 'png' });
                screenshot = buf.toString('base64');
            } catch (_) {}

            return {
                viewport: preset.label || vpKey,
                pageLoad,
                coreWebVitals,
                runtime,
                resources,
                network,
                screenshot,
            };
        } finally {
            if (context) {
                await context.close().catch(() => {});
            }
        }
    }
}

module.exports = PerformanceTester;
