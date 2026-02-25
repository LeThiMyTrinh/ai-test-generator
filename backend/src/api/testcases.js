const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const ExcelImporter = require('../importer/ExcelImporter');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

// GET all test cases (optionally by suite_id)
router.get('/', async (req, res) => {
    try {
        const { suite_id } = req.query;
        const query = suite_id ? { suite_id } : {};
        const rows = await db.testCases.find(query).sort({ created_at: 1 });
        const result = rows.map(r => ({ ...r, steps: typeof r.steps_json === 'string' ? JSON.parse(r.steps_json) : r.steps_json, device: r.device || null }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single test case
router.get('/template/download', (req, res) => {
    const templatePath = path.join(__dirname, '../templates/testcase_template.xlsx');
    if (!fs.existsSync(templatePath)) return res.status(404).json({ error: 'Template not generated yet. Run: npm run create-template' });
    res.download(templatePath, 'testcase_template.xlsx');
});

router.get('/:id', async (req, res) => {
    try {
        const tc = await db.testCases.findOne({ id: req.params.id });
        if (!tc) return res.status(404).json({ error: 'Not found' });
        res.json({ ...tc, steps: typeof tc.steps_json === 'string' ? JSON.parse(tc.steps_json) : tc.steps_json });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create test case (manual)
router.post('/', async (req, res) => {
    try {
        const { suite_id, title, description, url, browser, device, steps } = req.body;
        if (!suite_id || !title || !url || !steps) return res.status(400).json({ error: 'suite_id, title, url, steps required' });
        const id = 'TC-' + uuidv4().slice(0, 8).toUpperCase();
        const doc = { id, suite_id, title, description: description || '', url, browser: browser || 'chromium', device: device || null, steps_json: JSON.stringify(steps), created_at: new Date().toISOString() };
        await db.testCases.insert(doc);
        res.status(201).json({ id, title });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update test case
router.put('/:id', async (req, res) => {
    try {
        const { title, description, url, browser, device, steps } = req.body;
        await db.testCases.update({ id: req.params.id }, { $set: { title, description: description || '', url, browser: browser || 'chromium', device: device || null, steps_json: JSON.stringify(steps) } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        await db.testCases.remove({ id: req.params.id });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST import from Excel
router.post('/import/excel', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const { suite_id } = req.body;
    if (!suite_id) { fs.unlinkSync(req.file.path); return res.status(400).json({ error: 'suite_id required' }); }
    try {
        const importer = new ExcelImporter();
        const testCases = importer.parse(req.file.path);
        const nlWarnings = testCases._warnings || [];
        const ids = [];
        for (const tc of testCases) {
            const id = 'TC-' + uuidv4().slice(0, 8).toUpperCase();
            await db.testCases.insert({ id, suite_id, title: tc.title, description: tc.description || '', url: tc.url, browser: tc.browser || 'chromium', device: tc.device || null, steps_json: JSON.stringify(tc.steps), created_at: new Date().toISOString() });
            ids.push(id);
        }
        fs.unlinkSync(req.file.path);
        const result = { imported: ids.length, ids };
        if (nlWarnings.length > 0) result.warnings = nlWarnings;
        res.json(result);
    } catch (err) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(422).json({ error: err.message });
    }
});

module.exports = router;
