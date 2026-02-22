const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET all suites
router.get('/', async (req, res) => {
    try {
        const suites = await db.suites.find({}).sort({ created_at: -1 });
        // Attach tc_count
        const result = await Promise.all(suites.map(async s => {
            const count = await db.testCases.count({ suite_id: s.id });
            return { ...s, tc_count: count };
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single suite
router.get('/:id', async (req, res) => {
    try {
        const suite = await db.suites.findOne({ id: req.params.id });
        if (!suite) return res.status(404).json({ error: 'Suite not found' });
        const testCases = await db.testCases.find({ suite_id: req.params.id }).sort({ created_at: 1 });
        res.json({ ...suite, test_cases: testCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create suite
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const id = 'SUITE-' + uuidv4().slice(0, 8).toUpperCase();
        const doc = { id, name, description: description || '', created_at: new Date().toISOString() };
        await db.suites.insert(doc);
        res.status(201).json(doc);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update suite
router.put('/:id', async (req, res) => {
    try {
        const { name, description } = req.body;
        await db.suites.update({ id: req.params.id }, { $set: { name, description } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE suite (also delete test cases)
router.delete('/:id', async (req, res) => {
    try {
        await db.suites.remove({ id: req.params.id });
        await db.testCases.remove({ suite_id: req.params.id }, { multi: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
