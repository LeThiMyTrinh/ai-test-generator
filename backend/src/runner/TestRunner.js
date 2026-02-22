const { chromium, firefox, webkit } = require('playwright');
const ActionHandler = require('./ActionHandler');
const EvidenceManager = require('./EvidenceManager');
const path = require('path');

const BROWSER_MAP = { chromium, firefox, webkit };

class TestRunner {
    constructor({ io } = {}) {
        this.io = io; // Socket.IO instance for real-time updates
    }

    emit(event, data) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }

    async runTestCase(testCase, runId) {
        const { id: tcId, title, url, browser = 'chromium', steps_json } = testCase;
        const steps = typeof steps_json === 'string' ? JSON.parse(steps_json) : steps_json;
        const evidence = new EvidenceManager(runId, tcId);
        const startTime = Date.now();

        const BrowserClass = BROWSER_MAP[browser] || chromium;
        const browserInstance = await BrowserClass.launch({ headless: true });
        const context = await browserInstance.newContext({
            recordVideo: {
                dir: evidence.dir,
                size: { width: 1280, height: 720 }
            },
            viewport: { width: 1280, height: 720 }
        });
        const page = await context.newPage();
        const handler = new ActionHandler(page);

        const stepResults = [];
        let overallStatus = 'PASSED';
        let errorMessage = null;

        this.emit('tc_start', { runId, tcId, title });

        // Navigate to base URL first if steps don't start with navigate
        if (steps.length > 0 && steps[0].action !== 'navigate' && url) {
            try {
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            } catch (e) {
                // initial navigation failed, will handle in steps
            }
        }

        for (const step of steps) {
            const stepStart = Date.now();
            let stepStatus = 'PASSED';
            let stepError = null;
            let screenshotPath = null;

            this.emit('step_start', { runId, tcId, stepId: step.step_id, description: step.description });

            try {
                await handler.execute(step);
                screenshotPath = await evidence.captureScreenshot(page, step.step_id);
            } catch (err) {
                stepStatus = 'FAILED';
                stepError = err.message;
                overallStatus = 'FAILED';
                errorMessage = err.message;

                // capture failure screenshot
                try {
                    screenshotPath = await evidence.captureScreenshot(page, step.step_id, 'FAIL');
                } catch (e2) { /* screen may be in bad state */ }
            }

            const stepResult = {
                step_id: step.step_id,
                action: step.action,
                description: step.description || '',
                status: stepStatus,
                error: stepError,
                duration_ms: Date.now() - stepStart,
                screenshot: screenshotPath ? evidence.getRelativePath(screenshotPath) : null
            };

            stepResults.push(stepResult);
            this.emit('step_done', { runId, tcId, step: stepResult });

            // Stop executing further steps after failure
            if (stepStatus === 'FAILED') break;
        }

        await context.close(); // this triggers video save
        await browserInstance.close();

        // Find video file that Playwright auto-named
        let videoPath = null;
        const fs = require('fs');
        const evidenceFiles = fs.readdirSync(evidence.dir).filter(f => f.endsWith('.webm'));
        if (evidenceFiles.length > 0) {
            videoPath = evidence.getRelativePath(path.join(evidence.dir, evidenceFiles[0]));
        }

        const result = {
            test_case_id: tcId,
            test_case_title: title,
            status: overallStatus,
            duration_ms: Date.now() - startTime,
            error_message: errorMessage,
            steps_result: stepResults,
            screenshots: evidence.getAllScreenshots(),
            video_path: videoPath
        };

        this.emit('tc_done', { runId, tcId, result });
        return result;
    }

    async runSuite(testCases, runId) {
        const results = [];
        this.emit('run_start', { runId, total: testCases.length });

        for (const tc of testCases) {
            const result = await this.runTestCase(tc, runId);
            results.push(result);
        }

        const summary = {
            total: results.length,
            passed: results.filter(r => r.status === 'PASSED').length,
            failed: results.filter(r => r.status === 'FAILED').length,
            skipped: 0
        };

        this.emit('run_done', { runId, summary, results });
        return { summary, results };
    }
}

module.exports = TestRunner;
