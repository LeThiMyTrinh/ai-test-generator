const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'autotest-secret-key-2024';

function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query.token) {
        token = req.query.token; // fallback for download links
    }
    if (!token) {
        return res.status(401).json({ error: 'Chưa đăng nhập' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = { email: decoded.email, role: decoded.role };
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
    }
}

module.exports = { requireAuth, JWT_SECRET };
