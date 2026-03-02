const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });

        const emailLower = email.trim().toLowerCase();

        // Validate email format
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
            return res.status(400).json({ error: 'Email không hợp lệ' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
        }

        // Check existing
        const existing = await db.users.findOne({ email: emailLower });
        if (existing) return res.status(409).json({ error: 'Email đã được đăng ký' });

        const hash = await bcrypt.hash(password, 10);
        const user = {
            email: emailLower,
            password_hash: hash,
            role: 'USER',
            created_at: new Date().toISOString()
        };
        await db.users.insert(user);

        // Auto login after register
        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ token, user: { email: user.email, role: user.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });

        const emailLower = email.trim().toLowerCase();
        const user = await db.users.findOne({ email: emailLower });
        if (!user) return res.status(401).json({ error: 'Email chưa được đăng ký' });

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return res.status(401).json({ error: 'Mật khẩu không đúng' });

        const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { email: user.email, role: user.role } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/auth/me
router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    try {
        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET);
        res.json({ email: decoded.email, role: decoded.role });
    } catch (err) { res.status(401).json({ error: 'Token không hợp lệ' }); }
});

module.exports = router;
