const { chromium, firefox, webkit, devices } = require('playwright');
const ActionHandler = require('./ActionHandler');
const EvidenceManager = require('./EvidenceManager');
const SelectorHealer = require('./SelectorHealer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const BROWSER_MAP = { chromium, firefox, webkit };

const DEVICE_MAP = {
    'iphone-15': 'iPhone 15',
    'iphone-15-pro': 'iPhone 15 Pro',
    'iphone-14': 'iPhone 14',
    'iphone-13': 'iPhone 13',
    'iphone-12': 'iPhone 12',
    'iphone-se': 'iPhone SE',
    'pixel-7': 'Pixel 7',
    'pixel-5': 'Pixel 5',
    'galaxy-s24': 'Galaxy S24',
    'galaxy-s9': 'Galaxy S9+',
    'ipad-pro': 'iPad Pro 11',
    'ipad-mini': 'iPad Mini',
    'galaxy-tab': 'Galaxy Tab S4',
};

// Default timeouts per action type (ms)
// Default timeouts per action type (ms)
const ACTION_TIMEOUTS = {
    // UI actions
    navigate: 30000,
    click: 10000,
    fill: 5000,
    select: 5000,
    hover: 5000,
    assert_text: 10000,
    assert_visible: 10000,
    assert_url: 15000,
    wait: 60000,
    screenshot: 5000,
    // Extended UI actions
    double_click: 10000,
    right_click: 10000,
    keyboard: 5000,
    scroll_to: 5000,
    drag_drop: 15000,
    upload_file: 15000,
    // API actions
    api_request: 30000,
    assert_status: 5000,
    assert_body: 5000,
    assert_header: 5000,
    assert_response_time: 5000,
    store_variable: 5000,
};

/**
 * Registry of active runners — allows cancel/pause from API
 */
const activeRunners = new Map();

class TestRunner {
    /**
     * @param {Object} options
     * @param {Object} options.io - Socket.IO instance
     * @param {boolean} options.continueOnFailure - Continue running steps after failure (default: false)
     * @param {number} options.retryCount - Retry failed test cases N times (default: 0)
     * @param {number} options.concurrency - Parallel test case execution (default: 1 = sequential)
     * @param {boolean} options.selfHealing - Enable self-healing locators (default: true)
     * @param {boolean} options.smartPriority - Enable smart test prioritization (default: false)
     */
    constructor({ io, continueOnFailure = false, retryCount = 0, concurrency = 1, selfHealing = true, smartPriority = false } = {}) {
        this.io = io;
        this.continueOnFailure = continueOnFailure;
        this.retryCount = retryCount;
        this.concurrency = Math.max(1, concurrency);
        this.selfHealing = selfHealing;
        this.smartPriority = smartPriority;
        this.selectorHealer = selfHealing ? new SelectorHealer() : null;
        this._cancelled = false;
        this._paused = false;
        this._pausePromise = null;
        this._pauseResolve = null;
        this._runId = null;
    }

    /** Register this runner as active (for cancel/pause) */
    _register(runId) {
        this._runId = runId;
        activeRunners.set(runId, this);
    }

    /** Unregister when done */
    _unregister() {
        if (this._runId) activeRunners.delete(this._runId);
    }

    /** Cancel this run */
    cancel() {
        this._cancelled = true;
        if (this._pauseResolve) this._pauseResolve();
    }

    /** Pause this run */
    pause() {
        if (this._paused) return;
        this._paused = true;
        this._pausePromise = new Promise(resolve => { this._pauseResolve = resolve; });
    }

    /** Resume this run */
    resume() {
        this._paused = false;
        if (this._pauseResolve) {
            this._pauseResolve();
            this._pauseResolve = null;
            this._pausePromise = null;
        }
    }

    /** Wait if paused, throw if cancelled */
    async _checkState() {
        if (this._cancelled) throw new Error('__CANCELLED__');
        if (this._paused && this._pausePromise) {
            this.emit('run_paused', { runId: this._runId });
            await this._pausePromise;
            if (this._cancelled) throw new Error('__CANCELLED__');
            this.emit('run_resumed', { runId: this._runId });
        }
    }

    emit(event, data) {
        if (this.io) this.io.emit(event, data);
    }

    // ===== CONTEXT OPTIONS BUILDER =====

    _buildContextOptions(testCase, evidenceDir) {
        const { device = null } = testCase;
        const playwrightDeviceName = device ? DEVICE_MAP[device] || device : null;

        if (playwrightDeviceName && devices[playwrightDeviceName]) {
            return {
                ...devices[playwrightDeviceName],
                recordVideo: { dir: evidenceDir, size: devices[playwrightDeviceName].viewport }
            };
        }
        return {
            recordVideo: { dir: evidenceDir, size: { width: 1920, height: 1080 } },
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1
        };
    }

    // ===== EXECUTE STEPS ON A PAGE =====

    async _executeSteps(page, resolvedSteps, url, runId, tcId, evidence) {
        const stepResults = [];
        let overallStatus = 'PASSED';
        let errorMessage = null;
        let failedStepCount = 0;
        const handler = new ActionHandler(page, {
            selectorHealer: this.selectorHealer,
            stepContext: { testCaseId: tcId },
        });

        // Navigate to base URL first if steps don't start with navigate
        if (resolvedSteps.length > 0 && resolvedSteps[0].action !== 'navigate' && url) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) { /* will handle in steps */ }
        }

        for (const step of resolvedSteps) {
            try {
                await this._checkState();
            } catch (e) {
                if (e.message === '__CANCELLED__') {
                    overallStatus = 'CANCELLED';
                    break;
                }
            }

            const stepStart = Date.now();
            let stepStatus = 'PASSED';
            let stepError = null;
            let screenshotPath = null;

            const timeout = step.timeout || ACTION_TIMEOUTS[step.action] || 15000;

            try {
                await handler.execute(step, timeout);
                screenshotPath = await evidence.captureScreenshot(page, step.step_id);
            } catch (err) {
                stepStatus = 'FAILED';
                stepError = err.message;
                failedStepCount++;
                if (!errorMessage) errorMessage = err.message;
                try {
                    screenshotPath = await evidence.captureScreenshot(page, step.step_id, 'FAIL');
                } catch { /* screen may be in bad state */ }
            }

            // Check if any selectors were healed during this step
            const healedInStep = handler.healedSelectors.length > stepResults.reduce((s, r) => s + (r.healed ? 1 : 0), 0)
                ? handler.healedSelectors[handler.healedSelectors.length - 1] : null;

            const stepResult = {
                step_id: step.step_id,
                action: step.action,
                description: step.description || '',
                status: stepStatus,
                error: stepError,
                duration_ms: Date.now() - stepStart,
                screenshot: screenshotPath ? evidence.getRelativePath(screenshotPath) : null,
                healed: healedInStep || undefined,
            };

            stepResults.push(stepResult);
            this.emit('step_done', { runId, tcId, step: stepResult });

            if (stepStatus === 'FAILED' && !this.continueOnFailure) break;
        }

        if (failedStepCount > 0 && overallStatus !== 'CANCELLED') {
            overallStatus = 'FAILED';
            if (this.continueOnFailure) {
                errorMessage = `${failedStepCount} step(s) failed`;
            }
        }

        return { stepResults, overallStatus, errorMessage, healedSelectors: handler.healedSelectors };
    }

    // ===== RUN SINGLE TEST CASE (legacy — launches own browser) =====

    async runTestCase(testCase, runId, attempt = 1) {
        const { id: tcId, title, url, browser = 'chromium', steps_json } = testCase;
        const steps = typeof steps_json === 'string' ? JSON.parse(steps_json) : steps_json;
        const resolvedSteps = this._resolveVariables(steps, testCase._dataRow);

        const evidence = new EvidenceManager(runId, tcId + (attempt > 1 ? `-retry${attempt}` : ''));
        const startTime = Date.now();

        const BrowserClass = BROWSER_MAP[browser] || chromium;
        const browserInstance = await BrowserClass.launch({ headless: true });

        const contextOptions = this._buildContextOptions(testCase, evidence.dir);
        const context = await browserInstance.newContext(contextOptions);
        const page = await context.newPage();

        this.emit('tc_start', { runId, tcId, title, attempt });

        const { stepResults, overallStatus, errorMessage } = await this._executeSteps(
            page, resolvedSteps, url, runId, tcId, evidence
        );

        await context.close();
        await browserInstance.close();

        let videoPath = null;
        try {
            const evidenceFiles = fs.readdirSync(evidence.dir).filter(f => f.endsWith('.webm'));
            if (evidenceFiles.length > 0) {
                videoPath = evidence.getRelativePath(path.join(evidence.dir, evidenceFiles[0]));
            }
        } catch { /* no video */ }

        const result = {
            test_case_id: tcId,
            test_case_title: title,
            status: overallStatus,
            duration_ms: Date.now() - startTime,
            error_message: errorMessage,
            steps_result: stepResults,
            screenshots: evidence.getAllScreenshots(),
            video_path: videoPath,
            attempt,
        };

        this.emit('tc_done', { runId, tcId, result });
        return result;
    }

    // ===== RUN TEST CASE WITH SHARED BROWSER (optimized) =====

    /**
     * Chạy test case sử dụng shared browser — chỉ tạo context mới
     * Nhẹ hơn nhiều so với launch browser mới mỗi test case
     */
    async runTestCaseWithBrowser(testCase, runId, sharedBrowser, attempt = 1) {
        const { id: tcId, title, url, steps_json } = testCase;
        const steps = typeof steps_json === 'string' ? JSON.parse(steps_json) : steps_json;
        const resolvedSteps = this._resolveVariables(steps, testCase._dataRow);

        const evidence = new EvidenceManager(runId, tcId + (attempt > 1 ? `-retry${attempt}` : ''));
        const startTime = Date.now();

        const contextOptions = this._buildContextOptions(testCase, evidence.dir);
        const context = await sharedBrowser.newContext(contextOptions);
        const page = await context.newPage();

        this.emit('tc_start', { runId, tcId, title, attempt });

        const { stepResults, overallStatus, errorMessage } = await this._executeSteps(
            page, resolvedSteps, url, runId, tcId, evidence
        );

        await context.close();
        // KHÔNG close browser — browser được share giữa các test cases

        let videoPath = null;
        try {
            const evidenceFiles = fs.readdirSync(evidence.dir).filter(f => f.endsWith('.webm'));
            if (evidenceFiles.length > 0) {
                videoPath = evidence.getRelativePath(path.join(evidence.dir, evidenceFiles[0]));
            }
        } catch { /* no video */ }

        const result = {
            test_case_id: tcId,
            test_case_title: title,
            status: overallStatus,
            duration_ms: Date.now() - startTime,
            error_message: errorMessage,
            steps_result: stepResults,
            screenshots: evidence.getAllScreenshots(),
            video_path: videoPath,
            attempt,
        };

        this.emit('tc_done', { runId, tcId, result });
        return result;
    }

    /**
     * Retry logic với shared browser
     */
    async _runWithRetryShared(testCase, runId, sharedBrowser) {
        let lastResult = null;
        const maxAttempts = 1 + this.retryCount;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (this._cancelled) break;

            lastResult = await this.runTestCaseWithBrowser(testCase, runId, sharedBrowser, attempt);

            if (lastResult.status === 'PASSED' || lastResult.status === 'CANCELLED') break;

            if (attempt < maxAttempts) {
                this.emit('tc_retry', { runId, tcId: testCase.id, attempt: attempt + 1, maxAttempts });
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        return lastResult;
    }

    /**
     * Run a single test case with retry logic (legacy — own browser per TC)
     */
    async runTestCaseWithRetry(testCase, runId) {
        let lastResult = null;
        const maxAttempts = 1 + this.retryCount;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            if (this._cancelled) break;

            lastResult = await this.runTestCase(testCase, runId, attempt);

            if (lastResult.status === 'PASSED' || lastResult.status === 'CANCELLED') break;

            if (attempt < maxAttempts) {
                this.emit('tc_retry', { runId, tcId: testCase.id, attempt: attempt + 1, maxAttempts });
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        return lastResult;
    }

    // ===== RUN SUITE =====

    /**
     * Run suite — optimized: dùng 1 shared browser cho tất cả test cases
     * Nếu suite có mixed browser types → fallback về legacy mode
     */
    async runSuite(testCases, runId) {
        this._register(runId);
        const results = [];

        // Smart priority: reorder tests (most likely to fail first)
        if (this.smartPriority && testCases.length > 1) {
            try {
                const TestPrioritizer = require('../analytics/TestPrioritizer');
                const prioritizer = new TestPrioritizer();
                const suiteId = testCases[0]?.suite_id;
                if (suiteId) {
                    const prioritized = await prioritizer.prioritize(suiteId);
                    const priorityMap = new Map(prioritized.map(p => [p.testCaseId, p.score]));
                    testCases.sort((a, b) => (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0));
                    console.log(`[TestRunner] Smart priority: reordered ${testCases.length} test cases`);
                }
            } catch (err) {
                console.warn(`[TestRunner] Smart priority failed, using original order: ${err.message}`);
            }
        }

        this.emit('run_start', { runId, total: testCases.length });

        // Detect browser type — nếu tất cả dùng cùng 1 browser → shared mode
        const primaryBrowser = testCases[0]?.browser || 'chromium';
        const allSameBrowser = testCases.every(tc => (tc.browser || 'chromium') === primaryBrowser);

        if (!allSameBrowser) {
            console.log(`[TestRunner] Mixed browsers detected, using legacy mode`);
            return this._runSuiteLegacy(testCases, runId);
        }

        // Shared browser mode — 1 browser, N contexts
        const BrowserClass = BROWSER_MAP[primaryBrowser] || chromium;
        let sharedBrowser;

        try {
            sharedBrowser = await BrowserClass.launch({ headless: true });
            console.log(`[TestRunner] Shared ${primaryBrowser} browser launched (concurrency: ${this.concurrency})`);

            if (this.concurrency <= 1) {
                // Sequential with shared browser
                for (const tc of testCases) {
                    if (this._cancelled) break;
                    // Check browser still alive
                    if (!sharedBrowser.isConnected()) {
                        console.warn('[TestRunner] Shared browser disconnected, relaunching...');
                        sharedBrowser = await BrowserClass.launch({ headless: true });
                    }
                    const result = await this._runWithRetryShared(tc, runId, sharedBrowser);
                    results.push(result);
                }
            } else {
                // Parallel with shared browser + concurrency control
                const queue = [...testCases];
                const running = new Set();

                await new Promise((resolve) => {
                    const runNext = () => {
                        if (this._cancelled) {
                            if (running.size === 0) resolve();
                            return;
                        }
                        while (running.size < this.concurrency && queue.length > 0) {
                            const tc = queue.shift();
                            const promise = this._runWithRetryShared(tc, runId, sharedBrowser)
                                .then(result => {
                                    results.push(result);
                                    running.delete(promise);
                                    runNext();
                                })
                                .catch(err => {
                                    console.error(`[TestRunner] TC error: ${err.message}`);
                                    running.delete(promise);
                                    runNext();
                                });
                            running.add(promise);
                        }
                        if (running.size === 0 && queue.length === 0) resolve();
                    };
                    runNext();
                });
            }
        } finally {
            if (sharedBrowser) {
                await sharedBrowser.close().catch(() => {});
            }
            this._unregister();
        }

        const healingSummary = this.selectorHealer ? this.selectorHealer.getSummary() : null;

        const summary = {
            total: results.length,
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            cancelled: results.filter(r => r.status === 'CANCELLED').length,
            skipped: testCases.length - results.length,
            healedSelectors: healingSummary?.totalHealed || 0,
        };

        if (this._cancelled) {
            this.emit('run_cancelled', { runId, summary });
        } else {
            this.emit('run_done', { runId, summary, results, healingSummary });
        }

        return { summary, results, healingSummary };
    }

    /**
     * Legacy suite execution — mỗi test case tự launch browser riêng
     * Dùng khi suite có mixed browser types
     */
    async _runSuiteLegacy(testCases, runId) {
        const results = [];

        try {
            if (this.concurrency <= 1) {
                for (const tc of testCases) {
                    if (this._cancelled) break;
                    const result = await this.runTestCaseWithRetry(tc, runId);
                    results.push(result);
                }
            } else {
                const queue = [...testCases];
                const running = new Set();

                await new Promise((resolve) => {
                    const runNext = () => {
                        if (this._cancelled) {
                            if (running.size === 0) resolve();
                            return;
                        }
                        while (running.size < this.concurrency && queue.length > 0) {
                            const tc = queue.shift();
                            const promise = this.runTestCaseWithRetry(tc, runId)
                                .then(result => {
                                    results.push(result);
                                    running.delete(promise);
                                    runNext();
                                })
                                .catch(err => {
                                    running.delete(promise);
                                    runNext();
                                });
                            running.add(promise);
                        }
                        if (running.size === 0 && queue.length === 0) resolve();
                    };
                    runNext();
                });
            }
        } finally {
            this._unregister();
        }

        const summary = {
            total: results.length,
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            cancelled: results.filter(r => r.status === 'CANCELLED').length,
            skipped: testCases.length - results.length,
        };

        if (this._cancelled) {
            this.emit('run_cancelled', { runId, summary });
        } else {
            this.emit('run_done', { runId, summary, results });
        }

        return { summary, results };
    }

    /**
     * Resolve {{variable}} placeholders in step values using data row
     */
    _resolveVariables(steps, dataRow) {
        if (!dataRow) return steps;
        return steps.map(step => {
            const resolved = { ...step };
            const replace = (str) => {
                if (!str || typeof str !== 'string') return str;
                return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                    return dataRow[key] !== undefined ? dataRow[key] : `{{${key}}}`;
                });
            };
            resolved.value = replace(resolved.value);
            resolved.expected = replace(resolved.expected);
            resolved.expected_text = replace(resolved.expected_text);
            resolved.expected_url = replace(resolved.expected_url);
            resolved.url = replace(resolved.url);
            resolved.selector = replace(resolved.selector);
            resolved.description = replace(resolved.description);
            return resolved;
        });
    }

    /**
     * Suggest optimal concurrency based on system resources
     * Mỗi browser context dùng ~100-200MB RAM
     */
    static optimalConcurrency() {
        const cpus = os.cpus().length;
        const memGB = os.totalmem() / (1024 ** 3);
        return Math.max(1, Math.min(cpus, Math.floor(memGB / 0.5), 8));
    }
}

/** Static: get active runner by runId */
TestRunner.getActiveRunner = (runId) => activeRunners.get(runId);

module.exports = TestRunner;
