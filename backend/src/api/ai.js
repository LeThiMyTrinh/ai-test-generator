const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AIService = require('../ai/AIService');
const NLStepParser = require('../parser/NLStepParser');
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
        // Strip test screenshots — save all (1 per test case)
        if (result.tests) {
            result.tests.forEach((t, i) => {
                if (t.screenshot) {
                    screenshotMap[`test_${i}`] = saveScreenshot(t.screenshot, historyId, `test_${i}`);
                }
                delete t.screenshot; // remove from DB doc
            });
        }
    }

    return screenshotMap;
}

/**
 * Resolve device string (e.g. 'desktop-1920x1080', 'tablet-ipad-pro', 'mobile-iphone-15') to Playwright viewport/context options
 */
function resolveDevice(deviceStr) {
    if (!deviceStr) return { viewport: { width: 1920, height: 1080 } };
    const [type, ...rest] = deviceStr.split('-');
    const key = rest.join('-');

    if (type === 'desktop') {
        const vp = DESKTOP_PRESETS[key];
        return vp ? { viewport: vp } : { viewport: { width: 1920, height: 1080 } };
    }
    if (type === 'tablet') {
        const pwName = TABLET_PRESETS[key];
        const { devices } = require('playwright');
        if (pwName && devices[pwName]) return { ...devices[pwName] };
        return { viewport: { width: 768, height: 1024 } };
    }
    if (type === 'mobile') {
        const pwName = MOBILE_PRESETS[key];
        const { devices } = require('playwright');
        if (pwName && devices[pwName]) return { ...devices[pwName] };
        return { viewport: { width: 375, height: 812 } };
    }
    return { viewport: { width: 1920, height: 1080 } };
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

// AI Service + NL Parser + Crawler
const aiService = new AIService();
const nlParser = new NLStepParser();
const crawler = new URLCrawler();

// Socket.IO injection (gọi từ server.js)
let io_ref = null;
router.setIO = (io) => { io_ref = io; };

// ===== AI TEST GENERATION ROUTES =====

// GET /api/ai/status
router.get('/status', (req, res) => {
    const aiConfigured = aiService.isConfigured();
    res.json({
        configured: true, // Smart Template is always available
        aiConfigured,     // Whether paid AI providers are configured
        nlParserAvailable: true,
        smartTemplateAvailable: true,
        message: aiConfigured
            ? 'AI và Smart Template đã sẵn sàng'
            : 'Smart Template (miễn phí) sẵn sàng. Thêm API key để dùng AI.',
        providers: aiService.status(),
        testTypes: aiService.getTestTypes(),
        cache: aiService.cache.stats()
    });
});

// POST /api/ai/save-key
router.post('/save-key', (req, res) => {
    try {
        const { provider, key } = req.body;
        if (!provider || !key) return res.status(400).json({ error: 'Thiếu provider hoặc key' });
        if (!['openai', 'gemini', 'claude'].includes(provider)) {
            return res.status(400).json({ error: 'Provider không hợp lệ. Chọn: openai, gemini, claude' });
        }

        aiService.reloadProvider(provider, key.trim());

        // Persist to .env
        const envPath = path.join(__dirname, '../../.env');
        let envContent = '';
        try { envContent = fs.readFileSync(envPath, 'utf8'); } catch { }

        const envKey = aiService.getEnvKeyName(provider);
        const regex = new RegExp(`^${envKey}=.*$`, 'm');
        if (regex.test(envContent)) {
            envContent = envContent.replace(regex, `${envKey}=${key.trim()}`);
        } else {
            envContent += `\n${envKey}=${key.trim()}`;
        }
        fs.writeFileSync(envPath, envContent.trim() + '\n');

        console.log(`[AI] Saved ${envKey} and reloaded provider`);
        res.json({ success: true, providers: aiService.status() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/ai/remove-key
router.post('/remove-key', (req, res) => {
    try {
        const { provider } = req.body;
        if (!provider) return res.status(400).json({ error: 'Thiếu provider' });

        aiService.removeProvider(provider);

        const envPath = path.join(__dirname, '../../.env');
        try {
            let envContent = fs.readFileSync(envPath, 'utf8');
            const envKey = aiService.getEnvKeyName(provider);
            envContent = envContent.replace(new RegExp(`^${envKey}=.*\\n?`, 'm'), '');
            fs.writeFileSync(envPath, envContent.trim() + '\n');
        } catch { }

        res.json({ success: true, providers: aiService.status() });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ai/queue-status
router.get('/queue-status', (req, res) => {
    res.json({
        cache: aiService.cache.stats(),
        providers: aiService.status()
    });
});

// POST /api/ai/generate — URL-based AI test generation (3 scenarios)
router.post('/generate', async (req, res) => {
    try {
        const { url, testType, description, provider } = req.body;

        // NL Parser mode: text-only, no URL
        if (description && !url) {
            const lines = description.trim().split('\n').filter(l => l.trim());
            try {
                const nlResult = nlParser.parse(description);
                if (nlResult.steps.length >= 1 || !aiService.isConfigured()) {
                    const warnings = nlResult.warnings || [];
                    if (nlResult.steps.length === 0) {
                        warnings.push('Không nhận diện được bước nào. Hãy mô tả rõ hơn.');
                    }
                    return res.json({
                        scenarios: [{
                            type: 'happy_path',
                            title: `Test Case: ${lines[0]?.substring(0, 60) || 'Untitled'}`,
                            description: description.substring(0, 200),
                            steps: nlResult.steps,
                            warnings
                        }],
                        source: 'nl-parser'
                    });
                }
            } catch (nlErr) {
                if (!aiService.isConfigured()) {
                    return res.status(400).json({
                        error: 'Không thể phân tích. Hãy mô tả rõ hơn hoặc thêm API key để dùng AI.'
                    });
                }
            }
        }

        // AI mode: need URL
        if (!url) {
            return res.status(400).json({ error: 'Cần cung cấp URL trang web.' });
        }
        // Smart Template mode doesn't need AI provider configured
        if (provider !== 'smart-template' && !aiService.isConfigured()) {
            return res.status(400).json({
                error: 'Chưa cấu hình AI provider. Vui lòng chọn "Smart Template (Miễn phí)" hoặc thêm API key.'
            });
        }

        // Step 1: Crawl URL
        console.log(`[AI] Crawling: ${url}`);
        let crawlData;
        try {
            crawlData = await crawler.analyze(url);
            console.log(`[AI] Crawled: ${crawlData.elements.length} elements`);
        } catch (crawlErr) {
            return res.status(400).json({
                error: `Không thể truy cập URL: ${crawlErr.message}`
            });
        }

        // Step 2: Generate test cases via AI
        console.log(`[AI] Generating — type: ${testType || 'auto'}, provider: ${provider || 'auto'}`);
        const result = await aiService.generate(crawlData, { url, testType, description, provider });
        console.log(`[AI] Generated ${result.scenarios.length} scenarios via ${result.source}`);

        // Return crawl info + scenarios
        res.json({
            scenarios: result.scenarios,
            source: result.source,
            aiError: result.aiError || null,
            detectedPatterns: result.detectedPatterns || null,
            crawlInfo: {
                title: crawlData.metadata?.title,
                forms: crawlData.metadata?.forms,
                inputs: crawlData.metadata?.inputs,
                buttons: crawlData.metadata?.buttons,
                links: crawlData.metadata?.links,
                checkboxes: crawlData.metadata?.checkboxes,
                selects: crawlData.metadata?.selects,
                textareas: crawlData.metadata?.textareas,
                tables: crawlData.metadata?.tables,
                tabs: crawlData.metadata?.tabs,
                elementsCount: crawlData.elements.length,
                screenshotBase64: crawlData.screenshot.toString('base64')
            }
        });

    } catch (err) {
        console.error('[AI] Generate error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/refine
router.post('/refine', async (req, res) => {
    try {
        if (!aiService.isConfigured()) {
            return res.status(400).json({ error: 'Chưa cấu hình AI provider nào.' });
        }

        const { steps, feedback, url, provider } = req.body;
        if (!steps || !feedback) {
            return res.status(400).json({ error: 'Cần cung cấp steps hiện tại và yêu cầu chỉnh sửa.' });
        }

        console.log(`[AI] Refining — feedback: ${feedback.substring(0, 80)}`);
        const result = await aiService.refine(steps, feedback, { url, provider });
        console.log(`[AI] Refined: ${result.steps.length} steps`);

        res.json(result);
    } catch (err) {
        console.error('[AI] Refine error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/crawl — crawl URL only (no AI)
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
        const { url, threshold, device } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });
        if (!req.file) return res.status(400).json({ error: 'Cần upload ảnh design.' });

        const designBuffer = fs.readFileSync(req.file.path);
        fs.unlinkSync(req.file.path); // Cleanup

        const deviceOpts = resolveDevice(device);
        const viewport = deviceOpts.viewport || { width: 1920, height: 1080 };

        console.log(`[DesignComparer] Comparing design vs ${url} at ${viewport.width}×${viewport.height} (${device || 'default'})`);

        const result = await designComparer.compareWithUpload(designBuffer, url, {
            viewport,
            contextOptions: deviceOpts,
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
        const { url, level, loginEmail, loginPassword, maxActions, device } = req.body;
        if (!url) return res.status(400).json({ error: 'Cần cung cấp URL.' });

        const validLevels = ['static', 'smart', 'chaos', 'full'];
        const testLevel = validLevels.includes(level) ? level : 'smart';

        const deviceOpts = resolveDevice(device);
        const viewport = deviceOpts.viewport || { width: 1920, height: 1080 };

        console.log(`[InteractionTester] Starting ${testLevel} test: ${url} (${device || 'default'})`);

        const result = await interactionTester.test(url, {
            level: testLevel,
            loginEmail,
            loginPassword,
            maxActions: parseInt(maxActions) || 500,
            viewport,
            contextOptions: deviceOpts,
        });

        console.log(`[InteractionTester] Done: ${result.summary.totalTests} tests, ${result.summary.passed} passed, ${result.summary.failed} failed`);

        // Save to history (use deep copy so original result keeps screenshots for response)
        try {
            const resultForDb = JSON.parse(JSON.stringify(result));
            const historyRecord = await db.uiCheckerHistory.insert({
                type: 'interaction',
                url,
                created_at: new Date().toISOString(),
                result: { ...resultForDb, initialScreenshot: undefined, finalScreenshot: undefined },
                screenshotMap: {},
            });
            const screenshotMap = stripAndSaveScreenshots(resultForDb, historyRecord._id, 'interaction');
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
