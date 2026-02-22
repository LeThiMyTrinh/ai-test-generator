const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const suitesRouter = require('./api/suites');
const testCasesRouter = require('./api/testcases');
const runsRouter = require('./api/runs');
const reportsRouter = require('./api/reports');
const nlparserRouter = require('./api/nlparser');
const aiRouter = require('./api/ai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Ensure directories exist
['evidence', 'reports', 'uploads', 'data'].forEach(dir => {
    const p = path.join(__dirname, '../../', dir);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve evidence files (screenshots/videos)
app.use('/evidence', express.static(path.join(__dirname, '../../evidence')));
// Serve reports
app.use('/reports', express.static(path.join(__dirname, '../../reports')));
// Serve frontend build (in production)
const FRONTEND_DIST = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(FRONTEND_DIST)) {
    app.use(express.static(FRONTEND_DIST));
}

// Inject socket.io into runs router
runsRouter.setIO(io);

// API routes
app.use('/api/test-suites', suitesRouter);
app.use('/api/test-cases', testCasesRouter);
app.use('/api/runs', runsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/nl-parser', nlparserRouter);
app.use('/api/ai', aiRouter);

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('[Socket] Client connected:', socket.id);
    socket.on('disconnect', () => {
        console.log('[Socket] Client disconnected:', socket.id);
    });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
    const indexPath = path.join(FRONTEND_DIST, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.json({ message: 'Automation Tool Backend Running', version: '1.0.0' });
    }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`✅ Automation Tool Backend running at http://localhost:${PORT}`);
});

module.exports = { app, io };
