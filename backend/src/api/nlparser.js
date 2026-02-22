const express = require('express');
const router = express.Router();
const NLStepParser = require('../parser/NLStepParser');

const parser = new NLStepParser();

/**
 * POST /api/nl-parser/convert
 * Body: { text: "multi-line natural language steps" }
 * Response: { steps: [...], warnings: [...] }
 */
router.post('/convert', (req, res) => {
    try {
        const { text } = req.body;
        if (!text || typeof text !== 'string') {
            return res.status(400).json({ error: 'Vui lòng nhập nội dung các bước (text)' });
        }
        const result = parser.parse(text);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/nl-parser/examples
 * Returns sample natural language inputs for user guidance
 */
router.get('/examples', (req, res) => {
    res.json({
        examples: [
            'Mở trang https://example.com/login',
            'Nhập "admin@test.com" vào ô Email',
            'Nhập "123456" vào ô Mật khẩu',
            'Nhấn nút "Đăng nhập"',
            'Kiểm tra URL chứa /dashboard',
            'Kiểm tra text "Xin chào" hiển thị',
            'Chờ 2 giây',
            'Chụp ảnh màn hình'
        ]
    });
});

module.exports = router;
