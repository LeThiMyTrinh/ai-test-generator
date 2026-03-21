const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AITestGenerator = require('../ai/AITestGenerator');
const URLCrawler = require('../ai/URLCrawler');
const UICheckerModule = require('../ai/UIChecker');
const UIChecker = new UICheckerModule();
const { DESKTOP_PRESETS, TABLET_PRESETS, MOBILE_PRESETS } = UICheckerModule;

// V3 Enhanced modules
const EnhancedUIChecker = require('../ai/EnhancedUIChecker');
const DesignComparer = require('../ai/DesignComparer');
const InteractionTester = require('../ai/InteractionTester');
const UICheckerReporter = require('../reporter/UICheckerReporter');
const db = require('../db/database');

const enhancedChecker = new EnhancedUIChecker();
const designComparer = new DesignComparer();
const interactionTester = new InteractionTester();
const uiReporter = new UICheckerReporter();

// Directory for persisted screenshots
const UI_SCREENSHOTS_DIR = path.join(__dirname, '../../../data/ui-screenshots');
if (!fs.existsSync(UI_SCREENSHOTS_DIR)) fs.mkdirSync(UI_SCREENSHOTS_DIR, { recursive: true });

/**
 * Save base64 screenshot to file, return relative path
 */
function saveScreenshot(base64Data, historyId, name) {
    if (!base64Data) return null;
    const raw = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const filename = `${historyId}_${name}.png`;
    const filePath = path.join(UI_SCREENSHOTS_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(raw, 'base64'));
    return filename;
}

/**
 * Load screenshot from file back to base64
 */
function loadScreenshot(filename) {
    if (!filename) return null;
    const filePath = path.join(UI_SCREENSHOTS_DIR, filename);
    if (!fs.existsSync(filePath)) return null;
    const buf = fs.readFileSync(filePath);
    return 'data:image/png;base64,' + buf.toString('base64');
}

/**
 * Strip base64 screenshots from result for DB storage, save to files
 */
function stripAndSaveScreenshots(result, historyId, type) {
    const screenshotMap = {};

    if (type === 'enhanced' && result.screenshots) {
        for (const vp of ['desktop', 'tablet', 'mobile']) {
            if (result.screenshots[vp]) {
                screenshotMap[vp] = saveScreenshot(result.screenshots[vp], historyId, vp);
            }
        }
    }

    if (type === 'design-compare' && result.screenshots) {
        for (const key of ['design', 'page', 'diff']) {
            if (result.screenshots[key]) {
                screenshotMap[key] = saveScreenshot(result.screenshots[key], historyId, key);
            }
        }
    }

    if (type === 'interaction') {
        if (result.initialScreenshot) {
            screenshotMap.initial = saveScreenshot(result.initialScreenshot, historyId, 'initial');
        }
        if (result.finalScreenshot) {
            screenshotMap.final = saveScreenshot(result.finalScreenshot, historyId, 'final');
        }
        // Strip test screenshots — keep only first 5
        if (result.tests) {
            result.tests.forEach((t, i) => {
                if (t.screenshot && i < 5) {
                    screenshotMap[`test_${i}`] = saveScreenshot(t.screenshot, historyId, `test_${i}`);
                }
                delete t.screenshot; // remove from DB doc
            });
        }
    }

    return screenshotMap;
}

const UPLOADS_DIR = path.join(__dirname, '../../../uploads/ai');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const upload = multer({
    dest: UPLOADS_DIR,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowed = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
        cb(null, allowed.includes(file.mimetype));
    }
});

const generator = new AITestGenerator();
const crawler = new URLCrawler();

// GET /api/ai/status — check if API key is configured
router.get('/status', (req, res) => {
    res.json({
        configured: generator.isConfigured(),
        model: generator.model || 'N/A',
        message: generator.isConfigured()
            ? 'Gemini API đã sẵn sàng'
            : 'Chưa cấu hình GEMINI_API_KEY. Thêm biến môi trường GEMINI_API_KEY và restart server.'
    });
});

// POST /api/ai/generate — generate test case from images + context
router.post('/generate', upload.array('images', 10), async (req, res) => {
    try {
        if (!generator.isConfigured()) {
            return res.status(400).json({
                error: 'Chưa cấu hình GEMINI_API_KEY. Thêm vào biến môi trường và restart server.\nLấy key miễn phí tại: https://aistudio.google.com'
            });
        }

        const { url, description } = req.body;

        // Prepare images from uploads
        const images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const data = fs.readFileSync(file.path);
                images.push({ data, mimeType: file.mimetype });
                // Cleanup temp file
                fs.unlinkSync(file.path);
            }
        }

        // If URL provided, crawl it for DOM info + screenshot
        let context = { url, description };
        if (url) {
            try {
                console.log(`[AI] Crawling URL: ${url}`);

                // Note: Auto-login not supported in AI Generate
                // User should use UIChecker for pages requiring login
                const crawlResult = await crawler.analyze(url);
                context.elements = crawlResult.elements;
                context.metadata = crawlResult.metadata;
                // Add crawled screenshot as image input for AI
                images.push({ data: crawlResult.screenshot, mimeType: 'image/png' });
                console.log(`[AI] Crawled: ${crawlResult.elements.length} elements found`);
            } catch (crawlErr) {
                console.warn(`[AI] Crawl warning: ${crawlErr.message}`);
                // Continue without crawl data — user images are still available
            }
        }

        if (images.length === 0 && !description) {
            return res.status(400).json({
                error: 'Cần ít nhất một ảnh chụp UI, URL trang web, hoặc mô tả chức năng.'
            });
        }

        console.log(`[AI] Generating test case — ${images.length} images, URL: ${url || 'N/A'}`);
        const result = await generator.generate(images, context);
        console.log(`[AI] Generated: "${result.title}" with ${result.steps.length} steps`);

        res.json(result);

    } catch (err) {
        console.error('[AI] Generate error:', err.message);
        // Clean up any remaining temp files
        if (req.files) {
            for (const file of req.files) {
                try { fs.unlinkSync(file.path); } catch { /* ok */ }
            }
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/refine — refine existing test case
router.post('/refine', async (req, res) => {
    try {
        if (!generator.isConfigured()) {
            return res.status(400).json({ error: 'Chưa cấu hình GEMINI_API_KEY.' });
        }

        const { steps, feedback, url } = req.body;
        if (!steps || !feedback) {
            return res.status(400).json({ error: 'Cần cung cấp steps hiện tại và yêu cầu chỉnh sửa.' });
        }

        console.log(`[AI] Refining test case — feedback: ${feedback.substring(0, 80)}`);
        const result = await generator.refine(steps, feedback, { url });
        console.log(`[AI] Refined: ${result.steps.length} steps`);

        res.json(result);

    } catch (err) {
        console.error('[AI] Refine error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/crawl — crawl URL and return analysis (no AI)
router.post('/crawl', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });

        console.log(`[AI] Crawling: ${url}`);
        const result = await crawler.analyze(url);
        console.log(`[AI] Crawled: ${result.elements.length} elements`);

        res.json({
            metadata: result.metadata,
            elements: result.elements,
            screenshotBase64: result.screenshot.toString('base64')
        });
    } catch (err) {
        console.error('[AI] Crawl error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/ui-presets — return available device presets
router.get('/ui-presets', (req, res) => {
    res.json({
        desktop: Object.keys(DESKTOP_PRESETS).map(k => ({ value: k, label: `Desktop ${DESKTOP_PRESETS[k].width}×${DESKTOP_PRESETS[k].height}` })),
        tablet: Object.keys(TABLET_PRESETS).map(k => ({ value: k, label: TABLET_PRESETS[k] })),
        mobile: Object.keys(MOBILE_PRESETS).map(k => ({ value: k, label: MOBILE_PRESETS[k] })),
    });
});

// POST /api/ai/ui-check — run UI checks on a URL
router.post('/ui-check', async (req, res) => {
    try {
        const { url, desktop, tablet, mobile, loginEmail, loginPassword } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });

        console.log(`[UIChecker] Starting check: ${url}`);
        console.log(`[UIChecker] Devices: desktop=${desktop}, tablet=${tablet}, mobile=${mobile}, autoLogin=${!!(loginEmail && loginPassword)}`);

        const result = await UIChecker.check(url, {
            desktop,
            tablet,
            mobile,
            loginEmail,
            loginPassword
        });

        console.log(`[UIChecker] Done: ${result.summary.total} issues found in ${result.summary.duration_ms}ms`);

        res.json(result);
    } catch (err) {
        console.error('[UIChecker] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== V3 ENHANCED ENDPOINTS =====

// POST /api/ai/ui-check-v3 — Enhanced UI check with 35+ algorithmic checks
router.post('/ui-check-v3', async (req, res) => {
    try {
        const { url, desktop, tablet, mobile, loginEmail, loginPassword } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });

        console.log(`[EnhancedUIChecker] Starting check: ${url}`);

        const result = await enhancedChecker.check(url, {
            desktop, tablet, mobile, loginEmail, loginPassword
        });

        console.log(`[EnhancedUIChecker] Done: ${result.summary.total} issues, quality score: ${result.summary.qualityScore}/100`);

        // Save to history
        try {
            const historyRecord = await db.uiCheckerHistory.insert({
                type: 'enhanced',
                url,
                created_at: new Date().toISOString(),
                result: { ...result, screenshots: undefined }, // strip screenshots from DB
                screenshotMap: {},
            });
            const screenshotMap = stripAndSaveScreenshots(result, historyRecord._id, 'enhanced');
            await db.uiCheckerHistory.update({ _id: historyRecord._id }, { $set: { screenshotMap } });
            result._historyId = historyRecord._id;
            console.log(`[History] Saved enhanced check: ${historyRecord._id}`);
        } catch (histErr) {
            console.warn('[History] Save error:', histErr.message);
        }

        res.json(result);
    } catch (err) {
        console.error('[EnhancedUIChecker] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/design-compare — Compare design image vs live page
router.post('/design-compare', upload.single('designImage'), async (req, res) => {
    try {
        const { url, threshold, viewportWidth, viewportHeight } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });
        if (!req.file) return res.status(400).json({ error: 'Cần upload ảnh design.' });

        const designBuffer = fs.readFileSync(req.file.path);
        fs.unlinkSync(req.file.path); // Cleanup

        const viewport = {
            width: parseInt(viewportWidth) || 1920,
            height: parseInt(viewportHeight) || 1080,
        };

        console.log(`[DesignComparer] Comparing design vs ${url} at ${viewport.width}×${viewport.height}`);

        const result = await designComparer.compareWithUpload(designBuffer, url, {
            viewport,
            threshold: parseFloat(threshold) || 0.15,
        });

        console.log(`[DesignComparer] Match: ${result.matchPercent}%, ${result.regions.length} diff regions`);

        // Save to history
        try {
            const historyRecord = await db.uiCheckerHistory.insert({
                type: 'design-compare',
                url,
                created_at: new Date().toISOString(),
                result: { ...result, screenshots: undefined },
                screenshotMap: {},
            });
            const screenshotMap = stripAndSaveScreenshots(result, historyRecord._id, 'design-compare');
            await db.uiCheckerHistory.update({ _id: historyRecord._id }, { $set: { screenshotMap } });
            result._historyId = historyRecord._id;
            console.log(`[History] Saved design-compare: ${historyRecord._id}`);
        } catch (histErr) {
            console.warn('[History] Save error:', histErr.message);
        }

        res.json(result);
    } catch (err) {
        console.error('[DesignComparer] Error:', err.message);
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch { }
        }
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/design-compare-figma — Compare Figma frame vs live page
router.post('/design-compare-figma', async (req, res) => {
    try {
        const { url, figmaFileKey, figmaNodeId, figmaToken, threshold, viewportWidth, viewportHeight } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });
        if (!figmaFileKey || !figmaNodeId || !figmaToken) {
            return res.status(400).json({ error: 'Cần cung cấp Figma file key, node ID, và personal access token.' });
        }

        const viewport = {
            width: parseInt(viewportWidth) || 1920,
            height: parseInt(viewportHeight) || 1080,
        };

        console.log(`[DesignComparer] Comparing Figma frame vs ${url}`);

        const result = await designComparer.compareWithFigma(figmaFileKey, figmaNodeId, figmaToken, url, {
            viewport,
            threshold: parseFloat(threshold) || 0.15,
        });

        console.log(`[DesignComparer] Match: ${result.matchPercent}%`);

        // Save to history
        try {
            const historyRecord = await db.uiCheckerHistory.insert({
                type: 'design-compare',
                url,
                created_at: new Date().toISOString(),
                result: { ...result, screenshots: undefined },
                screenshotMap: {},
            });
            const screenshotMap = stripAndSaveScreenshots(result, historyRecord._id, 'design-compare');
            await db.uiCheckerHistory.update({ _id: historyRecord._id }, { $set: { screenshotMap } });
            result._historyId = historyRecord._id;
            console.log(`[History] Saved design-compare (figma): ${historyRecord._id}`);
        } catch (histErr) {
            console.warn('[History] Save error:', histErr.message);
        }

        res.json(result);
    } catch (err) {
        console.error('[DesignComparer Figma] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/interaction-test — Run interaction tests
router.post('/interaction-test', async (req, res) => {
    try {
        const { url, level, loginEmail, loginPassword, maxActions } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });

        const validLevels = ['static', 'smart', 'chaos', 'full'];
        const testLevel = validLevels.includes(level) ? level : 'smart';

        console.log(`[InteractionTester] Starting ${testLevel} test: ${url}`);

        const result = await interactionTester.test(url, {
            level: testLevel,
            loginEmail,
            loginPassword,
            maxActions: parseInt(maxActions) || 500,
        });

        console.log(`[InteractionTester] Done: ${result.summary.totalTests} tests, ${result.summary.passed} passed, ${result.summary.failed} failed`);

        // Save to history
        try {
            const historyRecord = await db.uiCheckerHistory.insert({
                type: 'interaction',
                url,
                created_at: new Date().toISOString(),
                result: { ...result, initialScreenshot: undefined, finalScreenshot: undefined },
                screenshotMap: {},
            });
            const screenshotMap = stripAndSaveScreenshots(result, historyRecord._id, 'interaction');
            await db.uiCheckerHistory.update({ _id: historyRecord._id }, { $set: { screenshotMap } });
            result._historyId = historyRecord._id;
            console.log(`[History] Saved interaction test: ${historyRecord._id}`);
        } catch (histErr) {
            console.warn('[History] Save error:', histErr.message);
        }

        res.json(result);
    } catch (err) {
        console.error('[InteractionTester] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== HISTORY ENDPOINTS =====

// GET /api/ai/ui-history — List history records (newest first)
router.get('/ui-history', async (req, res) => {
    try {
        const { type, limit = 50, skip = 0 } = req.query;
        const query = type ? { type } : {};
        const records = await db.uiCheckerHistory
            .find(query)
            .sort({ created_at: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit));

        // Strip full result for list view — keep only summary
        const list = records.map(r => ({
            _id: r._id,
            type: r.type,
            url: r.url,
            created_at: r.created_at,
            summary: r.result?.summary || {},
            matchPercent: r.result?.matchPercent,
        }));

        const total = await db.uiCheckerHistory.count(query);
        res.json({ records: list, total });
    } catch (err) {
        console.error('[History] List error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/ui-history/:id — Get full history record with screenshots reloaded
router.get('/ui-history/:id', async (req, res) => {
    try {
        const record = await db.uiCheckerHistory.findOne({ _id: req.params.id });
        if (!record) return res.status(404).json({ error: 'Không tìm thấy bản ghi.' });

        // Reload screenshots from files
        const screenshots = {};
        if (record.screenshotMap) {
            for (const [key, filename] of Object.entries(record.screenshotMap)) {
                const data = loadScreenshot(filename);
                if (data) screenshots[key] = data;
            }
        }

        // Re-attach screenshots to result
        if (record.type === 'enhanced' && record.result) {
            record.result.screenshots = screenshots;
        } else if (record.type === 'design-compare' && record.result) {
            record.result.screenshots = screenshots;
        } else if (record.type === 'interaction' && record.result) {
            if (screenshots.initial) record.result.initialScreenshot = screenshots.initial;
            if (screenshots.final) record.result.finalScreenshot = screenshots.final;
            // Re-attach test screenshots
            if (record.result.tests) {
                record.result.tests.forEach((t, i) => {
                    if (screenshots[`test_${i}`]) t.screenshot = screenshots[`test_${i}`];
                });
            }
        }

        res.json(record);
    } catch (err) {
        console.error('[History] Detail error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/ai/ui-history/:id — Delete a history record + its screenshot files
router.delete('/ui-history/:id', async (req, res) => {
    try {
        const record = await db.uiCheckerHistory.findOne({ _id: req.params.id });
        if (!record) return res.status(404).json({ error: 'Không tìm thấy bản ghi.' });

        // Delete screenshot files
        if (record.screenshotMap) {
            for (const filename of Object.values(record.screenshotMap)) {
                if (filename) {
                    const filePath = path.join(UI_SCREENSHOTS_DIR, filename);
                    try { fs.unlinkSync(filePath); } catch { }
                }
            }
        }

        await db.uiCheckerHistory.remove({ _id: req.params.id });
        res.json({ success: true });
    } catch (err) {
        console.error('[History] Delete error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ===== EXPORT ENDPOINTS =====

// GET /api/ai/ui-history/:id/html — Export HTML report
router.get('/ui-history/:id/html', async (req, res) => {
    try {
        const record = await db.uiCheckerHistory.findOne({ _id: req.params.id });
        if (!record) return res.status(404).json({ error: 'Không tìm thấy bản ghi.' });

        // Reload screenshots for embedding in report
        const screenshots = {};
        if (record.screenshotMap) {
            for (const [key, filename] of Object.entries(record.screenshotMap)) {
                const data = loadScreenshot(filename);
                if (data) screenshots[key] = data;
            }
        }

        const { html, filename } = await uiReporter.generateHTML(record, { screenshots });
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(html);
    } catch (err) {
        console.error('[Export HTML] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/ui-history/:id/pdf — Export PDF report
router.get('/ui-history/:id/pdf', async (req, res) => {
    try {
        const record = await db.uiCheckerHistory.findOne({ _id: req.params.id });
        if (!record) return res.status(404).json({ error: 'Không tìm thấy bản ghi.' });

        // Reload screenshots
        const screenshots = {};
        if (record.screenshotMap) {
            for (const [key, filename] of Object.entries(record.screenshotMap)) {
                const data = loadScreenshot(filename);
                if (data) screenshots[key] = data;
            }
        }

        const htmlResult = await uiReporter.generateHTML(record, { screenshots });
        const { path: pdfPath, filename } = await uiReporter.generatePDF(htmlResult.path);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        const pdfBuffer = fs.readFileSync(pdfPath);
        res.send(pdfBuffer);

        // Cleanup files after sending
        try { fs.unlinkSync(htmlResult.path); } catch { }
        try { fs.unlinkSync(pdfPath); } catch { }
    } catch (err) {
        console.error('[Export PDF] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
