const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const AITestGenerator = require('../ai/AITestGenerator');
const URLCrawler = require('../ai/URLCrawler');

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

module.exports = router;
