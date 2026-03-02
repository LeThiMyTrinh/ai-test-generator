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

// GET export test cases as Excel
router.get('/export/excel', async (req, res) => {
    try {
        const { suite_id } = req.query;
        if (!suite_id) return res.status(400).json({ error: 'suite_id required' });
        const testCases = await db.testCases.find({ suite_id }).sort({ created_at: 1 });
        if (testCases.length === 0) return res.status(404).json({ error: 'Không có test case nào trong suite này' });

        const XLSX = require('xlsx');
        const rows = [];
        for (const tc of testCases) {
            const steps = typeof tc.steps_json === 'string' ? JSON.parse(tc.steps_json) : (tc.steps_json || []);
            if (steps.length === 0) {
                rows.push({
                    tc_id: tc.id,
                    tieu_de: tc.title,
                    url: tc.url,
                    trinh_duyet: tc.browser || 'chromium',
                    thiet_bi: tc.device || '',
                    buoc_thuc_hien: ''
                });
            } else {
                steps.forEach((step, i) => {
                    rows.push({
                        tc_id: i === 0 ? tc.id : '',
                        tieu_de: i === 0 ? tc.title : '',
                        url: i === 0 ? tc.url : '',
                        trinh_duyet: i === 0 ? (tc.browser || 'chromium') : '',
                        thiet_bi: i === 0 ? (tc.device || '') : '',
                        buoc_thuc_hien: step.description || `${step.action}: ${step.selector || step.value || ''}`
                    });
                });
            }
        }

        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [
            { wch: 16 }, { wch: 30 }, { wch: 35 }, { wch: 12 }, { wch: 14 }, { wch: 50 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, 'TestCases');
        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        const suite = await db.suites.findOne({ id: suite_id });
        const suiteName = suite ? suite.name.replace(/[^a-zA-Z0-9_\-\u00C0-\u024F\u1E00-\u1EFF ]/g, '').trim().replace(/\s+/g, '_') : suite_id;
        const filename = `TestCases_${suiteName}_${new Date().toISOString().slice(0, 10)}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        res.send(buf);
    } catch (err) { res.status(500).json({ error: err.message }); }
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
        const doc = { id, suite_id, title, description: description || '', url, browser: browser || 'chromium', device: device || null, steps_json: JSON.stringify(steps), created_by: req.user.email, created_at: new Date().toISOString() };
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

// POST clone test case
router.post('/:id/clone', async (req, res) => {
    try {
        const original = await db.testCases.findOne({ id: req.params.id });
        if (!original) return res.status(404).json({ error: 'Test case not found' });
        const newId = 'TC-' + uuidv4().slice(0, 8).toUpperCase();
        const doc = {
            id: newId,
            suite_id: original.suite_id,
            title: original.title + ' (Copy)',
            description: original.description || '',
            url: original.url,
            browser: original.browser || 'chromium',
            device: original.device || null,
            steps_json: original.steps_json,
            created_by: req.user.email,
            created_at: new Date().toISOString()
        };
        await db.testCases.insert(doc);
        res.status(201).json(doc);
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
            await db.testCases.insert({ id, suite_id, title: tc.title, description: tc.description || '', url: tc.url, browser: tc.browser || 'chromium', device: tc.device || null, steps_json: JSON.stringify(tc.steps), created_by: req.user.email, created_at: new Date().toISOString() });
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
