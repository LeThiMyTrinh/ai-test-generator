const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const TestRunner = require('../runner/TestRunner');

const UPLOAD_DIR = path.join(__dirname, '../../../uploads/datasets');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({ dest: UPLOAD_DIR, limits: { fileSize: 5 * 1024 * 1024 } });

let io_ref = null;
router.setIO = (io) => { io_ref = io; };

/**
 * Parse CSV string into array of row objects.
 * First line = headers, remaining lines = data rows.
 */
function parseCSV(csvString) {
    const lines = csvString
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(line => line.trim() !== '');

    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        headers.forEach((header, idx) => {
            row[header] = values[idx] !== undefined ? values[idx] : '';
        });
        rows.push(row);
    }

    return rows;
}

// POST /api/data-sets — upload a data set (JSON body or CSV file)
router.post('/', upload.single('file'), async (req, res) => {
    try {
        let testCaseId, name, data;

        if (req.file) {
            // CSV file upload (multipart)
            testCaseId = req.body.test_case_id;
            name = req.body.name || req.file.originalname;
            const csvContent = fs.readFileSync(req.file.path, 'utf-8');
            data = parseCSV(csvContent);
            // Clean up temp file
            fs.unlinkSync(req.file.path);
        } else {
            // JSON body
            testCaseId = req.body.test_case_id;
            name = req.body.name;
            data = req.body.data;
        }

        if (!testCaseId) return res.status(400).json({ error: 'test_case_id is required' });
        if (!name) return res.status(400).json({ error: 'name is required' });
        if (!Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'data must be a non-empty array of row objects' });
        }

        // Verify test case exists
        const testCase = await db.testCases.findOne({ id: testCaseId });
        if (!testCase) return res.status(404).json({ error: 'Test case not found' });

        const dataSet = {
            id: 'DS-' + uuidv4().slice(0, 8),
            test_case_id: testCaseId,
            name,
            data,
            created_at: new Date().toISOString(),
            created_by: req.user ? req.user.email : 'unknown',
        };

        await db.dataSets.insert(dataSet);
        res.status(201).json(dataSet);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/data-sets?test_case_id=xxx — list data sets for a test case
router.get('/', async (req, res) => {
    try {
        const { test_case_id } = req.query;
        const query = test_case_id ? { test_case_id } : {};
        const dataSets = await db.dataSets.find(query).sort({ created_at: -1 });
        res.json(dataSets);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/data-sets/:id — get a single data set with all rows
router.get('/:id', async (req, res) => {
    try {
        const dataSet = await db.dataSets.findOne({ id: req.params.id });
        if (!dataSet) return res.status(404).json({ error: 'Data set not found' });
        res.json(dataSet);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/data-sets/:id — delete a data set
router.delete('/:id', async (req, res) => {
    try {
        const dataSet = await db.dataSets.findOne({ id: req.params.id });
        if (!dataSet) return res.status(404).json({ error: 'Data set not found' });
        await db.dataSets.remove({ id: req.params.id }, {});
        res.json({ deleted: 1, id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/data-sets/:id/run — run a test case with this data set
router.post('/:id/run', async (req, res) => {
    try {
        const dataSet = await db.dataSets.findOne({ id: req.params.id });
        if (!dataSet) return res.status(404).json({ error: 'Data set not found' });

        const testCase = await db.testCases.findOne({ id: dataSet.test_case_id });
        if (!testCase) return res.status(404).json({ error: 'Test case not found' });

        const { continueOnFailure, retryCount, concurrency } = req.body || {};

        const runId = 'RUN-' + Date.now();
        const startedAt = new Date().toISOString();

        await db.runs.insert({
            id: runId,
            suite_id: testCase.suite_id,
            created_by: req.user ? req.user.email : 'unknown',
            started_at: startedAt,
            status: 'RUNNING',
            summary_json: null,
            type: 'data-driven',
            data_set_id: dataSet.id,
            options: {
                continueOnFailure: !!continueOnFailure,
                retryCount: parseInt(retryCount) || 0,
                concurrency: parseInt(concurrency) || 1,
            },
        });

        res.json({
            run_id: runId,
            status: 'RUNNING',
            total_rows: dataSet.data.length,
            test_case_id: testCase.id,
            data_set_id: dataSet.id,
        });

        // Run each data row asynchronously
        setImmediate(async () => {
            try {
                // Build a cloned test case for each data row
                const testCasesForRun = dataSet.data.map((row, index) => ({
                    ...testCase,
                    id: testCase.id + '-row-' + index,
                    title: testCase.title + ' [Row ' + (index + 1) + ']',
                    _dataRow: row,
                }));

                const runner = new TestRunner({
                    io: io_ref,
                    continueOnFailure: !!continueOnFailure,
                    retryCount: parseInt(retryCount) || 0,
                    concurrency: parseInt(concurrency) || 1,
                });

                const { summary, results } = await runner.runSuite(testCasesForRun, runId);

                for (const r of results) {
                    await db.results.insert({
                        run_id: runId,
                        test_case_id: r.test_case_id,
                        test_case_title: r.test_case_title,
                        status: r.status,
                        duration_ms: r.duration_ms,
                        error_message: r.error_message || null,
                        steps_result_json: JSON.stringify(r.steps_result),
                        video_path: r.video_path || null,
                        attempt: r.attempt || 1,
                    });
                }

                const finalStatus = runner._cancelled ? 'CANCELLED' : 'DONE';
                await db.runs.update(
                    { id: runId },
                    {
                        $set: {
                            status: finalStatus,
                            finished_at: new Date().toISOString(),
                            summary_json: JSON.stringify(summary),
                        },
                    }
                );
            } catch (err) {
                await db.runs.update(
                    { id: runId },
                    { $set: { status: 'ERROR', finished_at: new Date().toISOString() } }
                );
                if (io_ref) io_ref.emit('run_error', { runId, error: err.message });
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
