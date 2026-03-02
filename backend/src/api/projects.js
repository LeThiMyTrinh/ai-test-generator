const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { v4: uuidv4 } = require('uuid');

// Helper: ownership query
function ownerQuery(user, extra = {}) {
    if (user.role === 'ADMIN') return extra;
    return { ...extra, created_by: user.email };
}

// GET all projects
router.get('/', async (req, res) => {
    try {
        const query = ownerQuery(req.user);
        const projects = await db.projects.find(query).sort({ created_at: -1 });
        const result = await Promise.all(projects.map(async p => {
            const suites = await db.suites.find({ project_id: p.id });
            const suiteIds = suites.map(s => s.id);
            const suite_count = suites.length;
            const tc_count = suiteIds.length > 0
                ? await db.testCases.count({ suite_id: { $in: suiteIds } })
                : 0;
            let last_run = null;
            if (suiteIds.length > 0) {
                const runs = await db.runs.find({ suite_id: { $in: suiteIds } }).sort({ started_at: -1 }).limit(1);
                if (runs.length > 0) last_run = { id: runs[0].id, status: runs[0].status, started_at: runs[0].started_at };
            }
            return { ...p, suite_count, tc_count, last_run };
        }));
        res.json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET single project
router.get('/:id', async (req, res) => {
    try {
        const project = await db.projects.findOne({ id: req.params.id });
        if (!project) return res.status(404).json({ error: 'Project not found' });
        if (req.user.role !== 'ADMIN' && project.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền truy cập' });
        const suites = await db.suites.find({ project_id: req.params.id }).sort({ created_at: 1 });
        const suitesWithCount = await Promise.all(suites.map(async s => {
            const tc_count = await db.testCases.count({ suite_id: s.id });
            return { ...s, tc_count };
        }));
        res.json({ ...project, suites: suitesWithCount });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST create project
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) return res.status(400).json({ error: 'name is required' });
        const id = 'PROJ-' + uuidv4().slice(0, 8).toUpperCase();
        const doc = { id, name, description: description || '', created_by: req.user.email, created_at: new Date().toISOString() };
        await db.projects.insert(doc);
        res.status(201).json(doc);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT update project
router.put('/:id', async (req, res) => {
    try {
        const project = await db.projects.findOne({ id: req.params.id });
        if (!project) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'ADMIN' && project.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        const { name, description } = req.body;
        await db.projects.update({ id: req.params.id }, { $set: { name, description } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE project (also delete suites and test cases inside)
router.delete('/:id', async (req, res) => {
    try {
        const project = await db.projects.findOne({ id: req.params.id });
        if (!project) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'ADMIN' && project.created_by !== req.user.email) return res.status(403).json({ error: 'Không có quyền' });
        await db.projects.remove({ id: req.params.id });
        const suites = await db.suites.find({ project_id: req.params.id });
        const suiteIds = suites.map(s => s.id);
        await db.suites.remove({ project_id: req.params.id }, { multi: true });
        if (suiteIds.length > 0) {
            await db.testCases.remove({ suite_id: { $in: suiteIds } }, { multi: true });
        }
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
