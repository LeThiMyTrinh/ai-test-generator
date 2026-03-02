const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// GET all suites (optionally by project_id)
router.get('/', async (req, res) => {
    try {
        const { project_id } = req.query;
        let query = project_id ? { project_id } : {};

        // USER: only see suites created by them
        if (req.user.role !== 'ADMIN') {
            query.created_by = req.user.email;
        }

        const suites = await db.suites.find(query).sort({ created_at: -1 });
        const result = await Promise.all(suites.map(async s => {
            const count = await db.testCases.count({ suite_id: s.id });
            const project = await db.projects.findOne({ id: s.project_id });
            return { ...s, tc_count: count, project_name: project ? project.name : '—' };
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single suite
router.get('/:id', async (req, res) => {
    try {
        const suite = await db.suites.findOne({ id: req.params.id });
        if (!suite) return res.status(404).json({ error: 'Suite not found' });
        if (req.user.role !== 'ADMIN' && suite.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        const testCases = await db.testCases.find({ suite_id: req.params.id }).sort({ created_at: 1 });
        res.json({ ...suite, test_cases: testCases });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create suite
router.post('/', async (req, res) => {
    try {
        const { project_id, name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        if (!project_id) return res.status(400).json({ error: 'project_id is required' });
        const id = 'SUITE-' + uuidv4().slice(0, 8).toUpperCase();
        const doc = { id, project_id, name, description: description || '', created_by: req.user.email, created_at: new Date().toISOString() };
        await db.suites.insert(doc);
        res.status(201).json(doc);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update suite
router.put('/:id', async (req, res) => {
    try {
        const suite = await db.suites.findOne({ id: req.params.id });
        if (!suite) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'ADMIN' && suite.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        const { name, description } = req.body;
        await db.suites.update({ id: req.params.id }, { $set: { name, description } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE suite (also delete test cases)
router.delete('/:id', async (req, res) => {
    try {
        const suite = await db.suites.findOne({ id: req.params.id });
        if (!suite) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'ADMIN' && suite.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        await db.suites.remove({ id: req.params.id });
        await db.testCases.remove({ suite_id: req.params.id }, { multi: true });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
